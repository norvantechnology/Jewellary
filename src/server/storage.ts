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
import {
  IMAGE_QUALITY_BUDGETS,
  type ResponsiveVariantSet,
  buildSeoImageStem,
} from "@/lib/seo/images";
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

let cachedS3Client: S3Client | null | undefined;
let cachedS3Signature: string | null = null;
let s3ReachabilityCache: { endpoint: string; reachable: boolean; expiresAt: number } | null = null;

export function getS3Client(): S3Client | null {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_ENDPOINT) {
    return null;
  }
  const sig = `${env.S3_REGION}:${env.S3_ENDPOINT}:${env.S3_ACCESS_KEY_ID}`;
  if (cachedS3Client && cachedS3Signature === sig) {
    return cachedS3Client;
  }
  cachedS3Signature = sig;
  cachedS3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cachedS3Client;
}

export async function isS3Reachable(client: S3Client): Promise<boolean> {
  if (!env.S3_ENDPOINT) return false;
  // In non-localhost endpoints (real R2/S3), assume configured endpoint is reachable.
  const endpointUrl = new URL(env.S3_ENDPOINT);
  if (endpointUrl.hostname !== "localhost" && endpointUrl.hostname !== "127.0.0.1") {
    return true;
  }
  const now = Date.now();
  if (
    s3ReachabilityCache &&
    s3ReachabilityCache.endpoint === env.S3_ENDPOINT &&
    s3ReachabilityCache.expiresAt > now
  ) {
    return s3ReachabilityCache.reachable && Boolean(client);
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 350);
    await fetch(env.S3_ENDPOINT, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    s3ReachabilityCache = { endpoint: env.S3_ENDPOINT, reachable: true, expiresAt: now + 30_000 };
    return Boolean(client);
  } catch {
    s3ReachabilityCache = { endpoint: env.S3_ENDPOINT, reachable: false, expiresAt: now + 30_000 };
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

export interface ImageSeoUploadMetadata {
  slug?: string;
  productName?: string;
  metal?: string;
  carat?: string;
  viewType?: string;
  copyrightNotice?: string;
}

export async function processAndPersistImageUpload(input: {
  tempKey: string;
  folder: UploadFolder;
  mode: "s3" | "local";
  seo?: ImageSeoUploadMetadata;
}): Promise<{
  storageKey: string;
  url: string;
  mediumUrl: string;
  thumbUrl: string;
  avifUrl: string;
  jpegUrl: string;
  responsiveVariants: ResponsiveVariantSet;
  warnings: string[];
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

  const copyrightText =
    input.seo?.copyrightNotice?.trim() ||
    `© ${new Date().getFullYear()} ${env.NEXT_PUBLIC_SITE_NAME}`;

  // Strip GPS/camera EXIF while preserving ICC profile & writing copyright notice
  const basePipeline = sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .keepIccProfile()
    .withExif({
      IFD0: {
        Copyright: copyrightText,
        Artist: env.NEXT_PUBLIC_SITE_NAME,
      },
    });

  const sourceMeta = await basePipeline.clone().metadata();
  const origWidth = sourceMeta.width ?? 1200;
  const origHeight = sourceMeta.height ?? 1200;
  const longEdge = Math.max(origWidth, origHeight);

  const warnings: string[] = [];
  if (longEdge < IMAGE_QUALITY_BUDGETS.warningMinEdgePx) {
    warnings.push(
      `Image resolution (${origWidth}×${origHeight}px) is below 800px; upload >= 1200px for crisp zoom and Google Shopping.`,
    );
  } else if (longEdge < IMAGE_QUALITY_BUDGETS.recommendedMinEdgePx) {
    warnings.push(
      `Image resolution (${origWidth}×${origHeight}px) is under the recommended 1200px long edge.`,
    );
  }

  const hashSuffix = createId().slice(0, 8);
  const seoStem = buildSeoImageStem({
    slug: input.seo?.slug,
    productName: input.seo?.productName,
    metal: input.seo?.metal,
    carat: input.seo?.carat,
    viewType: input.seo?.viewType,
    hashSuffix,
  });

  const [fullWebp, mediumBuffer, thumbBuffer, fullAvif, fullJpeg] = await Promise.all([
    basePipeline
      .clone()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true }),
    basePipeline
      .clone()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    basePipeline
      .clone()
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
    basePipeline
      .clone()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .avif({ quality: 58, effort: 2 })
      .toBuffer(),
    basePipeline
      .clone()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer(),
  ]);

  if (fullAvif.byteLength > IMAGE_QUALITY_BUDGETS.heroAvifMaxBytes) {
    warnings.push(
      `AVIF hero payload is ${Math.round(fullAvif.byteLength / 1024)} KB (budget <= 200 KB).`,
    );
  }

  // Extra per-width copies (320..2000px) are not used by the storefront (images are resized on
  // the fly), and encoding ~16 more files made each upload take many seconds. Kept off.
  const targetWidths: number[] = [];
  const extraFiles: Array<{
    filename: string;
    key: string;
    body: Buffer;
    contentType: string;
    width: number;
    fmt: "avif" | "webp" | "jpeg";
  }> = [];

  await Promise.all(
    targetWidths.map(async (targetW) => {
      const [wBuf, aBuf] = await Promise.all([
        basePipeline
          .clone()
          .resize(targetW, targetW, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer(),
        basePipeline
          .clone()
          .resize(targetW, targetW, { fit: "inside", withoutEnlargement: true })
          .avif({ quality: 55, effort: 2 })
          .toBuffer(),
      ]);
      extraFiles.push(
        {
          filename: `${seoStem}-${targetW}w.webp`,
          key: `public/${input.folder}/${seoStem}-${targetW}w.webp`,
          body: wBuf,
          contentType: "image/webp",
          width: targetW,
          fmt: "webp",
        },
        {
          filename: `${seoStem}-${targetW}w.avif`,
          key: `public/${input.folder}/${seoStem}-${targetW}w.avif`,
          body: aBuf,
          contentType: "image/avif",
          width: targetW,
          fmt: "avif",
        },
      );
    }),
  );

  const baseKey = `public/${input.folder}/${seoStem}`;
  const fullKey = `${baseKey}.webp`;
  const medKey = `${baseKey}-med.webp`;
  const thumbKey = `${baseKey}-thumb.webp`;
  const avifKey = `${baseKey}.avif`;
  const jpegKey = `${baseKey}.jpg`;

  const makePublicUrl = (key: string, filename: string) => {
    if (input.mode === "s3" && s3) {
      const cdn = env.NEXT_PUBLIC_IMAGE_CDN_URL.replace(/\/$/, "");
      return `${cdn}/${key}`;
    }
    return `/uploads/${input.folder}/${filename}`;
  };

  if (input.mode === "s3" && s3) {
    await Promise.all([
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: fullKey,
          Body: fullWebp.data,
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
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: avifKey,
          Body: fullAvif,
          ContentType: "image/avif",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: jpegKey,
          Body: fullJpeg,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
      ...extraFiles.map((item) =>
        s3.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: item.key,
            Body: item.body,
            ContentType: item.contentType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        ),
      ),
    ]);
    await deleteStagedObject(input.tempKey, "s3", s3);
  } else {
    const localSubdir = path.join(PUBLIC_LOCAL_DIR, input.folder);
    await mkdir(localSubdir, { recursive: true });
    await Promise.all([
      writeFile(path.join(localSubdir, `${seoStem}.webp`), fullWebp.data),
      writeFile(path.join(localSubdir, `${seoStem}-med.webp`), mediumBuffer),
      writeFile(path.join(localSubdir, `${seoStem}-thumb.webp`), thumbBuffer),
      writeFile(path.join(localSubdir, `${seoStem}.avif`), fullAvif),
      writeFile(path.join(localSubdir, `${seoStem}.jpg`), fullJpeg),
      ...extraFiles.map((item) => writeFile(path.join(localSubdir, item.filename), item.body)),
    ]);
    await deleteStagedObject(input.tempKey, "local", null);
  }

  const widthsMap: ResponsiveVariantSet["widths"] = {};
  for (const item of extraFiles) {
    const k = String(item.width);
    if (!widthsMap[k]) widthsMap[k] = {};
    widthsMap[k][item.fmt] = makePublicUrl(item.key, item.filename);
  }

  return {
    storageKey: fullKey,
    url: makePublicUrl(fullKey, `${seoStem}.webp`),
    mediumUrl: makePublicUrl(medKey, `${seoStem}-med.webp`),
    thumbUrl: makePublicUrl(thumbKey, `${seoStem}-thumb.webp`),
    avifUrl: makePublicUrl(avifKey, `${seoStem}.avif`),
    jpegUrl: makePublicUrl(jpegKey, `${seoStem}.jpg`),
    responsiveVariants: {
      widths: widthsMap,
      seoFilenameStem: seoStem,
      byteSizes: {
        avif: fullAvif.byteLength,
        webp: fullWebp.data.byteLength,
        jpeg: fullJpeg.byteLength,
      },
    },
    warnings,
    width: fullWebp.info.width,
    height: fullWebp.info.height,
  };
}

function resolvePublicRelativePath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/")) return null;
  const cleaned = path.posix.normalize(url).replace(/^\/+/, "");
  if (cleaned.includes("..") || cleaned.startsWith(".")) return null;
  if (!cleaned.startsWith("uploads/") && !cleaned.startsWith("images/")) {
    return null;
  }
  return path.join(process.cwd(), "public", cleaned);
}

async function readSourceImageBytes(input: {
  storageKey?: string | null;
  url: string;
}): Promise<Buffer | null> {
  const localPath = resolvePublicRelativePath(input.url);
  if (localPath) {
    try {
      return await readFile(localPath);
    } catch {
      // Fallback below
    }
  }

  const s3 = getS3Client();
  if (s3 && input.storageKey && (await isS3Reachable(s3))) {
    try {
      const safeKey = assertSafeKey(input.storageKey);
      const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: safeKey }));
      if (res.Body) {
        return Buffer.from(await res.Body.transformToByteArray());
      }
    } catch (err) {
      logger.warn({ storageKey: input.storageKey, err }, "Failed reading S3 asset for copy");
    }
  }

  return null;
}

/**
 * Duplicates a product image object under a fresh storage key so deleting either product
 * never breaks or removes the other product's assets.
 */
export async function copyImageAsset(input: {
  storageKey?: string | null;
  url: string;
  mediumUrl?: string | null;
  thumbUrl?: string | null;
  folder: UploadFolder;
  width: number;
  height: number;
}): Promise<{
  storageKey: string;
  url: string;
  mediumUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
}> {
  const sourceBytes = await readSourceImageBytes({
    storageKey: input.storageKey,
    url: input.url,
  });

  if (!sourceBytes) {
    // Fallback if external CDN URL or missing seed binary in CI
    const syntheticKey = `copy/${input.folder}/${createId()}`;
    return {
      storageKey: syntheticKey,
      url: input.url,
      mediumUrl: input.mediumUrl ?? input.url,
      thumbUrl: input.thumbUrl ?? input.mediumUrl ?? input.url,
      width: input.width,
      height: input.height,
    };
  }

  const pipeline = sharp(sourceBytes, { limitInputPixels: 40_000_000 }).rotate();
  const fullProcessed = await pipeline
    .clone()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const [mediumBuffer, thumbBuffer] = await Promise.all([
    pipeline
      .clone()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    pipeline
      .clone()
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  ]);

  const assetId = createId();
  const baseKey = `public/${input.folder}/${assetId}`;
  const fullKey = `${baseKey}.webp`;
  const medKey = `${baseKey}-med.webp`;
  const thumbKey = `${baseKey}-thumb.webp`;

  const s3 = getS3Client();
  if (s3 && (await isS3Reachable(s3))) {
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

  const localSubdir = path.join(PUBLIC_LOCAL_DIR, input.folder);
  await mkdir(localSubdir, { recursive: true });
  await Promise.all([
    writeFile(path.join(localSubdir, `${assetId}.webp`), fullProcessed.data),
    writeFile(path.join(localSubdir, `${assetId}-med.webp`), mediumBuffer),
    writeFile(path.join(localSubdir, `${assetId}-thumb.webp`), thumbBuffer),
  ]);

  return {
    storageKey: fullKey,
    url: `/uploads/${input.folder}/${assetId}.webp`,
    mediumUrl: `/uploads/${input.folder}/${assetId}-med.webp`,
    thumbUrl: `/uploads/${input.folder}/${assetId}-thumb.webp`,
    width: fullProcessed.info.width,
    height: fullProcessed.info.height,
  };
}

/** Storage keys the app created and may delete (admin uploads and imported product photos). */
export function isDeletableStorageKey(key: string): boolean {
  return /^(public|products)\//.test(key) && !key.includes("..");
}

/**
 * Turns a public image URL back into its storage key, or null when the URL isn't in our bucket.
 */
export function storageKeyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const cdn = env.NEXT_PUBLIC_IMAGE_CDN_URL?.replace(/\/$/, "");
  let key: string | null = null;
  if (cdn && url.startsWith(`${cdn}/`)) key = url.slice(cdn.length + 1);
  else {
    const m = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/.exec(url);
    if (m) key = m[1]!;
  }
  if (!key) return null;
  key = decodeURIComponent(key.split("?")[0]!);
  // Point at the master file even when given a -med/-thumb/avif/jpg URL.
  return key.replace(/(-med|-thumb)?\.(webp|avif|jpe?g|png)$/i, ".webp");
}

/**
 * Deletes uploaded product assets from local storage or S3 (preserving shared /images/seed assets).
 */
export async function deleteImageAssets(
  assets: Array<{
    storageKey?: string | null;
    url: string;
    mediumUrl?: string | null;
    thumbUrl?: string | null;
  }>,
): Promise<void> {
  if (assets.length === 0) return;
  const s3 = getS3Client();
  const s3Enabled = s3 ? await isS3Reachable(s3) : false;

  const diskDeletes: Array<Promise<void>> = [];
  const s3Keys: string[] = [];

  for (const asset of assets) {
    // Remove own local uploads (never delete shared /images/seed/ demo fixtures)
    const localBase = asset.url.startsWith("/uploads/") ? asset.url.replace(/\.webp$/i, "") : null;
    const localCandidates = [
      asset.url,
      asset.mediumUrl,
      asset.thumbUrl,
      ...(localBase ? [`${localBase}.avif`, `${localBase}.jpg`] : []),
    ];
    for (const candidateUrl of localCandidates) {
      if (!candidateUrl || !candidateUrl.startsWith("/uploads/")) continue;
      const diskPath = resolvePublicRelativePath(candidateUrl);
      if (diskPath) {
        diskDeletes.push(
          rm(diskPath, { force: true }).catch((err) => {
            logger.warn({ diskPath, err }, "Failed to remove local image variant");
          }),
        );
      }
    }

    // Admin uploads live under public/, imported catalogue photos under products/.
    if (s3 && s3Enabled && asset.storageKey && isDeletableStorageKey(asset.storageKey)) {
      const safeKey = assertSafeKey(asset.storageKey);
      const base = safeKey.replace(/\.webp$/i, "");
      s3Keys.push(safeKey, `${base}-med.webp`, `${base}-thumb.webp`, `${base}.avif`, `${base}.jpg`);
    }
  }

  await Promise.all([
    ...diskDeletes,
    ...(s3
      ? s3Keys.map((key) =>
          s3
            .send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
            .catch((err) => logger.warn({ key, err }, "Failed removing S3 image variant")),
        )
      : []),
  ]);
}
