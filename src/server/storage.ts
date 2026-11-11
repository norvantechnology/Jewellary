import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { env } from "@/lib/env";
import { ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export type UploadFolder = "products" | "categories" | "banners" | "articles" | "store";

const TMP_LOCAL_DIR = path.join(process.cwd(), ".tmp-uploads");
const PUBLIC_LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

function getS3Client(): S3Client | null {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_ENDPOINT) {
    return null;
  }
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function isS3Reachable(client: S3Client): Promise<boolean> {
  if (!env.S3_ENDPOINT) return false;
  // In non-localhost endpoints (real R2/S3), assume configured endpoint is reachable.
  const endpointUrl = new URL(env.S3_ENDPOINT);
  if (endpointUrl.hostname !== "localhost" && endpointUrl.hostname !== "127.0.0.1") {
    return true;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 350);
    await fetch(env.S3_ENDPOINT, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    return Boolean(client);
  } catch {
    return false;
  }
}

export function signLocalUploadToken(key: string, expMs: number): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`${key}:${expMs}`).digest("hex");
}

export function verifyLocalUploadToken(key: string, expMs: number, token: string): boolean {
  if (Date.now() > expMs) return false;
  const expected = signLocalUploadToken(key, expMs);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertSafeKey(key: string): string {
  const normalized = path.posix.normalize(key).replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith(".")) {
    throw new ValidationError("Invalid storage key.");
  }
  return normalized;
}

export async function createSignedImageUpload(input: {
  folder: UploadFolder;
  mimeType: string;
  sizeBytes: number;
}): Promise<{
  mode: "s3" | "local";
  uploadUrl: string;
  tempKey: string;
  folder: UploadFolder;
  expiresInSeconds: number;
}> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.mimeType)) {
    throw new ValidationError("Unsupported image format. Allowed: JPEG, PNG, WebP, AVIF.");
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ValidationError("Image must be between 1 byte and 10 MB.");
  }

  const tempKey = `tmp/${input.folder}/${createId()}`;
  const expiresInSeconds = 300;
  const s3 = getS3Client();

  if (s3 && (await isS3Reachable(s3))) {
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: tempKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    return {
      mode: "s3",
      uploadUrl,
      tempKey,
      folder: input.folder,
      expiresInSeconds,
    };
  }

  const expMs = Date.now() + expiresInSeconds * 1000;
  const token = signLocalUploadToken(tempKey, expMs);
  const uploadUrl = `/api/uploads/local?key=${encodeURIComponent(tempKey)}&exp=${expMs}&token=${token}`;

  return {
    mode: "local",
    uploadUrl,
    tempKey,
    folder: input.folder,
    expiresInSeconds,
  };
}

export async function writeLocalTempObject(key: string, data: Buffer): Promise<void> {
  const safeKey = assertSafeKey(key);
  const target = path.join(TMP_LOCAL_DIR, safeKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function readStagedObject(
  tempKey: string,
  mode: "s3" | "local",
): Promise<{ buffer: Buffer; s3: S3Client | null }> {
  const safeKey = assertSafeKey(tempKey);
  if (mode === "s3") {
    const s3 = getS3Client();
    if (!s3) throw new ValidationError("S3 client not configured.");
    const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: safeKey }));
    if (!res.Body) {
      throw new ValidationError("Uploaded object not found.");
    }
    const bytes = await res.Body.transformToByteArray();
    return { buffer: Buffer.from(bytes), s3 };
  }

  const filePath = path.join(TMP_LOCAL_DIR, safeKey);
  const buffer = await readFile(filePath);
  return { buffer, s3: null };
}

async function deleteStagedObject(
  tempKey: string,
  mode: "s3" | "local",
  s3: S3Client | null,
): Promise<void> {
  const safeKey = assertSafeKey(tempKey);
  try {
    if (mode === "s3" && s3) {
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: safeKey }));
    } else {
      await rm(path.join(TMP_LOCAL_DIR, safeKey), { force: true });
    }
  } catch (err) {
    logger.warn({ tempKey, err }, "Failed to remove staged upload object");
  }
}

export async function processAndPersistImageUpload(input: {
  tempKey: string;
  folder: UploadFolder;
  mode: "s3" | "local";
}): Promise<{
  storageKey: string;
  url: string;
  mediumUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
}> {
  const { buffer, s3 } = await readStagedObject(input.tempKey, input.mode);

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    await deleteStagedObject(input.tempKey, input.mode, s3);
    throw new ValidationError("Uploaded image size exceeds 10 MB limit.");
  }

  // Verify actual binary magic bytes (blocks spoofed Content-Type / SVG payloads)
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
    await deleteStagedObject(input.tempKey, input.mode, s3);
    throw new ValidationError("Uploaded file magic bytes do not match an allowed raster image.");
  }

  // Strip EXIF/metadata via Sharp re-encode & generate WebP variants
  const pipeline = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
  const fullProcessed = await pipeline
    .clone()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const mediumBuffer = await pipeline
    .clone()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumbBuffer = await pipeline
    .clone()
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const assetId = createId();
  const baseKey = `public/${input.folder}/${assetId}`;
  const fullKey = `${baseKey}.webp`;
  const medKey = `${baseKey}-med.webp`;
  const thumbKey = `${baseKey}-thumb.webp`;

  if (input.mode === "s3" && s3) {
    await Promise.all([
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: fullKey,
          Body: fullProcessed.data,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: medKey,
          Body: mediumBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
    ]);
    await deleteStagedObject(input.tempKey, "s3", s3);

    const cdn = env.NEXT_PUBLIC_IMAGE_CDN_URL.replace(/\/$/, "");
    return {
      storageKey: fullKey,
      url: `${cdn}/${fullKey}`,
      mediumUrl: `${cdn}/${medKey}`,
      thumbUrl: `${cdn}/${thumbKey}`,
      width: fullProcessed.info.width,
      height: fullProcessed.info.height,
    };
  }

  // Persist processed assets locally under public/uploads/{folder}/
  const localSubdir = path.join(PUBLIC_LOCAL_DIR, input.folder);
  await mkdir(localSubdir, { recursive: true });
  await Promise.all([
    writeFile(path.join(localSubdir, `${assetId}.webp`), fullProcessed.data),
    writeFile(path.join(localSubdir, `${assetId}-med.webp`), mediumBuffer),
    writeFile(path.join(localSubdir, `${assetId}-thumb.webp`), thumbBuffer),
  ]);
  await deleteStagedObject(input.tempKey, "local", null);

  return {
    storageKey: fullKey,
    url: `/uploads/${input.folder}/${assetId}.webp`,
    mediumUrl: `/uploads/${input.folder}/${assetId}-med.webp`,
    thumbUrl: `/uploads/${input.folder}/${assetId}-thumb.webp`,
    width: fullProcessed.info.width,
    height: fullProcessed.info.height,
  };
}
