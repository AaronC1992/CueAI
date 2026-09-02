/**
 * Generate Comic Book style sound effects via ElevenLabs Sound Generation API,
 * upload to R2, and append to public/saved-sounds.json.
 *
 * Usage: node scripts/generate-comic-sfx.js
 *
 * These are classic onomatopoeia-style one-shots (POW! BAM! WHOOSH! ZAP!) with
 * cartoony/exaggerated character. Non-looping. Keywords include the
 * onomatopoeia word plus action/context tags so the AI's semantic matching
 * can pick them for punches, explosions, swooshes, magic zaps, etc.
 *
 * Requires .env.local with ELEVENLABS_API_KEY and R2_* variables.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

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

// ─────────────────────────────────────────────────────────────────────────
// COMIC BOOK SFX LIBRARY
// Classic onomatopoeia one-shots. Short (1–3 seconds), cartoony, exaggerated.
// ─────────────────────────────────────────────────────────────────────────
const COMIC_SFX = [
  // ═══════ PUNCHES / HITS ═══════
  {
    name: 'comic pow punch',
    filename: 'comic-pow-punch.mp3',
    prompt: 'Classic comic book POW punch sound effect, cartoony exaggerated hard fist impact with a bright snappy whack and a quick low boom tail, Looney-Tunes style, punchy and clean, single hit',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'pow', 'punch', 'hit', 'impact', 'fight', 'whack', 'superhero', 'action', 'onomatopoeia']
  },
  {
    name: 'comic bam hit',
    filename: 'comic-bam-hit.mp3',
    prompt: 'Comic book BAM sound effect, hard impact with a thick mid-punch and a short tail, cartoon superhero fist hit, single strike, slightly boomy',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'bam', 'hit', 'punch', 'impact', 'fight', 'superhero', 'onomatopoeia']
  },
  {
    name: 'comic wham slam',
    filename: 'comic-wham-slam.mp3',
    prompt: 'Comic book WHAM slam impact, heavy cartoony body-slam hit with a deep thump and shaking tail, single impact, superhero body check',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'wham', 'slam', 'impact', 'body-slam', 'heavy', 'fight', 'onomatopoeia']
  },
  {
    name: 'comic kapow explosion punch',
    filename: 'comic-kapow-explosion-punch.mp3',
    prompt: 'Comic book KAPOW super-punch, an exaggerated fist hit followed by a small explosion pop, cartoony and bright, single big impact with sparkly tail',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'kapow', 'pow', 'super-punch', 'explosion', 'impact', 'fight', 'finisher', 'superhero', 'onomatopoeia']
  },
  {
    name: 'comic biff light hit',
    filename: 'comic-biff-light-hit.mp3',
    prompt: 'Comic book BIFF light hit, a quick snappy jab sound, light cartoon punch, bright and short, single tap-like hit',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'biff', 'jab', 'light-hit', 'tap', 'fight', 'onomatopoeia']
  },
  {
    name: 'comic boff soft hit',
    filename: 'comic-boff-soft-hit.mp3',
    prompt: 'Comic book BOFF soft hit, muffled pillowy cartoon punch, goofy soft impact, single short hit',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'boff', 'soft-hit', 'goofy', 'muffled', 'onomatopoeia']
  },
  {
    name: 'comic thwack whip hit',
    filename: 'comic-thwack-whip-hit.mp3',
    prompt: 'Comic book THWACK whip-crack hit, sharp high whip impact with a bright sting, cartoony and snappy, single quick hit',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'thwack', 'whip', 'slap', 'sharp', 'sting', 'hit', 'onomatopoeia']
  },
  {
    name: 'comic whack bat hit',
    filename: 'comic-whack-bat-hit.mp3',
    prompt: 'Comic book WHACK baseball-bat style hit, solid wood-on-flesh cartoon impact, single strong whack, slight reverb',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'whack', 'bat', 'hit', 'strike', 'fight', 'onomatopoeia']
  },
  {
    name: 'comic smack slap',
    filename: 'comic-smack-slap.mp3',
    prompt: 'Comic book SMACK face-slap sound, flat hand cartoon slap, bright crack, single quick slap',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'smack', 'slap', 'hit', 'face-slap', 'onomatopoeia']
  },
  {
    name: 'comic bonk head',
    filename: 'comic-bonk-head.mp3',
    prompt: 'Comic book BONK head-bump sound, hollow wooden knock on a head, cartoony goofy single bonk',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'bonk', 'head', 'knock', 'hollow', 'goofy', 'onomatopoeia']
  },

  // ═══════ EXPLOSIONS / BOOMS ═══════
  {
    name: 'comic boom explosion',
    filename: 'comic-boom-explosion.mp3',
    prompt: 'Comic book BOOM explosion, cartoony big boom with a bright flash crack and rumbling tail, single explosion, superhero comic style',
    duration: 3,
    keywords: ['comic', 'comic-book', 'cartoon', 'boom', 'explosion', 'blast', 'impact', 'action', 'onomatopoeia']
  },
  {
    name: 'comic kaboom big explosion',
    filename: 'comic-kaboom-big-explosion.mp3',
    prompt: 'Comic book KABOOM huge explosion, a massive cartoony blast with deep rumble, debris shimmer, and wobbling aftermath, single big explosion',
    duration: 3,
    keywords: ['comic', 'comic-book', 'cartoon', 'kaboom', 'boom', 'explosion', 'big-explosion', 'blast', 'finisher', 'action', 'onomatopoeia']
  },
  {
    name: 'comic blam gunshot',
    filename: 'comic-blam-gunshot.mp3',
    prompt: 'Comic book BLAM cartoon gunshot, bright cartoony gun blast with a quick echo, single shot, old-timey western comic style',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'blam', 'gunshot', 'bang', 'shot', 'western', 'onomatopoeia']
  },
  {
    name: 'comic bang door slam',
    filename: 'comic-bang-door-slam.mp3',
    prompt: 'Comic book BANG cartoon door slam or big bang, sharp bright bang with a quick rumble tail, single impact',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'bang', 'slam', 'door', 'impact', 'onomatopoeia']
  },

  // ═══════ WHOOSH / MOVEMENT / DODGE ═══════
  {
    name: 'comic whoosh swoosh',
    filename: 'comic-whoosh-swoosh.mp3',
    prompt: 'Comic book WHOOSH air swoosh, fast cartoon air movement past the microphone, whip-pan style, single quick swoosh',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'whoosh', 'swoosh', 'swipe', 'air', 'movement', 'dodge', 'fly-by', 'transition', 'onomatopoeia']
  },
  {
    name: 'comic zoom fast pass',
    filename: 'comic-zoom-fast-pass.mp3',
    prompt: 'Comic book ZOOM super-fast pass-by, fast whoosh with a descending doppler tone, cartoon speedster flying past, single zoom',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'zoom', 'whoosh', 'fast', 'speed', 'fly-by', 'pass-by', 'superhero', 'onomatopoeia']
  },
  {
    name: 'comic swish quick',
    filename: 'comic-swish-quick.mp3',
    prompt: 'Comic book SWISH quick sword-swipe, short airy whip, bright and fast, single swish',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'swish', 'swoosh', 'swipe', 'sword', 'dodge', 'onomatopoeia']
  },
  {
    name: 'comic zip warp',
    filename: 'comic-zip-warp.mp3',
    prompt: 'Comic book ZIP quick warp sound, bright ascending blip with a fast air whoosh, teleport or zip-away, single zip',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'zip', 'warp', 'teleport', 'fast', 'vanish', 'onomatopoeia']
  },

  // ═══════ ENERGY / MAGIC / ZAPS ═══════
  {
    name: 'comic zap electric',
    filename: 'comic-zap-electric.mp3',
    prompt: 'Comic book ZAP electric bolt sound, cartoony lightning crackle with a sharp zap and buzzy tail, single electric hit',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'zap', 'electric', 'lightning', 'shock', 'energy', 'magic', 'superhero', 'onomatopoeia']
  },
  {
    name: 'comic zork ray gun',
    filename: 'comic-zork-ray-gun.mp3',
    prompt: 'Comic book ZORK retro ray-gun blast, cartoony sci-fi laser with pew-descent, single zap, 50s sci-fi comic style',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'zork', 'zap', 'ray-gun', 'laser', 'sci-fi', 'retro', 'pew', 'onomatopoeia']
  },
  {
    name: 'comic pew laser',
    filename: 'comic-pew-laser.mp3',
    prompt: 'Comic book PEW laser shot, bright descending laser zap, cartoony sci-fi, single pew',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'pew', 'laser', 'ray-gun', 'sci-fi', 'zap', 'onomatopoeia']
  },
  {
    name: 'comic fwoosh fire',
    filename: 'comic-fwoosh-fire.mp3',
    prompt: 'Comic book FWOOSH fire burst, cartoony flame swoosh with a crackly roar, single fire burst, magic or flamethrower',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'fwoosh', 'whoosh', 'fire', 'flame', 'burst', 'magic', 'onomatopoeia']
  },
  {
    name: 'comic sparkle magic',
    filename: 'comic-sparkle-magic.mp3',
    prompt: 'Comic book SPARKLE magic shimmer, cartoony twinkling magic glitter rising tone, single sparkle burst',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'sparkle', 'twinkle', 'shimmer', 'magic', 'fairy', 'power-up', 'onomatopoeia']
  },
  {
    name: 'comic poof disappear',
    filename: 'comic-poof-disappear.mp3',
    prompt: 'Comic book POOF smoke puff disappear, cartoony soft puff with a tiny sparkle, single disappearance poof',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'poof', 'smoke', 'disappear', 'vanish', 'magic', 'onomatopoeia']
  },
  {
    name: 'comic ping power up',
    filename: 'comic-ping-power-up.mp3',
    prompt: 'Comic book PING bright power-up chime, rising sparkly tone, cartoony shiny ding with twinkle, single power-up',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'ping', 'ding', 'chime', 'power-up', 'shine', 'twinkle', 'idea', 'onomatopoeia']
  },

  // ═══════ CRASHES / BREAKS ═══════
  {
    name: 'comic crash break',
    filename: 'comic-crash-break.mp3',
    prompt: 'Comic book CRASH glass and wood breaking, cartoony splintering crash with bright shatters, single big crash',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'crash', 'break', 'shatter', 'glass', 'wood', 'impact', 'onomatopoeia']
  },
  {
    name: 'comic smash glass',
    filename: 'comic-smash-glass.mp3',
    prompt: 'Comic book SMASH glass shatter, bright cartoony glass breaking with tinkly tails, single smash',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'smash', 'glass', 'shatter', 'break', 'onomatopoeia']
  },
  {
    name: 'comic clang metal',
    filename: 'comic-clang-metal.mp3',
    prompt: 'Comic book CLANG metal pan ringing, bright metallic clang with a long ringing tail, cartoony skillet hit, single clang',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'clang', 'metal', 'pan', 'ring', 'skillet', 'hit', 'onomatopoeia']
  },
  {
    name: 'comic clank metal drop',
    filename: 'comic-clank-metal-drop.mp3',
    prompt: 'Comic book CLANK metal object dropping on floor, dull metallic clank with rolling tail, cartoony, single drop',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'clank', 'metal', 'drop', 'fall', 'onomatopoeia']
  },
  {
    name: 'comic thud heavy fall',
    filename: 'comic-thud-heavy-fall.mp3',
    prompt: 'Comic book THUD heavy body fall, low dull thud with a little floor shake, cartoony single fall',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'thud', 'fall', 'drop', 'heavy', 'body-fall', 'onomatopoeia']
  },
  {
    name: 'comic splat wet',
    filename: 'comic-splat-wet.mp3',
    prompt: 'Comic book SPLAT wet splatter, cartoony pie-in-the-face splat with a gooey tail, single splat',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'splat', 'splatter', 'wet', 'pie', 'slap', 'goo', 'onomatopoeia']
  },
  {
    name: 'comic squish goo',
    filename: 'comic-squish-goo.mp3',
    prompt: 'Comic book SQUISH gooey squelch, cartoony slimy squish sound, single squish',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'squish', 'squelch', 'goo', 'slime', 'wet', 'onomatopoeia']
  },

  // ═══════ BOUNCE / SPRING / GOOFY ═══════
  {
    name: 'comic boing spring',
    filename: 'comic-boing-spring.mp3',
    prompt: 'Comic book BOING spring bounce, classic cartoony spring wobble, single boing',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'boing', 'spring', 'bounce', 'goofy', 'wobble', 'onomatopoeia']
  },
  {
    name: 'comic sproing stretch',
    filename: 'comic-sproing-stretch.mp3',
    prompt: 'Comic book SPROING stretchy spring, cartoony rubber stretch with a long wobble release, single sproing',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'sproing', 'spring', 'stretch', 'rubber', 'goofy', 'onomatopoeia']
  },
  {
    name: 'comic wobble jelly',
    filename: 'comic-wobble-jelly.mp3',
    prompt: 'Comic book WOBBLE jelly wobble, cartoony jiggly wobble with a soft tail, single wobble',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'wobble', 'jelly', 'jiggle', 'goofy', 'bounce', 'onomatopoeia']
  },
  {
    name: 'comic slide whistle down',
    filename: 'comic-slide-whistle-down.mp3',
    prompt: 'Comic book slide whistle descending, classic cartoon fall slide-whistle from high to low, single down slide',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'slide-whistle', 'fall', 'down', 'goofy', 'onomatopoeia']
  },
  {
    name: 'comic slide whistle up',
    filename: 'comic-slide-whistle-up.mp3',
    prompt: 'Comic book slide whistle ascending, classic cartoon rising slide-whistle from low to high, single up slide',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'slide-whistle', 'rise', 'up', 'goofy', 'onomatopoeia']
  },

  // ═══════ POP / SMALL / COMEDY ═══════
  {
    name: 'comic pop bubble',
    filename: 'comic-pop-bubble.mp3',
    prompt: 'Comic book POP bubble pop, small cartoony pop with a bright little spark, single pop',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'pop', 'bubble', 'small', 'bright', 'onomatopoeia']
  },
  {
    name: 'comic ding bell',
    filename: 'comic-ding-bell.mp3',
    prompt: 'Comic book DING bright single bell hit, idea-moment ding, cartoony shiny bell, single ding',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'ding', 'bell', 'idea', 'light-bulb', 'chime', 'onomatopoeia']
  },
  {
    name: 'comic honk horn',
    filename: 'comic-honk-horn.mp3',
    prompt: 'Comic book HONK goofy clown horn, cartoony bulb-horn honk, single honk',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'honk', 'clown', 'horn', 'goofy', 'comedy', 'onomatopoeia']
  },
  {
    name: 'comic gulp swallow',
    filename: 'comic-gulp-swallow.mp3',
    prompt: 'Comic book GULP nervous swallow, cartoony exaggerated throat gulp, single gulp',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'gulp', 'swallow', 'nervous', 'goofy', 'reaction', 'onomatopoeia']
  },
  {
    name: 'comic yoink grab',
    filename: 'comic-yoink-grab.mp3',
    prompt: 'Comic book YOINK quick grab, cartoony fast rope-tug whoosh with a snap, single yoink',
    duration: 1,
    keywords: ['comic', 'comic-book', 'cartoon', 'yoink', 'grab', 'snatch', 'swipe', 'goofy', 'onomatopoeia']
  },
  {
    name: 'comic drumroll short',
    filename: 'comic-drumroll-short.mp3',
    prompt: 'Comic book short drum roll with a final cymbal crash, comedy reveal drumroll, single short roll',
    duration: 3,
    keywords: ['comic', 'comic-book', 'cartoon', 'drumroll', 'reveal', 'comedy', 'snare', 'cymbal', 'onomatopoeia']
  },
  {
    name: 'comic sad trombone',
    filename: 'comic-sad-trombone.mp3',
    prompt: 'Comic book sad trombone wah-wah-wah fail sound, cartoony comedy trombone fail, single sad trombone',
    duration: 2,
    keywords: ['comic', 'comic-book', 'cartoon', 'sad-trombone', 'fail', 'wah-wah', 'comedy', 'defeat', 'onomatopoeia']
  }
];

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    return false;
  }
}

async function generateAndUpload(sound) {
  const r2Key = `${PREFIX}${sound.filename}`;

  if (await objectExists(r2Key)) {
    console.log(`  - Already in R2, skipping generation: ${sound.filename}`);
    return true;
  }

  console.log(`  • Generating via ElevenLabs: ${sound.name} (${sound.duration}s)...`);
  const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sound.prompt,
      duration_seconds: sound.duration,
      // Higher prompt_influence here — SFX should follow the prompt closely.
      prompt_influence: 0.6
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    console.error(`    ! ElevenLabs error ${resp.status}: ${err}`);
    return false;
  }

  const audio = Buffer.from(await resp.arrayBuffer());
  console.log(`    ✓ Generated ${(audio.length / 1024).toFixed(1)} KB`);

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: audio,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`    ↑ Uploaded: ${r2Key}`);
  return true;
}

async function main() {
  if (!API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY in .env.local');
    process.exit(1);
  }

  const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
  const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
  const catalog = catalogJson.files || catalogJson;
  const existingNames = new Set(catalog.map(s => s.name));

  console.log(`Starting Comic SFX generation — ${COMIC_SFX.length} sounds planned.`);
  let successes = 0;
  let skippedCatalog = 0;
  let failures = 0;

  for (const sound of COMIC_SFX) {
    console.log(`\n→ ${sound.name}`);

    const ok = await generateAndUpload(sound);
    if (!ok) { failures++; continue; }

    if (existingNames.has(sound.name)) {
      console.log(`  = Already in catalog, not duplicating.`);
      skippedCatalog++;
      continue;
    }

    const entry = {
      type: 'sfx',
      name: sound.name,
      file: `sounds/${sound.filename}`,
      keywords: sound.keywords,
    };
    catalog.push(entry);
    existingNames.add(sound.name);
    successes++;

    await new Promise(r => setTimeout(r, 400));
  }

  await writeFile(catalogPath, JSON.stringify({ files: catalog }, null, 2));
  console.log(`\n— Done.`);
  console.log(`  New catalog entries: ${successes}`);
  console.log(`  Already in catalog:  ${skippedCatalog}`);
  console.log(`  Failures:            ${failures}`);
  console.log(`  Total catalog size:  ${catalog.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
