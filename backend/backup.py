import os
import subprocess
from datetime import datetime
import boto3
from botocore.exceptions import NoCredentialsError

# Load environment variables
DB_PASSWORD = os.getenv("DB_PASSWORD")
PROJECT_REF = os.getenv("PROJECT_REF")
BUCKET_NAME = os.getenv("BACKUP_BUCKET_NAME")

# Construct connection string
DB_URL = f"postgresql://postgres:{DB_PASSWORD}@db.{PROJECT_REF}.supabase.co:5432/postgres"

def run_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"supabase_backup_{timestamp}.dump"
    
    print(f"📦 Starting database dump: {filename}...")
    
    # 1. Run pg_dump via shell execution
    try:
        subprocess.run(
            ["pg_dump", DB_URL, "--clean", "--if-exists", "--no-owner", "--format=custom", f"--file={filename}"],
            check=True
        )
        print("✅ Database dump completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"❌ pg_dump failed: {e}")
        return

    # 2. Upload to Cloud Storage using boto3
    print(f"🚀 Uploading {filename} to storage bucket...")
    try:
        # Boto3 automatically picks up AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
        s3_client = boto3.client('s3')
        s3_client.upload_file(filename, BUCKET_NAME, filename)
        print(f"🎉 Backup successfully uploaded to {BUCKET_NAME}!")
        
        # 3. Clean up the local file
        os.remove(filename)
        print("🧹 Local backup file cleaned up.")
        
    except NoCredentialsError:
        print("❌ Cloud storage credentials not found.")
    except Exception as e:
        print(f"❌ Upload failed: {e}")

if __name__ == "__main__":
    run_backup()

