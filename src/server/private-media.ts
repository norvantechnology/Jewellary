import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";
import { env } from "@/lib/env";
import { ValidationError } from "@/server/errors";
import { getS3Client, isS3Reachable } from "@/server/storage";

export type PrivateMediaFolder = "customizations" | "chat";
export type PrivateMediaKind = "draft" | "customization" | "chat";

export const ALLOWED_CUSTOMER_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const PRIVATE_MEDIA_URL_TTL_SECONDS = 3600;
const PRIVATE_UPLOAD_ROOT =
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), ".private-uploads");
const SAFE_STORAGE_KEY_REGEX =
  /^(customizations|chat)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(-thumb)?\.webp$/;

export interface CustomerUploadTokenPayload {
  storageKey: string;
  ownerKey: string;
  folder: PrivateMediaFolder;
  mimeType: string;
  maxBytes: number;
  exp: number;
}

export interface PersistedPrivateMedia {
  storageKey: string;
  thumbKey: string;
  url: string;
  thumbUrl: string;
  mimeType: "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  exifStripped: true;
  scanStatus: "CLEAN";
  expiresAt: string;
}

function getSigningSecret(): string {
  return env.BETTER_AUTH_SECRET;
}

export function isValidPrivateStorageKey(key: string): boolean {
  return SAFE_STORAGE_KEY_REGEX.test(key);
}

export function getBaseKeyFromPrivateKey(key: string): string {
  return key.replace(/-thumb\.webp$/, ".webp");
}

export function isStorageKeyOwnedByActor(
  storageKey: string,
  folder: PrivateMediaFolder,
  ownerKeys: string[],
): boolean {
  if (!isValidPrivateStorageKey(storageKey)) return false;
  if (!storageKey.startsWith(`${folder}/`)) return false;
  const parts = storageKey.split("/");
  const ownerSegment = parts[1];
  if (!ownerSegment) return false;
  return ownerKeys.some((k) => hashOwnerKey(k) === ownerSegment);
}

export function hashOwnerKey(ownerKey: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`owner:${ownerKey}`)
    .digest("hex")
    .slice(0, 20);
}

export function signCustomerUploadToken(payload: CustomerUploadTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`cust-up:${encoded}`)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyCustomerUploadToken(token: string): CustomerUploadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`cust-up:${encoded}`)
    .digest("base64url");

  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CustomerUploadTokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (!isValidPrivateStorageKey(parsed.storageKey)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createSignedPrivateMediaUrl(params: {
  kind: PrivateMediaKind;
  recordId: string;
  storageKey: string;
  thumb?: boolean;
  ttlSeconds?: number;
}): { url: string; expiresAt: Date } {
  const ttl = params.ttlSeconds ?? PRIVATE_MEDIA_URL_TTL_SECONDS;
  const exp = Date.now() + ttl * 1000;
  const variant = params.thumb ? "thumb" : "full";
  const payload = `${params.kind}:${params.recordId}:${params.storageKey}:${variant}:${exp}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`media-read:${payload}`)
    .digest("base64url");

  const qs = new URLSearchParams({
    key: params.storageKey,
    exp: String(exp),
    sig,
  });
  if (params.thumb) {
    qs.set("thumb", "1");
  }

  return {
    url: `/api/media/private/${params.kind}/${encodeURIComponent(params.recordId)}?${qs.toString()}`,
    expiresAt: new Date(exp),
  };
}

export function verifySignedPrivateMediaParams(params: {
  kind: PrivateMediaKind;
  recordId: string;
  storageKey: string;
  thumb: boolean;
  exp: string | null;
  sig: string | null;
}): boolean {
  if (!params.exp || !params.sig) return false;
  if (!isValidPrivateStorageKey(params.storageKey)) return false;

  const expNum = Number(params.exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;

  const variant = params.thumb ? "thumb" : "full";
  const payload = `${params.kind}:${params.recordId}:${params.storageKey}:${variant}:${expNum}`;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`media-read:${payload}`)
    .digest("base64url");

  const a = Buffer.from(params.sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSignedCustomerImageUpload(params: {
  folder: PrivateMediaFolder;
  ownerKey: string;
  mimeType: string;
  byteSize: number;
  fileName: string;
}) {
  if (
    !ALLOWED_CUSTOMER_IMAGE_MIMES.includes(
      params.mimeType as (typeof ALLOWED_CUSTOMER_IMAGE_MIMES)[number],
    )
  ) {
    throw new ValidationError(
      "Unsupported file type. Upload JPG, PNG, WebP, or HEIC images up to 5 MB.",
    );
  }
  if (params.byteSize <= 0 || params.byteSize > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES) {
    throw new ValidationError("File size must be between 1 byte and 5 MB.");
  }

  const ownerHash = hashOwnerKey(params.ownerKey);
  const fileId = crypto.randomUUID().replace(/-/g, "");
  const storageKey = `${params.folder}/${ownerHash}/${fileId}.webp`;
  const expiresInSec = 600;
  const token = signCustomerUploadToken({
    storageKey,
    ownerKey: params.ownerKey,
    folder: params.folder,
    mimeType: params.mimeType,
    maxBytes: MAX_CUSTOMER_IMAGE_UPLOAD_BYTES,
    exp: Date.now() + expiresInSec * 1000,
  });

  const confirmPath =
    params.folder === "customizations"
      ? "/api/customizations/uploads/confirm"
      : "/api/chat/uploads/confirm";

  return {
    storageKey,
    uploadToken: token,
    uploadUrl: `${confirmPath}?token=${encodeURIComponent(token)}`,
    method: "PUT" as const,
    expiresInSeconds: expiresInSec,
    maxBytes: MAX_CUSTOMER_IMAGE_UPLOAD_BYTES,
  };
}

async function scanBufferForPolyglotsAndMalware(
  buffer: Buffer,
  detectedMime: string,
): Promise<void> {
  const headText = buffer.subarray(0, 512).toString("utf8");
  if (/^\s*(?:<\?php|<svg[\s>]|<script[\s>]|<!doctype\s+html)/i.test(headText)) {
    throw new ValidationError("Disallowed executable or markup signature detected in file.");
  }

  if (env.MALWARE_SCAN_WEBHOOK_URL) {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    try {
      const response = await fetch(env.MALWARE_SCAN_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sha256,
          mimeType: detectedMime,
          sizeBytes: buffer.byteLength,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new ValidationError("Security scanner rejected uploaded attachment.");
      }
      const result = (await response.json()) as { clean?: boolean };
      if (result.clean === false) {
        throw new ValidationError("Attachment flagged by security screening.");
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError("Attachment security screening could not be completed.");
    }
  }
}

export async function processAndPersistCustomerImage(params: {
  storageKey: string;
  ownerKey: string;
  buffer: Buffer;
}): Promise<PersistedPrivateMedia> {
  if (!isValidPrivateStorageKey(params.storageKey)) {
    throw new ValidationError("Invalid private media storage key.");
  }
  if (
    params.buffer.byteLength === 0 ||
    params.buffer.byteLength > MAX_CUSTOMER_IMAGE_UPLOAD_BYTES
  ) {
    throw new ValidationError("File size exceeds the 5 MB attachment limit.");
  }

  const detected = await fileTypeFromBuffer(params.buffer);
  if (
    !detected ||
    !ALLOWED_CUSTOMER_IMAGE_MIMES.includes(
      detected.mime as (typeof ALLOWED_CUSTOMER_IMAGE_MIMES)[number],
    )
  ) {
    throw new ValidationError(
      "Invalid image content. Magic bytes must match JPG, PNG, WebP, or HEIC.",
    );
  }

  await scanBufferForPolyglotsAndMalware(params.buffer, detected.mime);

  let decodedFull: { data: Buffer; info: sharp.OutputInfo };
  let decodedThumb: { data: Buffer; info: sharp.OutputInfo };
  try {
    // `.rotate()` honors orientation tags and re-encoding WITHOUT `.withMetadata()` strips EXIF, GPS, XMP, and trailing polyglots.
    const pipeline = sharp(params.buffer, { limitInputPixels: 40_000_000 }).rotate();
    [decodedFull, decodedThumb] = await Promise.all([
      pipeline
        .clone()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true }),
      pipeline
        .clone()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
    ]);
  } catch {
    if (detected.mime === "image/heic" || detected.mime === "image/heif") {
      throw new ValidationError(
        "HEIC photo could not be decoded cleanly. Please convert to JPG, PNG, or WebP and retry.",
      );
    }
    throw new ValidationError("Corrupted or unreadable image file.");
  }

  const thumbKey = params.storageKey.replace(/\.webp$/, "-thumb.webp");
  const s3Client = getS3Client();
  if (s3Client && (await isS3Reachable(s3Client))) {
    const s3 = s3Client;
    await Promise.all([
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `private/${params.storageKey}`,
          Body: decodedFull.data,
          ContentType: "image/webp",
          CacheControl: "private, no-store, max-age=0",
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `private/${thumbKey}`,
          Body: decodedThumb.data,
          ContentType: "image/webp",
          CacheControl: "private, no-store, max-age=0",
        }),
      ),
    ]);
  } else {
    const fullDiskPath = path.resolve(PRIVATE_UPLOAD_ROOT, params.storageKey);
    const thumbDiskPath = path.resolve(PRIVATE_UPLOAD_ROOT, thumbKey);
    if (!fullDiskPath.startsWith(PRIVATE_UPLOAD_ROOT + path.sep)) {
      throw new ValidationError("Invalid private storage destination.");
    }
    await fs.mkdir(path.dirname(fullDiskPath), { recursive: true });
    await Promise.all([
      fs.writeFile(fullDiskPath, decodedFull.data),
      fs.writeFile(thumbDiskPath, decodedThumb.data),
    ]);
  }

  const draftId = hashOwnerKey(params.ownerKey);
  const signedMain = createSignedPrivateMediaUrl({
    kind: "draft",
    recordId: draftId,
    storageKey: params.storageKey,
  });
  const signedThumb = createSignedPrivateMediaUrl({
    kind: "draft",
    recordId: draftId,
    storageKey: thumbKey,
    thumb: true,
  });

  return {
    storageKey: params.storageKey,
    thumbKey,
    url: signedMain.url,
    thumbUrl: signedThumb.url,
    mimeType: "image/webp",
    sizeBytes: decodedFull.data.byteLength,
    width: decodedFull.info.width,
    height: decodedFull.info.height,
    exifStripped: true,
    scanStatus: "CLEAN",
    expiresAt: signedMain.expiresAt.toISOString(),
  };
}

export async function readPrivateMediaBuffer(storageKey: string): Promise<Buffer | null> {
  if (!isValidPrivateStorageKey(storageKey)) {
    return null;
  }

  const s3Read = getS3Client();
  if (s3Read && (await isS3Reachable(s3Read))) {
    try {
      const s3 = s3Read;
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `private/${storageKey}`,
        }),
      );
      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      // Fall through to local fallback if an older local object is requested
    }
  }

  const diskPath = path.resolve(PRIVATE_UPLOAD_ROOT, storageKey);
  if (!diskPath.startsWith(PRIVATE_UPLOAD_ROOT + path.sep)) {
    return null;
  }
  try {
    return await fs.readFile(/*turbopackIgnore: true*/ diskPath);
  } catch {
    return null;
  }
}

export async function deletePrivateMediaObject(storageKey: string): Promise<void> {
  if (!isValidPrivateStorageKey(storageKey)) return;
  const thumbKey = storageKey.replace(/\.webp$/, "-thumb.webp");

  const s3Del = getS3Client();
  if (s3Del && (await isS3Reachable(s3Del))) {
    const s3 = s3Del;
    await Promise.allSettled([
      s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: `private/${storageKey}` })),
      s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: `private/${thumbKey}` })),
    ]);
  }

  for (const key of [storageKey, thumbKey]) {
    const diskPath = path.resolve(PRIVATE_UPLOAD_ROOT, key);
    if (diskPath.startsWith(PRIVATE_UPLOAD_ROOT + path.sep)) {
      await fs.rm(diskPath, { force: true }).catch(() => undefined);
    }
  }
}
