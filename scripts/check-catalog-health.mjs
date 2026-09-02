import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const REQUIRE_R2 = process.argv.includes('--require-r2');
const CATALOG_PATH = new URL('../public/saved-sounds.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const files = Array.isArray(catalog.files) ? catalog.files : [];

let malformed = 0;
let oldPrefix = 0;
let duplicateNames = 0;
let duplicateFiles = 0;
const names = new Set();
const paths = new Set();

for (const sound of files) {
  if (!sound?.name || !sound?.type || !sound?.file || !Array.isArray(sound?.keywords)) malformed += 1;
  if (String(sound?.file || '').startsWith('Saved sounds/')) oldPrefix += 1;
  const nameKey = String(sound?.name || '').trim().toLowerCase();
  const fileKey = String(sound?.file || '').trim().toLowerCase();
  if (nameKey && names.has(nameKey)) duplicateNames += 1;
  if (fileKey && paths.has(fileKey)) duplicateFiles += 1;
  if (nameKey) names.add(nameKey);
  if (fileKey) paths.add(fileKey);
}

const result = {
  total: files.length,
  malformed,
  oldPrefix,
  duplicateNames,
  duplicateFiles,
};

let r2Failure = 0;
if (REQUIRE_R2) {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missingEnv = required.filter((name) => !process.env[name]);
  if (missingEnv.length) {
    console.error(`Missing R2 env for --require-r2: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  const bucket = process.env.R2_BUCKET_NAME || 'cueai-media';
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  for (const sound of files) {
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: sound.file }));
    } catch {
      r2Failure += 1;
      console.error(`Missing R2 object: ${sound.file}`);
    }
  }
  result.r2Missing = r2Failure;
}

console.log(JSON.stringify(result, null, 2));

if (malformed || oldPrefix || duplicateNames || duplicateFiles || r2Failure) {
  process.exit(1);
}
