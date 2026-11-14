#!/usr/bin/env python3
"""
Maison Aurelia - High-Fidelity AI Jewelry Image Transformation Pipeline
========================================================================
- Exclusively uses Generative AI (Gemini Flash Image model / Imagen) for 100% accurate
  jewelry geometry preservation, complete watermark/logo removal, and photorealistic studio lighting.
- Reads credentials from .env:
    * S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
    * DATABASE_URL or DIRECT_URL (for dynamic category routing)
    * GEMINI_API_KEY (Google AI Studio API key)
- Automatically deletes temporary raw files immediately after each image is processed.
- Maintains `processed_product_images/manifest.json` for 1:1 S3 bucket synchronization.

Usage:
    python3 scripts/process_product_images.py
    python3 scripts/process_product_images.py --category engagement-rings
    python3 scripts/process_product_images.py --product 1-8-ct-heart-moissanite-engagement-ring
    python3 scripts/process_product_images.py --limit 10
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
import boto3
import psycopg2
from PIL import Image

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

OUTPUT_ROOT = ROOT_DIR / "processed_product_images"
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
TEMP_DIR = ROOT_DIR / ".temp_ai_processing"


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


def load_category_product_map():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.slug, p.name, c.slug as category_slug, c.name as category_name, c.path as category_path
            FROM "Product" p
            JOIN "Category" c ON p."categoryId" = c.id;
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        mapping = {}
        for slug, name, cat_slug, cat_name, cat_path in rows:
            mapping[slug] = {
                "name": name,
                "category_slug": cat_slug,
                "category_name": cat_name,
                "category_path": cat_path
            }
        return mapping
    except Exception as e:
        print(f"[!] Warning: Category lookup failed ({e}). Defaulting to slug.")
        return {}


def load_manifest():
    if MANIFEST_PATH.exists():
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_manifest(manifest):
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def process_with_ai(raw_image_path: Path, output_path: Path, product_name: str) -> bool:
    """
    Transforms product image using Generative AI model:
    - Eliminates human hands, skin, fingers, necks, and noisy backgrounds entirely.
    - Eliminates all text watermarks ('GianGemco') and corner watermark logos ('GG').
    - Strictly preserves the complete continuous ring band, center and side stones,
      facet brilliance, and metal reflections.
    - Renders realistic studio 3-point lighting and soft contact drop shadow.
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        print("  [!] Error: GEMINI_API_KEY is missing in .env. Please add a valid Google AI Studio API key.")
        return False

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)
        img = Image.open(raw_image_path)

        prompt = (
            f"Professional commercial fine jewelry product photograph of {product_name}. "
            "STRICT REQUIREMENTS (DO NOT DEVIATE): "
            "1. PRESERVE THE ENTIRE JEWELRY PIECE: Keep the entire solid ring band completely intact and unbroken. "
            "Do NOT cut off or erase any part of the gold or platinum band. Keep the center gemstone, cuts, facets, "
            "prongs, and side accent stones 100% faithful to the original reference photo. "
            "2. COMPLETE REMOVAL: Remove the human hand, fingers, skin, palm, neck, and any background clutter completely. "
            "3. ZERO WATERMARKS: Completely erase and eliminate all text watermarks ('GianGemco', brand names) "
            "and all corner logos ('GG' watermark logo in bottom corner). Leave no trace of text or logos. "
            "4. LUXURY STUDIO PRESENTATION: Place the piece centered, resting or standing naturally on a seamless luxury "
            "pure white studio surface with professional studio three-point lighting, a soft realistic contact shadow, "
            "and delicate diffuse reflection beneath the setting."
        )

        # Generate image using Flash Image / Imagen model
        response = client.models.generate_content(
            model="gemini-3.1-flash-image",
            contents=[img, prompt],
        )

        for part in response.candidates[0].content.parts:
            if hasattr(part, "inline_data") and part.inline_data:
                import io
                out_img = Image.open(io.BytesIO(part.inline_data.data))
                output_path.parent.mkdir(parents=True, exist_ok=True)
                out_img.convert("RGB").save(output_path, "WEBP", quality=95)
                return True

        print("  [!] Model response did not contain inline image bytes.")
        return False

    except Exception as e:
        print(f"  [!] AI Generation error: {e}")
        return False


def run_pipeline(limit=None, category_filter=None, product_filter=None):
    print("=" * 75)
    print("MAISON AURELIA - AI JEWELRY STUDIO TRANSFORMATION PIPELINE")
    print("=" * 75)

    db_map = load_category_product_map()
    s3 = get_s3_client()
    bucket = os.getenv("S3_BUCKET")
    manifest = load_manifest()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    print(f"S3 Bucket: {bucket}")
    print(f"Output Root: {OUTPUT_ROOT}")
    print(f"Total Products in DB: {len(db_map)}")

    # Scan bucket
    print("\nScanning bucket for master product images...")
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=bucket, Prefix="products/")

    tasks = []
    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if "-thumb." in key or "-med." in key:
                continue
            if not key.endswith((".webp", ".jpg", ".jpeg", ".png")):
                continue

            parts = key.split("/")
            if len(parts) >= 3:
                slug = parts[1]
                filename = parts[2]

                prod_info = db_map.get(slug, {})
                cat_slug = prod_info.get("category_slug", "uncategorized")

                if category_filter and cat_slug != category_filter:
                    continue

                if product_filter and slug != product_filter:
                    continue

                tasks.append({
                    "key": key,
                    "slug": slug,
                    "filename": filename,
                    "category_slug": cat_slug,
                    "product_name": prod_info.get("name", slug.replace("-", " ").title()),
                    "category_name": prod_info.get("category_name", "Uncategorized"),
                    "category_path": prod_info.get("category_path", "uncategorized"),
                    "size": obj["Size"]
                })

    print(f"Total master images queued: {len(tasks)}")

    if limit and limit > 0:
        tasks = tasks[:limit]
        print(f"Limit applied: processing first {limit} images.")

    processed_count = 0
    skipped_count = 0
    error_count = 0

    for i, item in enumerate(tasks, 1):
        key = item["key"]
        slug = item["slug"]
        filename = item["filename"]
        cat_slug = item["category_slug"]
        prod_name = item["product_name"]

        dest_path = OUTPUT_ROOT / cat_slug / slug / filename

        if key in manifest and dest_path.exists():
            skipped_count += 1
            continue

        print(f"[{i}/{len(tasks)}] Processing {cat_slug}/{slug}/{filename} with AI...")

        # Download single raw file to temp
        temp_file = TEMP_DIR / f"temp_{slug}_{filename}"
        try:
            s3.download_file(bucket, key, str(temp_file))
        except Exception as e:
            print(f"  [!] S3 download failed ({key}): {e}")
            error_count += 1
            continue

        # AI Transformation
        success = process_with_ai(temp_file, dest_path, prod_name)

        # IMMEDIATELY delete temp file after processing 1 image
        if temp_file.exists():
            temp_file.unlink(missing_ok=True)

        if success:
            manifest[key] = {
                "s3_key": key,
                "product_slug": slug,
                "product_name": prod_name,
                "category_slug": cat_slug,
                "category_name": item["category_name"],
                "category_path": item["category_path"],
                "local_path": str(dest_path.relative_to(ROOT_DIR)),
                "status": "completed",
                "processed_at": datetime.utcnow().isoformat() + "Z"
            }
            save_manifest(manifest)
            processed_count += 1
            print(f"  [✓] AI Generated & Saved -> {dest_path.relative_to(ROOT_DIR)}")
        else:
            error_count += 1
            print(f"  [✗] Failed to generate {filename}")

    # Remove temp directory if empty
    try:
        TEMP_DIR.rmdir()
    except Exception:
        pass

    print("\n" + "=" * 75)
    print("PIPELINE SUMMARY")
    print(f"Processed: {processed_count} | Skipped: {skipped_count} | Errors: {error_count}")
    print(f"Manifest: {MANIFEST_PATH}")
    print("=" * 75)


def main():
    parser = argparse.ArgumentParser(description="Maison Aurelia AI Jewelry Image Pipeline")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of images")
    parser.add_argument("--category", type=str, default=None, help="Category slug")
    parser.add_argument("--product", type=str, default=None, help="Product slug")
    args = parser.parse_args()

    run_pipeline(limit=args.limit, category_filter=args.category, product_filter=args.product)


if __name__ == "__main__":
    main()
