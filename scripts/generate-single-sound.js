/**
 * Generate a single sound effect via ElevenLabs, upload to R2, update catalog.
 * Usage: node scripts/generate-single-sound.js
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const sound = {
  name: 'flintlock pistol shot',
  filename: 'flintlock-pistol-shot.mp3',
  prompt: 'A single flintlock pistol shot — sharp crack of black powder igniting, metallic click of the hammer, with a brief echo fading away. Historical pirate-era weapon sound.',
  duration: 3,
  type: 'sfx',
  keywords: ['flintlock', 'pistol', 'gunshot', 'shot', 'pirate', 'weapon'],
};

async function main() {
  if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1); }

  console.log(`Generating: ${sound.name}...`);
  const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sound.prompt, duration_seconds: sound.duration, prompt_influence: 0.4 }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.error(`ElevenLabs error ${resp.status}: ${err}`);
    process.exit(1);
  }

  const audio = Buffer.from(await resp.arrayBuffer());
  console.log(`Generated ${(audio.length / 1024).toFixed(1)} KB`);

  // Upload to R2
  const r2Key = `sounds/${sound.filename}`;
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: r2Key, Body: audio,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`Uploaded to R2: ${r2Key}`);

  // Update catalog
  const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
  const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
  const catalog = catalogJson.files || catalogJson;

  catalog.push({
    type: sound.type,
    name: sound.name,
    file: `sounds/${sound.filename}`,
    keywords: sound.keywords,
  });

  await writeFile(catalogPath, JSON.stringify({ files: catalog }, null, 2));
  console.log(`Catalog updated: ${catalog.length} sounds total`);
  console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
