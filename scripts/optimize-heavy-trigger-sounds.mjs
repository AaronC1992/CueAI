import dotenv from 'dotenv';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const SOURCE_KEYS = [
  'sounds/pirate-tavern-croud.mp3',
  'sounds/footsteps_water.mp3',
  'sounds/heart_beat.mp3',
  'sounds/waves-sea-shore.mp3',
  'sounds/ES_River, Small, Distant Waterfall 02 - Epidemic Sound.mp3',
  'sounds/modern_crowd_cheering.mp3',
  'sounds/fireplace.mp3',
  'sounds/footsteps_wood_stairs.mp3',
  'sounds/ES_Medieval Battlefield, Medium Group, Sword Impacts, Screams, Grunts - Epidemic Sound.mp3',
  'sounds/wind_howl.mp3',
  'sounds/ES_Giant Creature, Roaring - Epidemic Sound.mp3',
  'sounds/phone-ring.mp3',
  'sounds/ES_Wood, 50\'s Gallery Open, Shut - Epidemic Sound.mp3',
  'sounds/rain-on-windows-interior.mp3',
  'sounds/ES_Wohoo, Yay, 7 People 02 - Epidemic Sound.mp3',
  'sounds/ES_Walk On Gravel - Epidemic Sound.mp3',
  'sounds/freesound_community-quick-lightning-strike-29683.mp3',
  'sounds/heart-beep-monitor_dieing-long-beep.mp3',
  'sounds/wind-chimes.mp3',
  'sounds/ES_Hardwood, Female, Heels, Walk 03 - Epidemic Sound.mp3',
  'sounds/bird_whistling_chirping.mp3',
  'sounds/ES_Tiger, Growls, Roars, Several, Intimidated - Epidemic Sound.mp3',
  'sounds/ES_Flames, Large, Movement 01 - Epidemic Sound.mp3',
  'sounds/radio-static.mp3',
  'sounds/dragon-studio-water-dripping-364450.mp3',
];

const TARGET_PREFIX = 'sounds/instant/';
const TARGET_SECONDS = Number(process.env.INSTANT_OPTIMIZE_SECONDS || 6);
const TARGET_BITRATE = process.env.INSTANT_OPTIMIZE_BITRATE || '96k';
const TARGET_SAMPLE_RATE = Number(process.env.INSTANT_OPTIMIZE_SAMPLE_RATE || 22050);
const TARGET_CHANNELS = Number(process.env.INSTANT_OPTIMIZE_CHANNELS || 1);
const BUCKET = process.env.R2_BUCKET_NAME || 'SuiteRhythm-sounds';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});

function optimizedName(key) {
  const base = path.basename(key).replace(/\.[^.]+$/, '');
  return `${base}-instant.mp3`;
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function head(key) {
  const result = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return Number(result.ContentLength || 0);
}

async function download(key, filePath) {
  const result = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await fs.writeFile(filePath, await streamToBuffer(result.Body));
}

async function transcode(sourcePath, outputPath) {
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', sourcePath,
      '-vn',
      '-t', String(TARGET_SECONDS),
      '-ar', String(TARGET_SAMPLE_RATE),
      '-ac', String(TARGET_CHANNELS),
      '-b:a', TARGET_BITRATE,
      '-f', 'mp3',
      outputPath,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}`));
    });
    ffmpeg.on('error', reject);
  });
}

async function upload(key, filePath) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: await fs.readFile(filePath),
    ContentType: 'audio/mpeg',
    CacheControl: CACHE_CONTROL,
  }));
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'suiterhythm-instant-optimize-'));
try {
  console.log(`Optimizing ${SOURCE_KEYS.length} heavy trigger sounds into ${TARGET_PREFIX}`);
  console.log(`Target: first ${TARGET_SECONDS}s, ${TARGET_BITRATE}, ${TARGET_SAMPLE_RATE} Hz, ${TARGET_CHANNELS} channel(s)`);

  const mappings = [];
  for (const sourceKey of SOURCE_KEYS) {
    const beforeBytes = await head(sourceKey);
    const inputPath = path.join(tempDir, path.basename(sourceKey));
    const outputKey = `${TARGET_PREFIX}${optimizedName(sourceKey)}`;
    const outputPath = path.join(tempDir, optimizedName(sourceKey));

    await download(sourceKey, inputPath);
    await transcode(inputPath, outputPath);
    await upload(outputKey, outputPath);
    const afterBytes = await head(outputKey);
    mappings.push({ sourceKey, outputKey, beforeBytes, afterBytes });

    console.log(`${sourceKey}`);
    console.log(`  -> ${outputKey} (${mb(beforeBytes)} -> ${mb(afterBytes)})`);
  }

  console.log('\nMappings for trigger-system.js:');
  for (const { sourceKey, outputKey } of mappings) {
    console.log(`${sourceKey} => ${outputKey}`);
  }
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
