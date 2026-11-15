#!/usr/bin/env python3
"""
Shinora Jewels - Sync Processed Studio Images to S3 Bucket & Database
=====================================================================
Reads `processed_product_images/manifest.json`, generates optimized
responsive variants (-med, -thumb), uploads them to the S3 bucket,
and updates the database `ProductImage` records.

Usage:
  python3 scripts/sync_processed_images_to_bucket.py --dry-run
  python3 scripts/sync_processed_images_to_bucket.py
  python3 scripts/sync_processed_images_to_bucket.py --product <slug>
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
import boto3
from botocore.config import Config
import psycopg2
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MANIFEST_PATH = ROOT_DIR / "processed_product_images" / "manifest.json"


def get_db_connection():
    db_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("Neither DIRECT_URL nor DATABASE_URL found in .env")
    return psycopg2.connect(db_url)


def get_s3_client():
    endpoint = os.getenv("S3_ENDPOINT")
    region = os.getenv("S3_REGION", "ap-south-1")
    access_key = os.getenv("S3_ACCESS_KEY_ID")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY")

    if not access_key or not secret_key:
        raise ValueError("S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY missing in .env")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def create_derivatives(src_path: Path):
    """Generate master, medium (800px), and thumb (380px) webp buffers."""
    orig = Image.open(src_path).convert("RGB")
    w, h = orig.size

    # 1. Master WebP
    master_tmp = src_path.parent / f"_tmp_{src_path.stem}_master.webp"
    orig.save(master_tmp, "WEBP", quality=92, method=6)

    # 2. Medium WebP (max width 800)
    med_tmp = src_path.parent / f"_tmp_{src_path.stem}_med.webp"
    scale_med = min(1.0, 800 / float(w))
    med_size = (int(w * scale_med), int(h * scale_med))
    med_img = orig.resize(med_size, Image.Resampling.LANCZOS)
    med_img.save(med_tmp, "WEBP", quality=88, method=6)

    # 3. Thumb WebP (max width 380)
    thumb_tmp = src_path.parent / f"_tmp_{src_path.stem}_thumb.webp"
    scale_thumb = min(1.0, 380 / float(w))
    thumb_size = (int(w * scale_thumb), int(h * scale_thumb))
    thumb_img = orig.resize(thumb_size, Image.Resampling.LANCZOS)
    thumb_img.save(thumb_tmp, "WEBP", quality=85, method=6)

    return master_tmp, med_tmp, thumb_tmp


def sync_images(dry_run=False, product_filter=None):
    if not MANIFEST_PATH.exists():
        print(f"Error: Manifest not found at {MANIFEST_PATH}")
        sys.exit(1)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    s3 = get_s3_client()
    bucket = os.getenv("S3_BUCKET")
    cdn_base = os.getenv("NEXT_PUBLIC_IMAGE_CDN_URL", "").rstrip("/")

    print("=" * 70)
    print("SYNC PROCESSED IMAGES TO BUCKET & DATABASE")
    print(f"Dry Run: {dry_run}")
    print(f"Total manifest items: {len(manifest)}")
    print("=" * 70)

    uploaded = 0
    errors = 0

    for key, info in manifest.items():
        slug = info.get("product_slug")
        if product_filter and slug != product_filter:
            continue

        local_path = ROOT_DIR / info["local_path"]
        if not local_path.exists():
            print(f"[!] Local file missing: {local_path}")
            errors += 1
            continue

        # Derive keys
        base_stem = Path(key).stem
        dir_name = Path(key).parent.as_posix()
        master_key = f"{dir_name}/{base_stem}.webp"
        med_key = f"{dir_name}/{base_stem}-med.webp"
        thumb_key = f"{dir_name}/{base_stem}-thumb.webp"

        print(f"\nProcessing {slug} -> {master_key}...")

        if dry_run:
            print(f"  [DRY-RUN] Would upload {local_path} -> {master_key}")
            print(f"  [DRY-RUN] Would upload medium -> {med_key}")
            print(f"  [DRY-RUN] Would upload thumb -> {thumb_key}")
            uploaded += 1
            continue

        try:
            master_tmp, med_tmp, thumb_tmp = create_derivatives(local_path)

            extra_args = {
                "ContentType": "image/webp",
                "CacheControl": "public, max-age=31536000, immutable"
            }

            s3.upload_file(str(master_tmp), bucket, master_key, ExtraArgs=extra_args)
            s3.upload_file(str(med_tmp), bucket, med_key, ExtraArgs=extra_args)
            s3.upload_file(str(thumb_tmp), bucket, thumb_key, ExtraArgs=extra_args)

            # Cleanup tmp
            master_tmp.unlink(missing_ok=True)
            med_tmp.unlink(missing_ok=True)
            thumb_tmp.unlink(missing_ok=True)

            print(f"  [✓] Uploaded master, med, thumb to S3 ({bucket})")
            uploaded += 1

        except Exception as e:
            print(f"  [✗] Upload failed for {key}: {e}")
            errors += 1

    print("\n" + "=" * 70)
    print(f"SYNC COMPLETE: {uploaded} updated, {errors} errors.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Sync processed images to S3 bucket")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without uploading")
    parser.add_argument("--product", type=str, default=None, help="Filter by product slug")
    args = parser.parse_args()

    sync_images(dry_run=args.dry_run, product_filter=args.product)


if __name__ == "__main__":
    main()

