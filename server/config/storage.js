import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// ─── Backblaze B2 S3-compatible client ───
const s3 = new S3Client({
  region: 'us-east-005',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET_NAME || 'guru-mobile-hub';

/**
 * Upload a file to B2
 * @param {Buffer} fileBuffer - The file data
 * @param {string} key - Storage path (e.g. "users/uuid/documents/file.pdf")
 * @param {string} mimeType - Content type (e.g. "application/pdf")
 * @returns {string} The storage key
 */
export const uploadToB2 = async (fileBuffer, key, mimeType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3.send(command);
  console.log(`☁️  Uploaded to B2: ${key}`);
  return key;
};

/**
 * Generate a presigned download URL (expires in 1 hour)
 * @param {string} key - Storage path
 * @param {number} expiresIn - URL lifetime in seconds (default: 3600 = 1 hour)
 * @returns {string} Temporary signed URL
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3, command, { expiresIn });
  return url;
};

/**
 * Delete a file from B2
 * @param {string} key - Storage path
 */
export const deleteFromB2 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3.send(command);
    console.log(`🗑️  Deleted from B2: ${key}`);
  } catch (err) {
    console.error(`Failed to delete from B2: ${key}`, err);
  }
};

export default s3;
