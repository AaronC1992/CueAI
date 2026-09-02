import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

let _r2;
const r2 = () => (_r2 ??= getR2Client());

const BUCKET = () => process.env.R2_BUCKET_NAME || 'SuiteRhythm-sounds';

// Catalog sounds are never mutated in place, so they can be cached forever.
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function hasR2Config() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

/** Get a short-lived presigned download URL for a sound file */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(r2(), command, { expiresIn });
}

/** Get a short-lived presigned upload URL for direct browser-to-R2 uploads */
export async function getPresignedUploadUrl(key, contentType = 'application/octet-stream', expiresIn = 900) {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2(), command, { expiresIn });
}

/** Download an R2 object into a Buffer */
export async function downloadFileBuffer(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  const result = await r2().send(command);
  return streamToBuffer(result.Body);
}

/** Upload a file buffer to R2 */
export async function uploadFile(key, body, contentType = 'audio/mpeg', cacheControl = IMMUTABLE_CACHE_CONTROL) {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });
  return r2().send(command);
}

/** Delete a file from R2 */
export async function deleteFile(key) {
  const command = new DeleteObjectCommand({ Bucket: BUCKET(), Key: key });
  return r2().send(command);
}

/** List all objects under an optional prefix */
export async function listFiles(prefix = '') {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET(),
    Prefix: prefix,
  });
  const result = await r2().send(command);
  return (result.Contents ?? []).map(obj => ({ key: obj.Key, size: obj.Size }));
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
