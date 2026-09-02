/**
 * Generate Sing Mode backing music + crowd reactions via ElevenLabs Sound
 * Generation API, upload to R2, and append to public/saved-sounds.json.
 *
 * Usage: node scripts/generate-sing-sounds.js
 *
 * Tracks are instrumental / karaoke-style so they don't fight a live singer.
 * Each track's `keywords` include a tempo bucket ("bpm-80" etc.), a mood word,
 * and "instrumental"/"karaoke" so MODE_RULES.sing can tempo-match via
 * detectedBPM in the AI prompt.
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
// SING MODE LIBRARY
// Buckets: ballad (60-80 BPM), mid (80-110 BPM), upbeat (110-130),
//          driving (130-160). Plus a few crowd SFX for song-end applause.
// ─────────────────────────────────────────────────────────────────────────
const SING_SOUNDS = [
  // ═══════ BALLAD / SLOW (60-80 BPM) — instrumental backing ═══════
  {
    name: 'sing ballad piano slow',
    filename: 'sing-ballad-piano-slow.mp3',
    prompt: 'Slow emotional piano ballad instrumental backing track, 70 BPM, no vocals, gentle chord progression in C major, soft sustain pedal, perfect for a singer to sing over, karaoke style, warm studio recording',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'slow', 'piano', 'emotional', 'bpm-70', 'tempo-slow', 'gentle', 'romantic'],
    loop: true,
    bpm: 70
  },
  {
    name: 'sing ballad acoustic guitar',
    filename: 'sing-ballad-acoustic-guitar.mp3',
    prompt: 'Slow acoustic guitar ballad instrumental, 72 BPM, fingerpicked steel-string in G major, warm and intimate, no vocals, singer-songwriter backing track, coffeehouse karaoke',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', 'fingerpicked', 'bpm-72', 'tempo-slow', 'intimate', 'warm'],
    loop: true,
    bpm: 72
  },
  {
    name: 'sing ballad strings cinematic',
    filename: 'sing-ballad-strings-cinematic.mp3',
    prompt: 'Slow cinematic string ballad instrumental, 68 BPM, lush orchestral strings in D minor, emotional and swelling, no vocals, epic backing track for a powerful singer, film-score style',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'strings', 'orchestral', 'cinematic', 'bpm-68', 'tempo-slow', 'emotional', 'sad'],
    loop: true,
    bpm: 68
  },

  // ═══════ MID-TEMPO (80-110 BPM) — pop/folk/soul backing ═══════
  {
    name: 'sing mid pop backing',
    filename: 'sing-mid-pop-backing.mp3',
    prompt: 'Mid-tempo pop instrumental backing track, 96 BPM, clean electric guitar, light drums, warm bass, no vocals, modern pop song karaoke style in A major, radio-friendly',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop', 'mid-tempo', 'upbeat', 'bpm-96', 'tempo-mid', 'warm', 'modern'],
    loop: true,
    bpm: 96
  },
  {
    name: 'sing mid soul groove',
    filename: 'sing-mid-soul-groove.mp3',
    prompt: 'Mid-tempo soul and R&B instrumental backing groove, 92 BPM, electric piano, funky bass, soft drums and hi-hats, no vocals, smooth karaoke track in F minor',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'soul', 'rnb', 'groove', 'funk', 'bpm-92', 'tempo-mid', 'smooth'],
    loop: true,
    bpm: 92
  },
  {
    name: 'sing mid folk strum',
    filename: 'sing-mid-folk-strum.mp3',
    prompt: 'Mid-tempo folk instrumental backing track, 100 BPM, strummed acoustic guitar, light tambourine, no vocals, happy indie folk karaoke in D major, campfire energy',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'folk', 'acoustic', 'strum', 'indie', 'bpm-100', 'tempo-mid', 'happy', 'uplifting'],
    loop: true,
    bpm: 100
  },
  {
    name: 'sing mid country twang',
    filename: 'sing-mid-country-twang.mp3',
    prompt: 'Mid-tempo country instrumental backing, 104 BPM, twangy electric guitar, brushed drums, walking bass, no vocals, classic country karaoke in G major, honky-tonk',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'twang', 'honky-tonk', 'bpm-104', 'tempo-mid'],
    loop: true,
    bpm: 104
  },

  // ═══════ UPBEAT (110-130 BPM) — pop/rock karaoke ═══════
  {
    name: 'sing upbeat indie pop',
    filename: 'sing-upbeat-indie-pop.mp3',
    prompt: 'Upbeat indie pop instrumental backing track, 118 BPM, bright jangly electric guitar, punchy drums, synth bass, no vocals, happy karaoke song in E major, summer energy',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'indie', 'pop', 'upbeat', 'bright', 'bpm-118', 'tempo-upbeat', 'happy', 'summer'],
    loop: true,
    bpm: 118
  },
  {
    name: 'sing upbeat rock anthem',
    filename: 'sing-upbeat-rock-anthem.mp3',
    prompt: 'Upbeat rock anthem instrumental backing track, 124 BPM, driving electric guitars, full drum kit, no vocals, stadium karaoke rock in A major, powerful and anthemic',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'anthem', 'stadium', 'powerful', 'bpm-124', 'tempo-upbeat', 'energetic'],
    loop: true,
    bpm: 124
  },
  {
    name: 'sing upbeat disco funk',
    filename: 'sing-upbeat-disco-funk.mp3',
    prompt: 'Upbeat disco funk instrumental backing track, 120 BPM, four-on-the-floor drums, slap bass, funky guitar chicks, strings, no vocals, retro dance karaoke in Em',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'disco', 'funk', 'dance', 'retro', 'bpm-120', 'tempo-upbeat'],
    loop: true,
    bpm: 120
  },

  // ═══════ DRIVING / FAST (130-160 BPM) ═══════
  {
    name: 'sing fast punk pop',
    filename: 'sing-fast-punk-pop.mp3',
    prompt: 'Fast punk pop instrumental backing track, 150 BPM, distorted power chords, fast punk drums, driving bass, no vocals, energetic karaoke pop-punk in D major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'punk', 'pop-punk', 'fast', 'energetic', 'bpm-150', 'tempo-fast'],
    loop: true,
    bpm: 150
  },
  {
    name: 'sing fast edm dance',
    filename: 'sing-fast-edm-dance.mp3',
    prompt: 'Fast EDM dance instrumental backing track, 128 BPM, pulsing synth bass, four-on-the-floor kick, sidechained pads, no vocals, festival karaoke club anthem in F minor',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'edm', 'dance', 'club', 'festival', 'bpm-128', 'tempo-upbeat', 'synth'],
    loop: true,
    bpm: 128
  },

  // ═══════ SPECIALTY / MOOD PICKS ═══════
  {
    name: 'sing jazz lounge backing',
    filename: 'sing-jazz-lounge-backing.mp3',
    prompt: 'Slow smoky jazz lounge instrumental backing, 84 BPM, upright bass, brushed snare, soft Rhodes piano, muted trumpet accents, no vocals, smoky cocktail bar karaoke in Bb',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'lounge', 'smoky', 'smooth', 'bpm-84', 'tempo-mid'],
    loop: true,
    bpm: 84
  },
  {
    name: 'sing gospel uplift backing',
    filename: 'sing-gospel-uplift-backing.mp3',
    prompt: 'Uplifting gospel instrumental backing, 88 BPM, Hammond organ, warm piano, soft choir pads (no lead vocals), gentle drums, no solo vocals, soulful karaoke in F major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'gospel', 'uplifting', 'soulful', 'organ', 'bpm-88', 'tempo-mid', 'hopeful'],
    loop: true,
    bpm: 88
  },
  {
    name: 'sing reggae chill backing',
    filename: 'sing-reggae-chill-backing.mp3',
    prompt: 'Chill reggae instrumental backing track, 76 BPM, off-beat skank guitar, deep bass, tight drums, no vocals, laid-back island karaoke in A major',
    duration: 22,
    type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'reggae', 'chill', 'island', 'laid-back', 'bpm-76', 'tempo-slow'],
    loop: true,
    bpm: 76
  },

  // ═══════════════════════════════════════════════════════════════════════
  // EXPANSION PACK — 100 additional singer-focused backing tracks.
  // Organized by tempo bucket so the AI's tempo-matching (bpm-xx tags) has
  // much finer-grained targets, and by genre/mood/key so the semantic
  // fallback has a near-exact hit for nearly any sing-mode AI query.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── BALLAD / SLOW (60–80 BPM) — 25 new tracks ───
  {
    name: 'sing ballad piano moonlight',
    filename: 'sing-ballad-piano-moonlight.mp3',
    prompt: 'Slow moonlit piano ballad instrumental, 66 BPM, solo grand piano in A minor, sparse emotional chords with long sustain, no vocals, late-night karaoke feel',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'slow', 'piano', 'moonlight', 'night', 'bpm-66', 'tempo-slow', 'emotional', 'melancholy', 'minor'],
    loop: true, bpm: 66
  },
  {
    name: 'sing ballad piano rubato',
    filename: 'sing-ballad-piano-rubato.mp3',
    prompt: 'Free-time rubato piano ballad instrumental, 64 BPM, expressive solo piano in F major, loose rhythmic feel, classical-pop, no vocals, cathedral karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'piano', 'rubato', 'classical', 'bpm-64', 'tempo-slow', 'expressive', 'major'],
    loop: true, bpm: 64
  },
  {
    name: 'sing ballad piano emotional build',
    filename: 'sing-ballad-piano-emotional-build.mp3',
    prompt: 'Slow building piano ballad instrumental, 74 BPM, starts sparse and grows with subtle strings, C minor to Eb major, no vocals, power-ballad karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'piano', 'strings', 'build', 'bpm-74', 'tempo-slow', 'emotional', 'power-ballad'],
    loop: true, bpm: 74
  },
  {
    name: 'sing ballad piano gospel minor',
    filename: 'sing-ballad-piano-gospel-minor.mp3',
    prompt: 'Slow gospel piano ballad instrumental, 70 BPM, bluesy gospel chords in E minor, soulful sustained notes, no vocals, church karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'piano', 'gospel', 'soulful', 'bpm-70', 'tempo-slow', 'minor', 'spiritual'],
    loop: true, bpm: 70
  },
  {
    name: 'sing ballad acoustic fingerstyle',
    filename: 'sing-ballad-acoustic-fingerstyle.mp3',
    prompt: 'Slow fingerstyle acoustic guitar ballad instrumental, 68 BPM, nylon-string classical technique in D major, no vocals, intimate coffeehouse karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', 'fingerstyle', 'nylon', 'classical', 'bpm-68', 'tempo-slow', 'intimate'],
    loop: true, bpm: 68
  },
  {
    name: 'sing ballad acoustic 12 string',
    filename: 'sing-ballad-acoustic-12-string.mp3',
    prompt: 'Slow 12-string acoustic guitar ballad, 74 BPM, shimmering open chords in G major, warm analog recording, no vocals, 70s folk karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', '12-string', 'folk', 'bpm-74', 'tempo-slow', 'warm', 'nostalgic'],
    loop: true, bpm: 74
  },
  {
    name: 'sing ballad acoustic latin nylon',
    filename: 'sing-ballad-acoustic-latin-nylon.mp3',
    prompt: 'Slow Latin nylon-string guitar ballad, 72 BPM, bolero-style arpeggios in A minor, no vocals, romantic Spanish karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', 'nylon', 'latin', 'bolero', 'spanish', 'bpm-72', 'tempo-slow', 'romantic'],
    loop: true, bpm: 72
  },
  {
    name: 'sing ballad acoustic country slow',
    filename: 'sing-ballad-acoustic-country-slow.mp3',
    prompt: 'Slow country ballad instrumental, 72 BPM, acoustic guitar with pedal steel swells in G major, no vocals, heartland karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'acoustic', 'guitar', 'country', 'pedal-steel', 'bpm-72', 'tempo-slow', 'heartland'],
    loop: true, bpm: 72
  },
  {
    name: 'sing ballad strings orchestral lush',
    filename: 'sing-ballad-strings-orchestral-lush.mp3',
    prompt: 'Slow lush orchestral string ballad, 66 BPM, full string section with soft horns in Bb major, swelling arrangement, no vocals, cinematic karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'strings', 'orchestral', 'horns', 'cinematic', 'bpm-66', 'tempo-slow', 'lush', 'epic'],
    loop: true, bpm: 66
  },
  {
    name: 'sing ballad strings melancholy cello',
    filename: 'sing-ballad-strings-melancholy-cello.mp3',
    prompt: 'Slow melancholy cello-led string ballad, 62 BPM, mournful cello solo with soft string pad in D minor, no vocals, film karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'strings', 'cello', 'melancholy', 'sad', 'bpm-62', 'tempo-slow', 'minor', 'film'],
    loop: true, bpm: 62
  },
  {
    name: 'sing ballad harp gentle',
    filename: 'sing-ballad-harp-gentle.mp3',
    prompt: 'Slow gentle harp ballad instrumental, 70 BPM, flowing harp arpeggios in C major, ethereal and peaceful, no vocals, dreamlike karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'harp', 'ethereal', 'dreamy', 'gentle', 'bpm-70', 'tempo-slow', 'peaceful'],
    loop: true, bpm: 70
  },
  {
    name: 'sing ballad choir pad ambient',
    filename: 'sing-ballad-choir-pad-ambient.mp3',
    prompt: 'Slow ambient choir pad ballad, 60 BPM, wordless vocal pad (no solo vocals) with soft piano underpinning in G major, no melodic lead, spiritual karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'choir', 'ambient', 'pad', 'spiritual', 'bpm-60', 'tempo-slow', 'ethereal'],
    loop: true, bpm: 60
  },
  {
    name: 'sing ballad electric guitar clean',
    filename: 'sing-ballad-electric-guitar-clean.mp3',
    prompt: 'Slow clean electric guitar ballad, 74 BPM, Stratocaster arpeggios with light reverb in E minor, no vocals, 80s soft-rock karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'electric', 'guitar', 'clean', 'soft-rock', 'bpm-74', 'tempo-slow', '80s'],
    loop: true, bpm: 74
  },
  {
    name: 'sing ballad rhodes dreamy',
    filename: 'sing-ballad-rhodes-dreamy.mp3',
    prompt: 'Slow dreamy Rhodes electric piano ballad, 68 BPM, warm chorused Rhodes in Ab major, soft bass, no vocals, smooth lounge karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'rhodes', 'electric-piano', 'smooth', 'dreamy', 'bpm-68', 'tempo-slow', 'lounge'],
    loop: true, bpm: 68
  },
  {
    name: 'sing ballad organ church',
    filename: 'sing-ballad-organ-church.mp3',
    prompt: 'Slow Hammond organ ballad instrumental, 72 BPM, warm drawbar organ with Leslie in F major, no vocals, gospel church karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'organ', 'hammond', 'church', 'gospel', 'bpm-72', 'tempo-slow', 'spiritual'],
    loop: true, bpm: 72
  },
  {
    name: 'sing ballad synth pad ethereal',
    filename: 'sing-ballad-synth-pad-ethereal.mp3',
    prompt: 'Slow ethereal synth pad ballad, 64 BPM, lush evolving analog-style pad in D major with a soft piano, no vocals, ambient karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'synth', 'pad', 'ambient', 'ethereal', 'bpm-64', 'tempo-slow', 'dreamy'],
    loop: true, bpm: 64
  },
  {
    name: 'sing ballad ukulele sweet',
    filename: 'sing-ballad-ukulele-sweet.mp3',
    prompt: 'Slow sweet ukulele ballad, 76 BPM, gentle strummed ukulele with soft shaker in C major, no vocals, charming tropical karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'ukulele', 'sweet', 'charming', 'bpm-76', 'tempo-slow', 'tropical', 'happy'],
    loop: true, bpm: 76
  },
  {
    name: 'sing ballad lofi chill',
    filename: 'sing-ballad-lofi-chill.mp3',
    prompt: 'Slow lofi hip hop ballad instrumental, 72 BPM, dusty drums, warm Rhodes, tape hiss in A minor, no vocals, chill-study karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'lofi', 'chill', 'hip-hop', 'rhodes', 'bpm-72', 'tempo-slow', 'relaxing'],
    loop: true, bpm: 72
  },
  {
    name: 'sing ballad country pedal steel',
    filename: 'sing-ballad-country-pedal-steel.mp3',
    prompt: 'Slow country ballad with featured pedal steel, 70 BPM, in G major with acoustic guitar bed and brushed drums, no vocals, classic country karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'country', 'pedal-steel', 'classic', 'bpm-70', 'tempo-slow', 'americana'],
    loop: true, bpm: 70
  },
  {
    name: 'sing ballad blues slow guitar',
    filename: 'sing-ballad-blues-slow-guitar.mp3',
    prompt: 'Slow blues ballad instrumental, 68 BPM, 12/8 feel, bluesy electric guitar and organ in A minor, no vocals, late-night blues karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'blues', 'guitar', 'organ', '12-8', 'bpm-68', 'tempo-slow', 'minor', 'smoky'],
    loop: true, bpm: 68
  },
  {
    name: 'sing ballad jazz trio slow',
    filename: 'sing-ballad-jazz-trio-slow.mp3',
    prompt: 'Slow jazz trio ballad, 64 BPM, piano trio with brushed drums and upright bass in Bb major, no vocals, torch-song karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'jazz', 'piano', 'upright-bass', 'trio', 'torch', 'bpm-64', 'tempo-slow', 'smoky'],
    loop: true, bpm: 64
  },
  {
    name: 'sing ballad torch song smoky',
    filename: 'sing-ballad-torch-song-smoky.mp3',
    prompt: 'Slow smoky jazz torch ballad, 62 BPM, muted trumpet and brushed drums with piano in Eb minor, no vocals, nightclub karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'torch-song', 'jazz', 'trumpet', 'smoky', 'bpm-62', 'tempo-slow', 'nightclub'],
    loop: true, bpm: 62
  },
  {
    name: 'sing ballad rnb slow jam',
    filename: 'sing-ballad-rnb-slow-jam.mp3',
    prompt: 'Slow 90s R&B slow-jam ballad instrumental, 70 BPM, warm Rhodes, soft drums with snare rolls, smooth bass, in G minor, no vocals, bedroom karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'rnb', 'slow-jam', 'rhodes', '90s', 'bpm-70', 'tempo-slow', 'smooth', 'romantic'],
    loop: true, bpm: 70
  },
  {
    name: 'sing ballad celtic harp',
    filename: 'sing-ballad-celtic-harp.mp3',
    prompt: 'Slow Celtic harp ballad, 68 BPM, traditional Irish harp with soft pennywhistle in D minor, no vocals, misty-highland karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'celtic', 'harp', 'irish', 'pennywhistle', 'bpm-68', 'tempo-slow', 'mystical'],
    loop: true, bpm: 68
  },
  {
    name: 'sing ballad power rock slow',
    filename: 'sing-ballad-power-rock-slow.mp3',
    prompt: 'Slow power ballad rock instrumental, 76 BPM, clean electric guitar arpeggios with subtle strings, building in D major, no vocals, 80s arena karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ballad', 'power-ballad', 'rock', 'arena', 'bpm-76', 'tempo-slow', '80s', 'epic'],
    loop: true, bpm: 76
  },

  // ─── MID-TEMPO (80–110 BPM) — 30 new tracks ───
  {
    name: 'sing mid pop acoustic radio',
    filename: 'sing-mid-pop-acoustic-radio.mp3',
    prompt: 'Mid-tempo acoustic pop instrumental, 96 BPM, strummed acoustic with tambourine and soft drums in C major, no vocals, modern-radio karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop', 'acoustic', 'radio', 'bpm-96', 'tempo-mid', 'modern', 'happy'],
    loop: true, bpm: 96
  },
  {
    name: 'sing mid pop synth dreamy',
    filename: 'sing-mid-pop-synth-dreamy.mp3',
    prompt: 'Mid-tempo dream pop instrumental, 88 BPM, airy synths, shimmering electric guitar, light drums in E major, no vocals, indie-pop karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop', 'dream-pop', 'synth', 'indie', 'bpm-88', 'tempo-mid', 'dreamy'],
    loop: true, bpm: 88
  },
  {
    name: 'sing mid rock classic riff',
    filename: 'sing-mid-rock-classic-riff.mp3',
    prompt: 'Mid-tempo classic rock instrumental, 104 BPM, driving electric guitar riff, rock drums, bass in A major, no vocals, 70s rock karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'classic-rock', '70s', 'bpm-104', 'tempo-mid', 'driving'],
    loop: true, bpm: 104
  },
  {
    name: 'sing mid rock soft alt',
    filename: 'sing-mid-rock-soft-alt.mp3',
    prompt: 'Mid-tempo soft alternative rock, 92 BPM, clean electric guitar, soft drums, warm bass in F# minor, no vocals, 90s alt karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'alt-rock', 'soft', '90s', 'bpm-92', 'tempo-mid', 'minor'],
    loop: true, bpm: 92
  },
  {
    name: 'sing mid country modern',
    filename: 'sing-mid-country-modern.mp3',
    prompt: 'Mid-tempo modern country instrumental, 102 BPM, acoustic strums, banjo licks, drums in D major, no vocals, radio country karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'modern-country', 'banjo', 'bpm-102', 'tempo-mid', 'upbeat'],
    loop: true, bpm: 102
  },
  {
    name: 'sing mid country outlaw',
    filename: 'sing-mid-country-outlaw.mp3',
    prompt: 'Mid-tempo outlaw country instrumental, 98 BPM, twangy electric guitar, walking bass, brushed drums in E major, no vocals, western karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'outlaw', 'western', 'twang', 'bpm-98', 'tempo-mid'],
    loop: true, bpm: 98
  },
  {
    name: 'sing mid folk campfire',
    filename: 'sing-mid-folk-campfire.mp3',
    prompt: 'Mid-tempo folk campfire instrumental, 96 BPM, acoustic guitar, harmonica, light percussion in G major, no vocals, singalong karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'folk', 'campfire', 'harmonica', 'singalong', 'bpm-96', 'tempo-mid', 'warm'],
    loop: true, bpm: 96
  },
  {
    name: 'sing mid folk indie',
    filename: 'sing-mid-folk-indie.mp3',
    prompt: 'Mid-tempo indie folk instrumental, 100 BPM, strummed acoustic, kick-drum stomp, handclaps in D major, no vocals, stomp-clap karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'folk', 'indie-folk', 'stomp-clap', 'bpm-100', 'tempo-mid', 'happy'],
    loop: true, bpm: 100
  },
  {
    name: 'sing mid soul motown',
    filename: 'sing-mid-soul-motown.mp3',
    prompt: 'Mid-tempo Motown soul instrumental, 106 BPM, tambourine, bright piano chord stabs, tight drums, horn stabs in A major, no vocals, 60s soul karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'soul', 'motown', '60s', 'horns', 'bpm-106', 'tempo-mid', 'upbeat'],
    loop: true, bpm: 106
  },
  {
    name: 'sing mid rnb smooth 90s',
    filename: 'sing-mid-rnb-smooth-90s.mp3',
    prompt: 'Mid-tempo 90s R&B instrumental, 90 BPM, Rhodes piano, tight drum machine, deep bass in F# minor, no vocals, new jack swing karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rnb', '90s', 'new-jack-swing', 'rhodes', 'bpm-90', 'tempo-mid', 'smooth'],
    loop: true, bpm: 90
  },
  {
    name: 'sing mid rnb neo soul',
    filename: 'sing-mid-rnb-neo-soul.mp3',
    prompt: 'Mid-tempo neo-soul instrumental, 86 BPM, warm Rhodes, laid-back drums, mellow bass in Dm7 groove, no vocals, lo-fi R&B karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rnb', 'neo-soul', 'rhodes', 'bpm-86', 'tempo-mid', 'smooth', 'jazzy'],
    loop: true, bpm: 86
  },
  {
    name: 'sing mid jazz swing lounge',
    filename: 'sing-mid-jazz-swing-lounge.mp3',
    prompt: 'Mid-tempo swing jazz lounge instrumental, 108 BPM, upright bass walking line, brushed snare, piano comping in F major, no vocals, cocktail karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'swing', 'lounge', 'cocktail', 'bpm-108', 'tempo-mid', 'smooth'],
    loop: true, bpm: 108
  },
  {
    name: 'sing mid jazz bossa nova',
    filename: 'sing-mid-jazz-bossa-nova.mp3',
    prompt: 'Mid-tempo bossa nova instrumental, 96 BPM, nylon guitar, soft brushes, subtle shaker in A minor, no vocals, Rio cocktail karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'bossa-nova', 'latin', 'brazilian', 'nylon', 'bpm-96', 'tempo-mid'],
    loop: true, bpm: 96
  },
  {
    name: 'sing mid latin pop',
    filename: 'sing-mid-latin-pop.mp3',
    prompt: 'Mid-tempo Latin pop instrumental, 100 BPM, acoustic nylon guitar, congas, shaker in G major, no vocals, radio Latin-pop karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'latin-pop', 'congas', 'nylon', 'bpm-100', 'tempo-mid'],
    loop: true, bpm: 100
  },
  {
    name: 'sing mid latin bolero',
    filename: 'sing-mid-latin-bolero.mp3',
    prompt: 'Mid-tempo Latin bolero instrumental, 88 BPM, nylon guitar, soft strings, brush drums in D minor, no vocals, romantic Latin karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'bolero', 'romantic', 'strings', 'bpm-88', 'tempo-mid'],
    loop: true, bpm: 88
  },
  {
    name: 'sing mid reggae roots',
    filename: 'sing-mid-reggae-roots.mp3',
    prompt: 'Mid-tempo roots reggae instrumental, 82 BPM, off-beat skank guitar, deep bass, one-drop drums, in F major, no vocals, Kingston karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'reggae', 'roots', 'one-drop', 'bpm-82', 'tempo-mid', 'island'],
    loop: true, bpm: 82
  },
  {
    name: 'sing mid ska horns',
    filename: 'sing-mid-ska-horns.mp3',
    prompt: 'Mid-tempo ska instrumental, 108 BPM, upstroke guitar skank, punchy horn section, bouncy bass in C major, no vocals, 2-tone karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ska', 'horns', '2-tone', 'bpm-108', 'tempo-mid', 'bouncy'],
    loop: true, bpm: 108
  },
  {
    name: 'sing mid hip hop boom bap',
    filename: 'sing-mid-hip-hop-boom-bap.mp3',
    prompt: 'Mid-tempo boom-bap hip hop instrumental, 92 BPM, dusty drums, jazz piano sample feel, deep bass in A minor, no vocals, 90s rap karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'hip-hop', 'boom-bap', '90s', 'jazzy', 'bpm-92', 'tempo-mid'],
    loop: true, bpm: 92
  },
  {
    name: 'sing mid hip hop trap',
    filename: 'sing-mid-hip-hop-trap.mp3',
    prompt: 'Mid-tempo trap hip hop instrumental, 140 BPM (half-time 70 feel), 808 bass, hi-hat rolls, dark piano in C# minor, no vocals, melodic rap karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'hip-hop', 'trap', '808', 'bpm-140', 'tempo-mid', 'dark', 'melodic'],
    loop: true, bpm: 140
  },
  {
    name: 'sing mid blues walking',
    filename: 'sing-mid-blues-walking.mp3',
    prompt: 'Mid-tempo walking blues instrumental, 100 BPM, 12-bar shuffle in E, bluesy electric guitar, walking bass, no vocals, juke-joint karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'blues', 'shuffle', '12-bar', 'walking-bass', 'bpm-100', 'tempo-mid'],
    loop: true, bpm: 100
  },
  {
    name: 'sing mid blues shuffle',
    filename: 'sing-mid-blues-shuffle.mp3',
    prompt: 'Mid-tempo Chicago blues shuffle, 108 BPM, electric guitar, Hammond organ, tight drums in A, no vocals, bar-blues karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'blues', 'shuffle', 'chicago', 'organ', 'bpm-108', 'tempo-mid'],
    loop: true, bpm: 108
  },
  {
    name: 'sing mid funk slow',
    filename: 'sing-mid-funk-slow.mp3',
    prompt: 'Mid-tempo slow funk instrumental, 94 BPM, slap bass, wah guitar, tight drums, clavinet in D7, no vocals, 70s funk karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'funk', '70s', 'slap-bass', 'wah', 'clavinet', 'bpm-94', 'tempo-mid'],
    loop: true, bpm: 94
  },
  {
    name: 'sing mid gospel traditional',
    filename: 'sing-mid-gospel-traditional.mp3',
    prompt: 'Mid-tempo traditional gospel instrumental, 96 BPM, Hammond organ, piano, tambourine, in G major, no vocals, church karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'gospel', 'traditional', 'organ', 'church', 'bpm-96', 'tempo-mid', 'spiritual'],
    loop: true, bpm: 96
  },
  {
    name: 'sing mid gospel contemporary',
    filename: 'sing-mid-gospel-contemporary.mp3',
    prompt: 'Mid-tempo contemporary gospel instrumental, 92 BPM, modern drums, electric piano, soft pads in Bb major, no vocals, CCM karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'gospel', 'contemporary', 'ccm', 'worship', 'bpm-92', 'tempo-mid', 'uplifting'],
    loop: true, bpm: 92
  },
  {
    name: 'sing mid celtic ballad',
    filename: 'sing-mid-celtic-ballad.mp3',
    prompt: 'Mid-tempo Celtic ballad instrumental, 92 BPM, tin whistle, fiddle, acoustic guitar, bodhran in D major, no vocals, Irish pub karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'celtic', 'irish', 'tin-whistle', 'fiddle', 'bodhran', 'bpm-92', 'tempo-mid'],
    loop: true, bpm: 92
  },
  {
    name: 'sing mid worship acoustic',
    filename: 'sing-mid-worship-acoustic.mp3',
    prompt: 'Mid-tempo acoustic worship instrumental, 88 BPM, acoustic guitar, soft pad, gentle kick in G major, no vocals, modern worship karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'worship', 'ccm', 'acoustic', 'bpm-88', 'tempo-mid', 'spiritual', 'hopeful'],
    loop: true, bpm: 88
  },
  {
    name: 'sing mid synthwave retro',
    filename: 'sing-mid-synthwave-retro.mp3',
    prompt: 'Mid-tempo synthwave retrowave instrumental, 100 BPM, analog synths, gated reverb drums, warm bass in F minor, no vocals, 80s karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'synthwave', 'retrowave', '80s', 'analog-synth', 'bpm-100', 'tempo-mid', 'retro'],
    loop: true, bpm: 100
  },
  {
    name: 'sing mid dream pop',
    filename: 'sing-mid-dream-pop.mp3',
    prompt: 'Mid-tempo dream pop instrumental, 90 BPM, shoegaze guitar wash, reverb-soaked drums, dreamy synth pad in A major, no vocals, ethereal karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'dream-pop', 'shoegaze', 'reverb', 'ethereal', 'bpm-90', 'tempo-mid'],
    loop: true, bpm: 90
  },
  {
    name: 'sing mid indie rock',
    filename: 'sing-mid-indie-rock.mp3',
    prompt: 'Mid-tempo indie rock instrumental, 108 BPM, jangly clean guitars, punchy drums, melodic bass in E major, no vocals, college-radio karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'indie-rock', 'jangle', 'college-rock', 'bpm-108', 'tempo-mid'],
    loop: true, bpm: 108
  },
  {
    name: 'sing mid americana',
    filename: 'sing-mid-americana.mp3',
    prompt: 'Mid-tempo Americana instrumental, 94 BPM, acoustic guitar, mandolin, upright bass, brushed drums in D major, no vocals, folk-Americana karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'americana', 'folk', 'mandolin', 'upright-bass', 'bpm-94', 'tempo-mid'],
    loop: true, bpm: 94
  },

  // ─── UPBEAT (110–130 BPM) — 25 new tracks ───
  {
    name: 'sing upbeat pop radio dance',
    filename: 'sing-upbeat-pop-radio-dance.mp3',
    prompt: 'Upbeat pop dance instrumental, 116 BPM, four-on-the-floor drums, bright synth stabs, bass pluck in C major, no vocals, radio-pop karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop', 'dance', 'radio', 'bpm-116', 'tempo-upbeat', 'bright', 'happy'],
    loop: true, bpm: 116
  },
  {
    name: 'sing upbeat pop rock teen',
    filename: 'sing-upbeat-pop-rock-teen.mp3',
    prompt: 'Upbeat pop-rock teen anthem instrumental, 122 BPM, distorted power chords, punchy drums, bright hooks in G major, no vocals, coming-of-age karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop-rock', 'teen', 'anthem', 'bpm-122', 'tempo-upbeat', 'happy'],
    loop: true, bpm: 122
  },
  {
    name: 'sing upbeat rock classic driving',
    filename: 'sing-upbeat-rock-classic-driving.mp3',
    prompt: 'Upbeat classic rock driving instrumental, 120 BPM, palm-muted power-chord riff, steady drums, melodic bass in E major, no vocals, 80s rock karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'classic-rock', 'driving', '80s', 'bpm-120', 'tempo-upbeat'],
    loop: true, bpm: 120
  },
  {
    name: 'sing upbeat rock 80s arena',
    filename: 'sing-upbeat-rock-80s-arena.mp3',
    prompt: 'Upbeat 80s arena rock instrumental, 126 BPM, big gated-reverb drums, soaring lead guitar, stadium chorus in D major, no vocals, arena karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'arena', '80s', 'anthem', 'bpm-126', 'tempo-upbeat', 'epic'],
    loop: true, bpm: 126
  },
  {
    name: 'sing upbeat disco dance floor',
    filename: 'sing-upbeat-disco-dance-floor.mp3',
    prompt: 'Upbeat disco dance-floor instrumental, 122 BPM, four-on-the-floor kick, open hi-hats, strings, slap bass in A minor, no vocals, 70s disco karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'disco', 'dance', '70s', 'strings', 'bpm-122', 'tempo-upbeat'],
    loop: true, bpm: 122
  },
  {
    name: 'sing upbeat funk groovy',
    filename: 'sing-upbeat-funk-groovy.mp3',
    prompt: 'Upbeat groovy funk instrumental, 114 BPM, slap bass, wah guitar, horn stabs, tight drums in E9, no vocals, 70s funk karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'funk', 'groovy', '70s', 'slap-bass', 'horns', 'bpm-114', 'tempo-upbeat'],
    loop: true, bpm: 114
  },
  {
    name: 'sing upbeat motown soul fast',
    filename: 'sing-upbeat-motown-soul-fast.mp3',
    prompt: 'Upbeat Motown soul instrumental, 118 BPM, tambourine, bright piano, horns, bouncy bass in C major, no vocals, dance-floor soul karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'soul', 'motown', 'horns', 'tambourine', 'bpm-118', 'tempo-upbeat'],
    loop: true, bpm: 118
  },
  {
    name: 'sing upbeat country hoedown',
    filename: 'sing-upbeat-country-hoedown.mp3',
    prompt: 'Upbeat country hoedown instrumental, 124 BPM, fiddle, banjo, acoustic guitar, washboard in G major, no vocals, line-dance karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'hoedown', 'fiddle', 'banjo', 'bpm-124', 'tempo-upbeat', 'line-dance'],
    loop: true, bpm: 124
  },
  {
    name: 'sing upbeat country pop',
    filename: 'sing-upbeat-country-pop.mp3',
    prompt: 'Upbeat country-pop crossover instrumental, 118 BPM, acoustic strums, polished drums, banjo hooks in A major, no vocals, modern Nashville karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'country', 'country-pop', 'crossover', 'banjo', 'bpm-118', 'tempo-upbeat'],
    loop: true, bpm: 118
  },
  {
    name: 'sing upbeat folk stomp clap',
    filename: 'sing-upbeat-folk-stomp-clap.mp3',
    prompt: 'Upbeat indie folk stomp-clap instrumental, 120 BPM, kick-drum stomp, claps, strummed acoustic, mandolin in D major, no vocals, festival karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'folk', 'indie-folk', 'stomp-clap', 'mandolin', 'bpm-120', 'tempo-upbeat'],
    loop: true, bpm: 120
  },
  {
    name: 'sing upbeat reggae skank',
    filename: 'sing-upbeat-reggae-skank.mp3',
    prompt: 'Upbeat reggae skank instrumental, 114 BPM, off-beat guitar skank, bouncy bass, crisp drums in G major, no vocals, summer reggae karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'reggae', 'skank', 'summer', 'bpm-114', 'tempo-upbeat', 'happy'],
    loop: true, bpm: 114
  },
  {
    name: 'sing upbeat ska punk',
    filename: 'sing-upbeat-ska-punk.mp3',
    prompt: 'Upbeat ska-punk instrumental, 126 BPM, upstroke distorted guitar, horns, fast drums in A major, no vocals, festival ska karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'ska', 'ska-punk', 'horns', 'bpm-126', 'tempo-upbeat', 'energetic'],
    loop: true, bpm: 126
  },
  {
    name: 'sing upbeat latin salsa',
    filename: 'sing-upbeat-latin-salsa.mp3',
    prompt: 'Upbeat Latin salsa instrumental, 118 BPM, piano montuno, horn section, timbales, congas in C minor, no vocals, Havana karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'salsa', 'horns', 'timbales', 'bpm-118', 'tempo-upbeat'],
    loop: true, bpm: 118
  },
  {
    name: 'sing upbeat latin reggaeton',
    filename: 'sing-upbeat-latin-reggaeton.mp3',
    prompt: 'Upbeat reggaeton instrumental, 120 BPM, dembow drum pattern, deep bass, Latin synth hooks in A minor, no vocals, club reggaeton karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'reggaeton', 'dembow', 'club', 'bpm-120', 'tempo-upbeat'],
    loop: true, bpm: 120
  },
  {
    name: 'sing upbeat house deep',
    filename: 'sing-upbeat-house-deep.mp3',
    prompt: 'Upbeat deep house instrumental, 122 BPM, warm analog bassline, filtered pads, crisp hi-hats in G minor, no vocals, lounge-club karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'house', 'deep-house', 'club', 'bpm-122', 'tempo-upbeat', 'groovy'],
    loop: true, bpm: 122
  },
  {
    name: 'sing upbeat edm pop festival',
    filename: 'sing-upbeat-edm-pop-festival.mp3',
    prompt: 'Upbeat EDM-pop festival instrumental, 126 BPM, big synth chords, four-on-the-floor, drop hooks in F# minor, no vocals, main-stage karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'edm', 'edm-pop', 'festival', 'synth', 'bpm-126', 'tempo-upbeat', 'energetic'],
    loop: true, bpm: 126
  },
  {
    name: 'sing upbeat synthpop 80s',
    filename: 'sing-upbeat-synthpop-80s.mp3',
    prompt: 'Upbeat 80s synthpop instrumental, 118 BPM, gated reverb drums, analog synth lead, bright bass in E major, no vocals, 80s new wave karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'synthpop', '80s', 'new-wave', 'analog-synth', 'bpm-118', 'tempo-upbeat', 'retro'],
    loop: true, bpm: 118
  },
  {
    name: 'sing upbeat rnb pop',
    filename: 'sing-upbeat-rnb-pop.mp3',
    prompt: 'Upbeat R&B pop instrumental, 114 BPM, punchy drums, Rhodes stabs, smooth bass in Ab major, no vocals, modern R&B karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rnb', 'pop', 'modern', 'rhodes', 'bpm-114', 'tempo-upbeat', 'smooth'],
    loop: true, bpm: 114
  },
  {
    name: 'sing upbeat hip hop club',
    filename: 'sing-upbeat-hip-hop-club.mp3',
    prompt: 'Upbeat hip hop club instrumental, 120 BPM, hard-hitting drums, synth lead, 808 bass in C minor, no vocals, club rap karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'hip-hop', 'club', '808', 'synth', 'bpm-120', 'tempo-upbeat'],
    loop: true, bpm: 120
  },
  {
    name: 'sing upbeat gospel hand clap',
    filename: 'sing-upbeat-gospel-hand-clap.mp3',
    prompt: 'Upbeat gospel hand-clap instrumental, 112 BPM, hand claps, Hammond organ, tambourine, bright piano in F major, no vocals, celebration karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'gospel', 'hand-clap', 'celebration', 'organ', 'bpm-112', 'tempo-upbeat', 'joyful'],
    loop: true, bpm: 112
  },
  {
    name: 'sing upbeat swing big band',
    filename: 'sing-upbeat-swing-big-band.mp3',
    prompt: 'Upbeat swing big-band instrumental, 126 BPM, full horn section, walking upright bass, swing drums in Bb major, no vocals, ballroom karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'swing', 'big-band', 'horns', 'ballroom', 'bpm-126', 'tempo-upbeat'],
    loop: true, bpm: 126
  },
  {
    name: 'sing upbeat rockabilly',
    filename: 'sing-upbeat-rockabilly.mp3',
    prompt: 'Upbeat rockabilly instrumental, 124 BPM, slapback echo on electric guitar, upright bass, boom-chick drums in A major, no vocals, 50s karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rockabilly', '50s', 'slapback', 'upright-bass', 'bpm-124', 'tempo-upbeat', 'retro'],
    loop: true, bpm: 124
  },
  {
    name: 'sing upbeat bluegrass',
    filename: 'sing-upbeat-bluegrass.mp3',
    prompt: 'Upbeat bluegrass instrumental, 128 BPM, fast banjo rolls, fiddle, mandolin, upright bass in G major, no vocals, pickin-party karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'bluegrass', 'banjo', 'fiddle', 'mandolin', 'bpm-128', 'tempo-upbeat'],
    loop: true, bpm: 128
  },
  {
    name: 'sing upbeat celtic jig',
    filename: 'sing-upbeat-celtic-jig.mp3',
    prompt: 'Upbeat Celtic jig instrumental, 116 BPM (6/8), fiddle, tin whistle, bodhran, acoustic guitar in D major, no vocals, Irish pub karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'celtic', 'irish', 'jig', 'fiddle', 'tin-whistle', 'bodhran', 'bpm-116', 'tempo-upbeat'],
    loop: true, bpm: 116
  },
  {
    name: 'sing upbeat bollywood dance',
    filename: 'sing-upbeat-bollywood-dance.mp3',
    prompt: 'Upbeat Bollywood dance instrumental, 120 BPM, tabla, dholak, sitar melodies, bright strings in A minor, no vocals, Indian film karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'bollywood', 'indian', 'tabla', 'sitar', 'bpm-120', 'tempo-upbeat', 'world'],
    loop: true, bpm: 120
  },

  // ─── FAST / DRIVING (130–170 BPM) — 20 new tracks ───
  {
    name: 'sing fast punk rock',
    filename: 'sing-fast-punk-rock.mp3',
    prompt: 'Fast punk rock instrumental, 160 BPM, distorted barre-chord guitars, fast 8th-note bass, pounding drums in E major, no vocals, mosh karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'punk', 'punk-rock', 'fast', 'distorted', 'bpm-160', 'tempo-fast', 'energetic'],
    loop: true, bpm: 160
  },
  {
    name: 'sing fast pop punk',
    filename: 'sing-fast-pop-punk.mp3',
    prompt: 'Fast pop-punk instrumental, 154 BPM, melodic distorted guitars, driving drums, catchy bass in A major, no vocals, 2000s pop-punk karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'pop-punk', '2000s', 'melodic', 'bpm-154', 'tempo-fast', 'energetic'],
    loop: true, bpm: 154
  },
  {
    name: 'sing fast emo pop',
    filename: 'sing-fast-emo-pop.mp3',
    prompt: 'Fast emo pop instrumental, 148 BPM, chorused clean-to-distorted guitars, tight drums, minor-key progression in F# minor, no vocals, mid-2000s karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'emo', 'pop-punk', '2000s', 'minor', 'bpm-148', 'tempo-fast'],
    loop: true, bpm: 148
  },
  {
    name: 'sing fast metal power',
    filename: 'sing-fast-metal-power.mp3',
    prompt: 'Fast power-metal instrumental, 160 BPM, galloping palm-muted guitars, double-kick drums, melodic bass in D minor, no vocals, epic metal karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'metal', 'power-metal', 'epic', 'double-kick', 'bpm-160', 'tempo-fast', 'minor'],
    loop: true, bpm: 160
  },
  {
    name: 'sing fast rock driving',
    filename: 'sing-fast-rock-driving.mp3',
    prompt: 'Fast driving rock instrumental, 140 BPM, hard-rock riff, steady snare, melodic bass in E major, no vocals, highway rock karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rock', 'hard-rock', 'driving', 'bpm-140', 'tempo-fast', 'energetic'],
    loop: true, bpm: 140
  },
  {
    name: 'sing fast dnb drum bass',
    filename: 'sing-fast-dnb-drum-bass.mp3',
    prompt: 'Fast drum and bass instrumental, 170 BPM, chopped breakbeats, subby bass, atmospheric pads in G minor, no vocals, liquid-DnB karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'dnb', 'drum-and-bass', 'breakbeat', 'bpm-170', 'tempo-fast', 'electronic'],
    loop: true, bpm: 170
  },
  {
    name: 'sing fast dubstep bass',
    filename: 'sing-fast-dubstep-bass.mp3',
    prompt: 'Fast dubstep instrumental, 140 BPM (half-time 70 feel), heavy wobble bass, crunchy drums, dark synths in C# minor, no vocals, drop-heavy karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'dubstep', 'bass', 'electronic', 'dark', 'bpm-140', 'tempo-fast'],
    loop: true, bpm: 140
  },
  {
    name: 'sing fast house club',
    filename: 'sing-fast-house-club.mp3',
    prompt: 'Fast house club instrumental, 128 BPM, energetic four-on-the-floor, rolling bass, bright synth stabs in A minor, no vocals, peak-time club karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'house', 'club', 'peak-time', 'bpm-128', 'tempo-fast', 'electronic'],
    loop: true, bpm: 128
  },
  {
    name: 'sing fast trance euphoric',
    filename: 'sing-fast-trance-euphoric.mp3',
    prompt: 'Fast euphoric trance instrumental, 138 BPM, pulsing plucks, supersaw lead, big build and drop in F# minor, no vocals, mainstage trance karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'trance', 'euphoric', 'supersaw', 'edm', 'bpm-138', 'tempo-fast', 'uplifting'],
    loop: true, bpm: 138
  },
  {
    name: 'sing fast techno minimal',
    filename: 'sing-fast-techno-minimal.mp3',
    prompt: 'Fast minimal techno instrumental, 132 BPM, driving kick, subtle percussion, hypnotic synth loops in A minor, no vocals, warehouse karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'techno', 'minimal', 'warehouse', 'hypnotic', 'bpm-132', 'tempo-fast', 'electronic'],
    loop: true, bpm: 132
  },
  {
    name: 'sing fast surf rock',
    filename: 'sing-fast-surf-rock.mp3',
    prompt: 'Fast surf-rock instrumental, 148 BPM, reverb-drenched tremolo-picked guitar, boom-chick drums in E minor, no vocals, 60s surf karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'surf-rock', '60s', 'reverb', 'tremolo', 'bpm-148', 'tempo-fast'],
    loop: true, bpm: 148
  },
  {
    name: 'sing fast rockabilly bop',
    filename: 'sing-fast-rockabilly-bop.mp3',
    prompt: 'Fast rockabilly bop instrumental, 156 BPM, slapback guitar, slap upright bass, shuffling drums in A major, no vocals, 50s bop karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'rockabilly', '50s', 'bop', 'slapback', 'bpm-156', 'tempo-fast'],
    loop: true, bpm: 156
  },
  {
    name: 'sing fast bluegrass breakdown',
    filename: 'sing-fast-bluegrass-breakdown.mp3',
    prompt: 'Fast bluegrass breakdown instrumental, 160 BPM, fast banjo rolls, fiddle, mandolin in G major, no vocals, flatpickin karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'bluegrass', 'breakdown', 'banjo', 'fiddle', 'bpm-160', 'tempo-fast'],
    loop: true, bpm: 160
  },
  {
    name: 'sing fast celtic reel',
    filename: 'sing-fast-celtic-reel.mp3',
    prompt: 'Fast Celtic reel instrumental, 140 BPM, fast fiddle, tin whistle, bodhran, acoustic guitar in D major, no vocals, Irish reel karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'celtic', 'irish', 'reel', 'fiddle', 'tin-whistle', 'bpm-140', 'tempo-fast'],
    loop: true, bpm: 140
  },
  {
    name: 'sing fast latin merengue',
    filename: 'sing-fast-latin-merengue.mp3',
    prompt: 'Fast Latin merengue instrumental, 150 BPM, tambora, güira, horn section, piano in D major, no vocals, Dominican karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'merengue', 'horns', 'tambora', 'bpm-150', 'tempo-fast'],
    loop: true, bpm: 150
  },
  {
    name: 'sing fast samba carnival',
    filename: 'sing-fast-samba-carnival.mp3',
    prompt: 'Fast Brazilian samba carnival instrumental, 148 BPM, surdo drums, pandeiro, cuica, agogo bells in E major, no vocals, Rio carnival karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'latin', 'samba', 'brazilian', 'carnival', 'surdo', 'bpm-148', 'tempo-fast'],
    loop: true, bpm: 148
  },
  {
    name: 'sing fast kpop dance',
    filename: 'sing-fast-kpop-dance.mp3',
    prompt: 'Fast K-pop dance instrumental, 128 BPM, punchy synths, EDM-pop drops, crisp drums in B minor, no vocals, idol-group karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'kpop', 'dance', 'edm-pop', 'bpm-128', 'tempo-fast', 'energetic'],
    loop: true, bpm: 128
  },
  {
    name: 'sing fast jpop anime',
    filename: 'sing-fast-jpop-anime.mp3',
    prompt: 'Fast J-pop anime opening instrumental, 150 BPM, bright electric guitars, driving drums, orchestral stabs in D major, no vocals, anime-OP karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jpop', 'anime', 'opening', 'bpm-150', 'tempo-fast', 'energetic'],
    loop: true, bpm: 150
  },
  {
    name: 'sing fast swing bebop',
    filename: 'sing-fast-swing-bebop.mp3',
    prompt: 'Fast bebop jazz instrumental, 200 BPM (swung 8ths), fast walking upright bass, ride cymbal comping, piano comping in F major, no vocals, bebop karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'jazz', 'bebop', 'swing', 'fast', 'bpm-200', 'tempo-fast', 'upright-bass'],
    loop: true, bpm: 200
  },
  {
    name: 'sing fast disco peak hour',
    filename: 'sing-fast-disco-peak-hour.mp3',
    prompt: 'Fast peak-hour disco instrumental, 130 BPM, lush strings, slap bass, open hi-hats, four-on-the-floor in A minor, no vocals, studio-54 karaoke',
    duration: 22, type: 'music',
    keywords: ['sing', 'karaoke', 'instrumental', 'backing', 'disco', 'peak-hour', 'strings', '70s', 'bpm-130', 'tempo-fast'],
    loop: true, bpm: 130
  },

  // ═══════ CROWD REACTIONS for song-end applause ═══════
  {
    name: 'sing applause big crowd',
    filename: 'sing-applause-big-crowd.mp3',
    prompt: 'Large enthusiastic concert crowd clapping and cheering after a song, big arena applause, whistles and shouts, triumphant ovation, stadium reaction',
    duration: 7,
    type: 'sfx',
    keywords: ['applause', 'clap', 'cheer', 'crowd', 'ovation', 'concert', 'sing', 'song-end', 'arena', 'stadium'],
    loop: false
  },
  {
    name: 'sing applause small intimate',
    filename: 'sing-applause-small-intimate.mp3',
    prompt: 'Small intimate audience clapping politely after a song, coffeehouse applause, 15-20 people, warm and genuine, small venue',
    duration: 5,
    type: 'sfx',
    keywords: ['applause', 'clap', 'cheer', 'crowd', 'intimate', 'coffeehouse', 'sing', 'song-end', 'small'],
    loop: false
  },
  {
    name: 'sing crowd whistle cheer',
    filename: 'sing-crowd-whistle-cheer.mp3',
    prompt: 'Excited crowd whistling and cheering enthusiastically, loud single whistles plus yeah shouts and claps, encore reaction, performance appreciation',
    duration: 4,
    type: 'sfx',
    keywords: ['whistle', 'cheer', 'crowd', 'applause', 'sing', 'song-end', 'encore', 'enthusiastic'],
    loop: false
  }
];

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    // Network hiccup: treat as missing so we try to re-upload.
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
      // Lower prompt_influence lets the model be more musical / less literal.
      prompt_influence: 0.35
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

  console.log(`Starting Sing Mode generation — ${SING_SOUNDS.length} sounds planned.`);
  let successes = 0;
  let skippedCatalog = 0;
  let failures = 0;

  for (const sound of SING_SOUNDS) {
    console.log(`\n→ ${sound.name}`);

    const ok = await generateAndUpload(sound);
    if (!ok) { failures++; continue; }

    if (existingNames.has(sound.name)) {
      console.log(`  = Already in catalog, not duplicating.`);
      skippedCatalog++;
      continue;
    }

    const entry = {
      type: sound.type,
      name: sound.name,
      file: `sounds/${sound.filename}`,
      keywords: sound.keywords,
    };
    if (sound.loop) entry.loop = true;
    if (sound.bpm) entry.bpm = sound.bpm;
    catalog.push(entry);
    existingNames.add(sound.name);
    successes++;

    // Pause a tick between generations to be polite to ElevenLabs.
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
