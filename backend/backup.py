import os
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import quote_plus
import boto3
from botocore.exceptions import NoCredentialsError

# Load environment variables (injected via GitHub Actions secrets)
DATABASE_URL = os.getenv("DATABASE_URL")
DB_PASSWORD = os.getenv("DB_PASSWORD")
PROJECT_REF = os.getenv("PROJECT_REF")
BUCKET_NAME = os.getenv("BACKUP_BUCKET_NAME")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")  # Optional: for Cloudflare R2 / DigitalOcean Spaces
AWS_REGION = os.getenv("AWS_REGION", "auto")
KEEP_LOCAL_DUMP = os.getenv("KEEP_LOCAL_DUMP", "false").lower() == "true"


def get_db_url() -> str:
    if DATABASE_URL:
        return DATABASE_URL
    if not DB_PASSWORD or not PROJECT_REF:
        print("❌ Missing database configuration. Set DATABASE_URL or both DB_PASSWORD and PROJECT_REF.")
        sys.exit(1)
    encoded_password = quote_plus(DB_PASSWORD)
    return f"postgresql://postgres:{encoded_password}@db.{PROJECT_REF}.supabase.co:5432/postgres"


def run_backup():
    db_url = get_db_url()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"supabase_backup_{timestamp}.dump"

    print(f"📦 Starting database dump: {filename}...")

    # 1. Run pg_dump via shell execution
    try:
        subprocess.run(
            [
                "pg_dump",
                db_url,
                "--clean",
                "--if-exists",
                "--no-owner",
                "--format=custom",
                f"--file={filename}",
            ],
            check=True,
        )
        print("✅ Database dump completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"❌ pg_dump failed: {e}")
        sys.exit(1)

    # 2. Upload to Cloud Storage using boto3 (if BUCKET_NAME is configured)
    if BUCKET_NAME:
        print(f"🚀 Uploading {filename} to storage bucket '{BUCKET_NAME}'...")
        try:
            client_kwargs = {}
            if S3_ENDPOINT_URL:
                client_kwargs["endpoint_url"] = S3_ENDPOINT_URL
            if AWS_REGION:
                client_kwargs["region_name"] = AWS_REGION

            s3_client = boto3.client("s3", **client_kwargs)
            s3_client.upload_file(filename, BUCKET_NAME, filename)
            print(f"🎉 Backup successfully uploaded to {BUCKET_NAME}/{filename}!")
        except NoCredentialsError:
            print("❌ Cloud storage credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) not found.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Upload failed: {e}")
            sys.exit(1)

        # 3. Clean up the local file unless KEEP_LOCAL_DUMP is enabled (e.g. for GitHub Actions artifact upload)
        if not KEEP_LOCAL_DUMP and os.path.exists(filename):
            os.remove(filename)
            print("🧹 Local backup file cleaned up.")
    else:
        print(f"ℹ️ BACKUP_BUCKET_NAME not set; keeping local dump file: {filename}")


if __name__ == "__main__":
    run_backup()
