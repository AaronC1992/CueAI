/**
 * Generate emergency-vehicle sound effects via ElevenLabs Sound Generation,
 * upload them to R2, and insert rows into the Supabase `sounds` table.
 *
 * Usage: node scripts/generate-emergency-vehicles.js
 *
 * Requires .env.local:
 *   - ELEVENLABS_API_KEY
 *   - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';
const PREFIX = 'sounds/';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ElevenLabs Sound Generation max duration is 22 seconds.
const SOUNDS = [
  {
    name: 'police siren wail',
    filename: 'police-siren-wail.mp3',
    prompt: 'Classic police car siren wailing, rising and falling electronic pitch, urgent emergency response, passing by on a city street',
    duration: 12,
    type: 'sfx',
    keywords: ['police', 'siren', 'wail', 'cop', 'emergency', 'patrol', 'law', 'urban'],
    loop: true,
  },
  {
    name: 'ambulance siren',
    filename: 'ambulance-siren.mp3',
    prompt: 'Ambulance siren alternating two-tone hi-lo wail, medical emergency vehicle rushing through traffic, loud and clear',
    duration: 12,
    type: 'sfx',
    keywords: ['ambulance', 'siren', 'medical', 'paramedic', 'emergency', 'hospital', 'rescue', 'hi-lo'],
    loop: true,
  },
  {
    name: 'fire truck siren air horn',
    filename: 'fire-truck-siren-air-horn.mp3',
    prompt: 'Large fire truck siren with deep air horn bursts, electronic wail layered with powerful horn blasts, heavy vehicle approaching',
    duration: 12,
    type: 'sfx',
    keywords: ['fire', 'truck', 'siren', 'engine', 'air horn', 'emergency', 'responder', 'rescue'],
    loop: true,
  },
  {
    name: 'distant city siren ambience',
    filename: 'distant-city-siren-ambience.mp3',
    prompt: 'Distant city siren heard from far away, muffled and echoing between buildings, urban nighttime background with faint traffic',
    duration: 20,
    type: 'ambience',
    keywords: ['distant', 'siren', 'city', 'urban', 'background', 'ambience', 'night', 'traffic'],
    loop: true,
  },
  {
    name: 'air raid siren warning',
    filename: 'air-raid-siren-warning.mp3',
    prompt: 'Old air-raid siren rising to a long sustained wail, mechanical rotating horn, WWII warning alarm, dread and imminent danger',
    duration: 15,
    type: 'sfx',
    keywords: ['air raid', 'siren', 'warning', 'alarm', 'war', 'wwii', 'evacuation', 'danger'],
    loop: true,
  },
  {
    name: 'air raid siren single wail',
    filename: 'air-raid-siren-single-wail.mp3',
    prompt: 'Single slow air-raid siren wail rising and falling once, isolated warning signal, mournful foreboding',
    duration: 8,
    type: 'sfx',
    keywords: ['air raid', 'siren', 'wail', 'warning', 'alarm', 'single', 'alert'],
    loop: false,
  },
  {
    name: 'tornado civil defense siren',
    filename: 'tornado-civil-defense-siren.mp3',
    prompt: 'Tornado civil defense siren, steady long warbling tone rising and falling, midwestern storm warning, ominous outdoor alarm',
    duration: 15,
    type: 'sfx',
    keywords: ['tornado', 'civil defense', 'siren', 'storm', 'warning', 'alarm', 'weather', 'emergency'],
    loop: true,
  },
  {
    name: 'police radio dispatch chatter',
    filename: 'police-radio-dispatch-chatter.mp3',
    prompt: 'Police radio dispatcher chatter, muffled voices over static, codes and numbers, intermittent squelch beeps, squad car radio background',
    duration: 18,
    type: 'ambience',
    keywords: ['police', 'radio', 'dispatch', 'chatter', 'static', 'scanner', 'squelch', 'cop'],
    loop: true,
  },
  {
    name: 'cop car door slam',
    filename: 'cop-car-door-slam.mp3',
    prompt: 'Heavy police cruiser door slamming shut, solid metallic thud, officer exiting patrol car, brief reverb',
    duration: 2,
    type: 'sfx',
    keywords: ['cop', 'police', 'car', 'door', 'slam', 'cruiser', 'patrol', 'close'],
    loop: false,
  },
  {
    name: 'car horn single honk',
    filename: 'car-horn-single-honk.mp3',
    prompt: 'Single sharp car horn honk, modern sedan, short and loud, urban street',
    duration: 2,
    type: 'sfx',
    keywords: ['car', 'horn', 'honk', 'traffic', 'urban', 'beep', 'vehicle', 'street'],
    loop: false,
  },
  {
    name: 'emergency scanner static',
    filename: 'emergency-scanner-static.mp3',
    prompt: 'Emergency scanner radio static, white noise crackle with faint distant voice fragments, tuning between channels',
    duration: 15,
    type: 'ambience',
    keywords: ['scanner', 'static', 'radio', 'emergency', 'crackle', 'white noise', 'tuning'],
    loop: true,
  },
  {
    name: 'emergency vehicle passing by',
    filename: 'emergency-vehicle-passing-by.mp3',
    prompt: 'Emergency vehicle driving past with siren, Doppler effect rising and falling in pitch as it approaches and recedes, city street',
    duration: 10,
    type: 'sfx',
    keywords: ['emergency', 'vehicle', 'siren', 'passing', 'doppler', 'street', 'pass by', 'drive'],
    loop: false,
  },
];

async function alreadyInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function alreadyInDb(name) {
  const { data, error } = await supabase
    .from('sounds')
    .select('id')
    .eq('name', name)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function generate(sound) {
  const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sound.prompt,
      duration_seconds: sound.duration,
      prompt_influence: 0.5,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`ElevenLabs ${resp.status}: ${err}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function main() {
  if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1); }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1);
  }

  console.log(`Generating ${SOUNDS.length} emergency-vehicle sounds...\n`);
  let ok = 0, skipped = 0, failed = 0;

  for (const [i, sound] of SOUNDS.entries()) {
    const tag = `[${i + 1}/${SOUNDS.length}]`;
    try {
      if (await alreadyInDb(sound.name)) {
        console.log(`${tag} ${sound.name} — already in Supabase, skipping`);
        skipped++;
        continue;
      }

      const key = `${PREFIX}${sound.filename}`;
      let audio;
      if (await alreadyInR2(key)) {
        console.log(`${tag} ${sound.name} — R2 hit, skipping generation`);
      } else {
        console.log(`${tag} Generating: ${sound.name} (${sound.duration}s)...`);
        audio = await generate(sound);
        console.log(`${tag}   ${(audio.length / 1024).toFixed(0)} KB — uploading to R2`);
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: audio,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
      }

      const { error } = await supabase.from('sounds').insert({
        type: sound.type,
        name: sound.name,
        file: key,
        keywords: sound.keywords,
        loop: !!sound.loop,
      });
      if (error) throw new Error(`Supabase insert: ${error.message}`);

      console.log(`${tag}   inserted into Supabase`);
      ok++;
    } catch (err) {
      console.error(`${tag} FAILED ${sound.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. added=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
