import dotenv from 'dotenv';
import fs from 'fs/promises';
import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const OLD_PREFIX = 'Saved sounds/';
const NEW_PREFIX = 'sounds/';
const CATALOG_PATH = new URL('../public/saved-sounds.json', import.meta.url);
const TRIGGER_PATH = new URL('../lib/modules/trigger-system.js', import.meta.url);
const CONCURRENCY = Number(process.env.SOUND_PREFIX_MIGRATION_CONCURRENCY || 8);
const UPDATE_SUPABASE = !process.argv.includes('--skip-supabase');
const DRY_RUN = process.argv.includes('--dry-run');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const bucket = process.env.R2_BUCKET_NAME || 'cueai-media';
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});

function toNewKey(key) {
  return key.startsWith(OLD_PREFIX) ? `${NEW_PREFIX}${key.slice(OLD_PREFIX.length)}` : key;
}

function copySourceFor(key) {
  return `${bucket}/${key}`.split('/').map(encodeURIComponent).join('/');
}

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyIfNeeded(oldKey) {
  const newKey = toNewKey(oldKey);
  if (newKey === oldKey) return { copied: false, skipped: true, oldKey, newKey };
  if (await objectExists(newKey)) return { copied: false, skipped: true, oldKey, newKey };
  if (DRY_RUN) return { copied: false, skipped: false, oldKey, newKey };
  await r2.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: newKey,
    CopySource: copySourceFor(oldKey),
    MetadataDirective: 'COPY',
  }));
  return { copied: true, skipped: false, oldKey, newKey };
}

async function runQueue(items, worker) {
  const queue = [...items];
  const results = [];
  const workers = new Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        results.push(await worker(item));
      } catch (error) {
        results.push({ error, oldKey: item, newKey: toNewKey(item) });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function collectTriggerKeys(source) {
  return [...source.matchAll(/(['"])((?:\\.|(?!\1).)*Saved sounds\/(?:\\.|(?!\1).)*)\1/g)]
    .map((match) => match[2].replaceAll("\\'", "'").replaceAll('\\"', '"'));
}

async function updateSupabase(keys) {
  if (!UPDATE_SUPABASE) return { updated: 0, failed: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { updated: 0, failed: 0, skipped: 'missing Supabase config' };
  if (DRY_RUN) return { updated: 0, failed: 0, dryRun: true };

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let updated = 0;
  let failed = 0;
  for (const oldKey of keys) {
    const { error } = await supabase
      .from('sounds')
      .update({ file: toNewKey(oldKey) })
      .eq('file', oldKey);
    if (error) {
      failed += 1;
      console.warn(`Supabase update failed for ${oldKey}: ${error.message}`);
    } else {
      updated += 1;
    }
  }
  return { updated, failed };
}

const catalogJson = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const triggerSource = await fs.readFile(TRIGGER_PATH, 'utf8');
const catalogKeys = (catalogJson.files || [])
  .map((sound) => sound.file)
  .filter((file) => typeof file === 'string' && file.startsWith(OLD_PREFIX));
const triggerKeys = collectTriggerKeys(triggerSource);
const keys = [...new Set([...catalogKeys, ...triggerKeys])].sort();

console.log(`Migrating ${keys.length} unique R2 keys from ${OLD_PREFIX} to ${NEW_PREFIX}`);
const results = await runQueue(keys, copyIfNeeded);
const failures = results.filter((result) => result.error);
const copied = results.filter((result) => result.copied).length;
const skipped = results.filter((result) => result.skipped).length;
console.log({ copied, skipped, failures: failures.length, dryRun: DRY_RUN });
if (failures.length) {
  for (const failure of failures.slice(0, 20)) {
    console.error(`copy failed: ${failure.oldKey} -> ${failure.newKey}: ${failure.error?.message || failure.error}`);
  }
  process.exitCode = 1;
} else if (!DRY_RUN) {
  for (const sound of catalogJson.files || []) {
    if (typeof sound.file === 'string') sound.file = toNewKey(sound.file);
  }
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalogJson, null, 2) + '\n');
  await fs.writeFile(TRIGGER_PATH, triggerSource.replaceAll(OLD_PREFIX, NEW_PREFIX));
  const supabaseResult = await updateSupabase(catalogKeys);
  console.log({ supabase: supabaseResult });
  console.log('Updated local catalog and trigger map to sounds/.');
}
