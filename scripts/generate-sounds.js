/**
 * Generate missing sound effects via ElevenLabs Sound Generation API,
 * upload them to R2, and update saved-sounds.json.
 *
 * Usage: node scripts/generate-sounds.js
 *
 * Requires .env.local (ELEVENLABS_API_KEY, R2_* vars).
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

// ── 100 NEW SOUNDS ──────────────────────────────────────────────────────────
// Each entry: { name, filename, prompt, duration, type, keywords, loop }
const NEW_SOUNDS = [
  // ═══════ MUSIC (25 tracks) ═══════
  { name: 'stealth sneaking music', filename: 'stealth-sneaking-music.mp3', prompt: 'Tense quiet sneaking stealth music, soft plucked strings, muted percussion, suspenseful spy infiltration ambience, cinematic', duration: 22, type: 'music', keywords: ['stealth', 'sneaking', 'suspense', 'rogue', 'thief', 'infiltration', 'quiet', 'tension'], loop: false },
  { name: 'sea shanty sailing music', filename: 'sea-shanty-sailing-music.mp3', prompt: 'Rousing sea shanty with accordion and fiddle, pirate adventure sailing music, upbeat maritime folk melody', duration: 22, type: 'music', keywords: ['sea', 'shanty', 'pirate', 'sailing', 'maritime', 'adventure', 'nautical', 'folk'], loop: false },
  { name: 'desert caravan music', filename: 'desert-caravan-music.mp3', prompt: 'Exotic Middle Eastern desert music, oud and tabla, mysterious caravan journey through sand dunes, Arabian ambient', duration: 22, type: 'music', keywords: ['desert', 'arabian', 'exotic', 'caravan', 'middle eastern', 'sand', 'dunes', 'oud'], loop: false },
  { name: 'swamp bayou music', filename: 'swamp-bayou-music.mp3', prompt: 'Dark eerie swamp bayou music, slow slide guitar, muffled percussion, foggy humid marsh atmosphere, mysterious', duration: 22, type: 'music', keywords: ['swamp', 'bayou', 'marsh', 'eerie', 'foggy', 'damp', 'murky', 'dark'], loop: false },
  { name: 'victory celebration music', filename: 'victory-celebration-music.mp3', prompt: 'Triumphant orchestral victory celebration music, brass fanfare, soaring strings, heroic uplifting joyful', duration: 22, type: 'music', keywords: ['victory', 'celebration', 'triumph', 'heroic', 'fanfare', 'win', 'glory', 'uplifting'], loop: false },
  { name: 'chase pursuit music', filename: 'chase-pursuit-music.mp3', prompt: 'Fast-paced chase pursuit action music, driving percussion, urgent strings, breathless running escape cinematic', duration: 22, type: 'music', keywords: ['chase', 'pursuit', 'action', 'running', 'escape', 'urgent', 'fast', 'intense'], loop: false },
  { name: 'mystery investigation music', filename: 'mystery-investigation-music.mp3', prompt: 'Mysterious investigation detective music, soft piano and light strings, clue-finding puzzle-solving ambient, noir', duration: 22, type: 'music', keywords: ['mystery', 'investigation', 'detective', 'clue', 'puzzle', 'noir', 'curious', 'intrigue'], loop: false },
  { name: 'tribal jungle drums music', filename: 'tribal-jungle-drums-music.mp3', prompt: 'Primal tribal jungle music, deep rhythmic hand drums, wooden percussion, raw animal energy, exotic rainforest', duration: 22, type: 'music', keywords: ['tribal', 'jungle', 'drums', 'primal', 'rainforest', 'exotic', 'ritual', 'native'], loop: false },
  { name: 'underwater depths music', filename: 'underwater-depths-music.mp3', prompt: 'Deep underwater ambient music, slow ethereal pads, whale-like tones, muffled and echoey, mysterious ocean depths', duration: 22, type: 'music', keywords: ['underwater', 'deep', 'ocean', 'mysterious', 'submerged', 'abyss', 'ambient', 'ethereal'], loop: false },
  { name: 'royal court throne music', filename: 'royal-court-throne-music.mp3', prompt: 'Regal royal court music, elegant harpsichord and strings, noble dignified throne room, baroque orchestral', duration: 22, type: 'music', keywords: ['royal', 'court', 'throne', 'regal', 'noble', 'king', 'queen', 'baroque', 'elegant'], loop: false },
  { name: 'funeral dirge music', filename: 'funeral-dirge-music.mp3', prompt: 'Somber funeral dirge music, slow mournful cello and low brass, grief and loss, processional, dark and heavy', duration: 22, type: 'music', keywords: ['funeral', 'dirge', 'mourning', 'somber', 'death', 'grief', 'loss', 'solemn'], loop: false },
  { name: 'dawn sunrise music', filename: 'dawn-sunrise-music.mp3', prompt: 'Hopeful dawn sunrise music, gentle flute and soft strings, morning light breaking, peaceful new beginning, warm', duration: 22, type: 'music', keywords: ['dawn', 'sunrise', 'morning', 'hopeful', 'new beginning', 'warm', 'peaceful', 'gentle'], loop: false },
  { name: 'frozen tundra music', filename: 'frozen-tundra-music.mp3', prompt: 'Cold frozen tundra ambient music, shimmering icy pads, distant crystalline bells, harsh winter wind undertone, desolate', duration: 22, type: 'music', keywords: ['frozen', 'tundra', 'ice', 'winter', 'cold', 'arctic', 'desolate', 'harsh'], loop: false },
  { name: 'volcanic cavern music', filename: 'volcanic-cavern-music.mp3', prompt: 'Ominous volcanic cavern music, deep rumbling bass, fiery dramatic percussion, underground lava flow, intense heat', duration: 22, type: 'music', keywords: ['volcanic', 'cavern', 'lava', 'fire', 'underground', 'intense', 'ominous', 'magma'], loop: false },
  { name: 'space cosmic ambient music', filename: 'space-cosmic-ambient-music.mp3', prompt: 'Vast cosmic space ambient music, slow evolving synthesizer pads, distant stars, zero gravity floating, sci-fi ethereal', duration: 22, type: 'music', keywords: ['space', 'cosmic', 'sci-fi', 'ambient', 'stars', 'galaxy', 'ethereal', 'vast'], loop: false },
  { name: 'mountain summit epic music', filename: 'mountain-summit-epic-music.mp3', prompt: 'Majestic mountain summit epic music, soaring horns, sweeping strings, vast panoramic views, achievement, awe-inspiring', duration: 22, type: 'music', keywords: ['mountain', 'summit', 'epic', 'majestic', 'vast', 'panoramic', 'achievement', 'awe'], loop: false },
  { name: 'marketplace bazaar music', filename: 'marketplace-bazaar-music.mp3', prompt: 'Busy colorful marketplace bazaar music, exotic instruments, sitar and hand drums, lively trading, Middle Eastern flair', duration: 22, type: 'music', keywords: ['marketplace', 'bazaar', 'market', 'trading', 'exotic', 'colorful', 'busy', 'lively'], loop: false },
  { name: 'romantic serenade music', filename: 'romantic-serenade-music.mp3', prompt: 'Beautiful romantic serenade music, gentle acoustic guitar, warm violin melody, love scene, tender and intimate', duration: 22, type: 'music', keywords: ['romantic', 'serenade', 'love', 'tender', 'intimate', 'gentle', 'beautiful', 'warm'], loop: false },
  { name: 'dungeon crawl dark music', filename: 'dungeon-crawl-dark-music.mp3', prompt: 'Dark foreboding dungeon crawl music, low drones, sparse metallic percussion, dripping echo, claustrophobic underground', duration: 22, type: 'music', keywords: ['dungeon', 'crawl', 'dark', 'underground', 'foreboding', 'claustrophobic', 'dnd', 'exploration'], loop: false },
  { name: 'war aftermath somber music', filename: 'war-aftermath-somber-music.mp3', prompt: 'Somber war aftermath music, lonely solo violin over devastated battlefield, loss and reflection, cinematic emotional', duration: 22, type: 'music', keywords: ['war', 'aftermath', 'somber', 'devastation', 'loss', 'reflection', 'battlefield', 'emotional'], loop: false },
  { name: 'enchanted garden music', filename: 'enchanted-garden-music.mp3', prompt: 'Whimsical enchanted garden fairy music, sparkling chimes, gentle harp, magical woodland, light and dreamy, fantasy', duration: 22, type: 'music', keywords: ['enchanted', 'garden', 'fairy', 'magical', 'whimsical', 'dreamy', 'woodland', 'fantasy'], loop: false },
  { name: 'ancient temple mystical music', filename: 'ancient-temple-mystical-music.mp3', prompt: 'Ancient temple mystical music, reverberant chanting monks, deep gong, stone chamber echoes, sacred and mysterious', duration: 22, type: 'music', keywords: ['ancient', 'temple', 'mystical', 'sacred', 'monks', 'chanting', 'mysterious', 'ritual'], loop: false },
  { name: 'bandit ambush music', filename: 'bandit-ambush-music.mp3', prompt: 'Sudden bandit ambush combat music, fast aggressive fiddle and drums, outlaw attack, dangerous chaotic energy', duration: 22, type: 'music', keywords: ['bandit', 'ambush', 'outlaw', 'danger', 'attack', 'chaotic', 'aggressive', 'combat'], loop: false },
  { name: 'drunken tavern jig music', filename: 'drunken-tavern-jig-music.mp3', prompt: 'Lively drunken tavern jig music, fast fiddle and stomping, merry pub drinking song, rowdy joyful medieval', duration: 22, type: 'music', keywords: ['tavern', 'drunk', 'jig', 'merry', 'pub', 'drinking', 'rowdy', 'medieval', 'jolly'], loop: false },
  { name: 'dragon lair ominous music', filename: 'dragon-lair-ominous-music.mp3', prompt: 'Ominous dragon lair music, deep oppressive brass, rumbling bass, massive treasure hoard, impending danger, epic fantasy', duration: 22, type: 'music', keywords: ['dragon', 'lair', 'ominous', 'treasure', 'danger', 'epic', 'fantasy', 'boss', 'dnd'], loop: false },

  // ═══════ SFX - NATURE & ANIMALS (15) ═══════
  { name: 'insect buzzing swarm', filename: 'insect-buzzing-swarm.mp3', prompt: 'Swarm of buzzing insects, bees and wasps flying around aggressively, menacing hive sound effect', duration: 5, type: 'sfx', keywords: ['insect', 'buzzing', 'bee', 'swarm', 'wasp', 'hive', 'flies'], loop: false },
  { name: 'frog croaking pond', filename: 'frog-croaking-pond.mp3', prompt: 'Frogs croaking and ribbiting at a pond at night, swamp ambience, multiple toads', duration: 6, type: 'sfx', keywords: ['frog', 'croak', 'toad', 'pond', 'swamp', 'ribbit', 'night'], loop: false },
  { name: 'hawk falcon dive screech', filename: 'hawk-falcon-dive-screech.mp3', prompt: 'Sharp hawk screech diving through the air, falcon hunting cry, raptor bird of prey swooping', duration: 3, type: 'sfx', keywords: ['hawk', 'falcon', 'dive', 'screech', 'raptor', 'bird', 'prey', 'hunting'], loop: false },
  { name: 'whale song deep ocean', filename: 'whale-song-deep-ocean.mp3', prompt: 'Haunting whale song echoing through deep ocean, long mournful calls, underwater cetacean communication', duration: 10, type: 'sfx', keywords: ['whale', 'song', 'ocean', 'deep', 'mournful', 'underwater', 'majestic'], loop: false },
  { name: 'seagull calls coastal', filename: 'seagull-calls-coastal.mp3', prompt: 'Seagulls calling and crying at the coast, multiple gulls squawking, beach harbor ocean birds', duration: 6, type: 'sfx', keywords: ['seagull', 'gull', 'coast', 'beach', 'harbor', 'ocean', 'bird', 'squawk'], loop: false },
  { name: 'elephant trumpet call', filename: 'elephant-trumpet-call.mp3', prompt: 'Loud elephant trumpeting call, powerful trunk blast, majestic jungle beast sound effect', duration: 4, type: 'sfx', keywords: ['elephant', 'trumpet', 'call', 'trunk', 'jungle', 'majestic', 'beast', 'loud'], loop: false },
  { name: 'monkey screech jungle', filename: 'monkey-screech-jungle.mp3', prompt: 'Monkeys screeching and chattering in jungle canopy, excited primates, tropical rainforest wildlife', duration: 5, type: 'sfx', keywords: ['monkey', 'screech', 'jungle', 'ape', 'primate', 'chatter', 'tropical', 'canopy'], loop: false },
  { name: 'deer stag bellow', filename: 'deer-stag-bellow.mp3', prompt: 'Deep stag bellowing in the forest, male deer rutting call, elk bugle, majestic woodland creature', duration: 5, type: 'sfx', keywords: ['deer', 'stag', 'bellow', 'elk', 'bugle', 'forest', 'rutting', 'woodland'], loop: false },
  { name: 'cricket chorus night', filename: 'cricket-chorus-night.mp3', prompt: 'Loud cricket chorus chirping at night, summer evening insects, rhythmic chirping ambient', duration: 8, type: 'sfx', keywords: ['cricket', 'chirp', 'night', 'insect', 'summer', 'evening', 'chorus'], loop: true },
  { name: 'child laughing playing', filename: 'child-laughing-playing.mp3', prompt: 'Children laughing happily while playing, joyful innocent giggles, kids having fun outdoors', duration: 5, type: 'sfx', keywords: ['child', 'laughing', 'playing', 'joyful', 'kids', 'giggle', 'innocent', 'happy'], loop: false },

  // ═══════ SFX - COMBAT & WEAPONS (15) ═══════
  { name: 'crossbow shot bolt', filename: 'crossbow-shot-bolt.mp3', prompt: 'Crossbow bolt firing, mechanical twang release, projectile whoosh, medieval ranged weapon shot', duration: 2, type: 'sfx', keywords: ['crossbow', 'bolt', 'shot', 'twang', 'weapon', 'ranged', 'medieval', 'fire'], loop: false },
  { name: 'mace heavy impact', filename: 'mace-heavy-impact.mp3', prompt: 'Heavy mace crushing impact on armor, blunt weapon slamming into metal and bone, devastating hit', duration: 2, type: 'sfx', keywords: ['mace', 'impact', 'heavy', 'crush', 'blunt', 'weapon', 'hit', 'armor'], loop: false },
  { name: 'staff ground slam', filename: 'staff-ground-slam.mp3', prompt: 'Wizard staff slamming hard on stone floor, deep reverberating thud, magical ground impact, powerful', duration: 3, type: 'sfx', keywords: ['staff', 'slam', 'ground', 'wizard', 'thud', 'magic', 'stone', 'impact'], loop: false },
  { name: 'arrow volley battle', filename: 'arrow-volley-battle.mp3', prompt: 'Massive volley of arrows raining down, hundreds of arrows whooshing through the air, medieval battle barrage', duration: 5, type: 'sfx', keywords: ['arrow', 'volley', 'rain', 'battle', 'barrage', 'medieval', 'siege', 'war'], loop: false },
  { name: 'cavalry charge hooves', filename: 'cavalry-charge-hooves.mp3', prompt: 'Thundering cavalry charge, many horses galloping in formation, armored riders charging into battle, ground shaking', duration: 8, type: 'sfx', keywords: ['cavalry', 'charge', 'hooves', 'horses', 'army', 'galloping', 'battle', 'thundering'], loop: false },
  { name: 'catapult launch boulder', filename: 'catapult-launch-boulder.mp3', prompt: 'Catapult launching a massive boulder, wooden creak and snap of release, heavy projectile whooshing through air', duration: 4, type: 'sfx', keywords: ['catapult', 'launch', 'boulder', 'siege', 'trebuchet', 'projectile', 'medieval', 'war'], loop: false },
  { name: 'battering ram impact', filename: 'battering-ram-impact.mp3', prompt: 'Heavy battering ram slamming into castle gate, massive wood and iron impact, siege warfare, shaking foundations', duration: 4, type: 'sfx', keywords: ['battering', 'ram', 'gate', 'siege', 'castle', 'impact', 'war', 'breach'], loop: false },
  { name: 'flail morningstar swing', filename: 'flail-morningstar-swing.mp3', prompt: 'Spiked flail morning star swinging through air with chain rattling, heavy medieval weapon whoosh and clink', duration: 3, type: 'sfx', keywords: ['flail', 'morningstar', 'chain', 'swing', 'weapon', 'medieval', 'spiked', 'heavy'], loop: false },
  { name: 'shield wall formation', filename: 'shield-wall-formation.mp3', prompt: 'Soldiers forming shield wall, multiple shields locking together, armor clanking, disciplined troops bracing', duration: 4, type: 'sfx', keywords: ['shield', 'wall', 'formation', 'army', 'soldiers', 'defense', 'brace', 'lock'], loop: false },
  { name: 'bowstring draw tension', filename: 'bowstring-draw-tension.mp3', prompt: 'Bowstring being slowly drawn back under tension, creaking taut string, aiming before release, quiet suspense', duration: 3, type: 'sfx', keywords: ['bowstring', 'draw', 'tension', 'aim', 'creak', 'bow', 'archer', 'ready'], loop: false },
  { name: 'war horn battle signal', filename: 'war-horn-battle-signal.mp3', prompt: 'Deep booming war horn blown as battle signal, long resonating blast echoing across battlefield, commanding', duration: 6, type: 'sfx', keywords: ['war', 'horn', 'battle', 'signal', 'blast', 'charge', 'command', 'resonating'], loop: false },
  { name: 'creature death cry', filename: 'creature-death-cry.mp3', prompt: 'Monster creature death cry, agonized final roar trailing off to silence, beast dying gurgle, fantasy RPG', duration: 4, type: 'sfx', keywords: ['creature', 'death', 'dying', 'monster', 'roar', 'final', 'beast', 'kill'], loop: false },
  { name: 'dragonfire breath blast', filename: 'dragonfire-breath-blast.mp3', prompt: 'Massive dragon breathing fire, roaring flame breath blast, intense heat whoosh, devastating fantasy attack', duration: 6, type: 'sfx', keywords: ['dragon', 'fire', 'breath', 'blast', 'flame', 'roar', 'devastating', 'attack'], loop: false },
  { name: 'armor removing clank', filename: 'armor-removing-clank.mp3', prompt: 'Taking off heavy plate armor, metal pieces clanking and unbuckling, chainmail sliding off, medieval knight', duration: 5, type: 'sfx', keywords: ['armor', 'removing', 'clank', 'metal', 'unbuckle', 'chainmail', 'knight', 'plate'], loop: false },
  { name: 'ship cannon broadside', filename: 'ship-cannon-broadside.mp3', prompt: 'Naval broadside cannon fire, multiple cannons firing in sequence from a ship, roaring blasts over ocean, pirate battle', duration: 6, type: 'sfx', keywords: ['cannon', 'broadside', 'ship', 'naval', 'pirate', 'battle', 'volley', 'blast'], loop: false },

  // ═══════ SFX - MAGIC & SUPERNATURAL (10) ═══════
  { name: 'resurrection divine magic', filename: 'resurrection-divine-magic.mp3', prompt: 'Divine resurrection spell, heavenly choir rising, warm golden light magic, bringing back from death, holy power', duration: 5, type: 'sfx', keywords: ['resurrection', 'revival', 'divine', 'life', 'holy', 'restore', 'raise', 'death'], loop: false },
  { name: 'transformation shapeshifting', filename: 'transformation-shapeshifting.mp3', prompt: 'Magical transformation shapeshifting sound, bones cracking and flesh morphing, wet organic magical change, disturbing', duration: 5, type: 'sfx', keywords: ['transformation', 'shapeshift', 'morph', 'polymorph', 'change', 'druid', 'werewolf', 'form'], loop: false },
  { name: 'time stop freeze effect', filename: 'time-stop-freeze-effect.mp3', prompt: 'Time stop spell freezing everything, deep bass drop to absolute silence, temporal distortion, reality halting', duration: 4, type: 'sfx', keywords: ['time', 'stop', 'freeze', 'temporal', 'distortion', 'halt', 'pause', 'spell'], loop: false },
  { name: 'telekinesis force hum', filename: 'telekinesis-force-hum.mp3', prompt: 'Telekinesis force lifting objects, deep resonating hum building in power, psychic energy crackling, mind power', duration: 4, type: 'sfx', keywords: ['telekinesis', 'force', 'psychic', 'mind', 'lift', 'hum', 'power', 'mental'], loop: false },
  { name: 'summoning circle energy', filename: 'summoning-circle-energy.mp3', prompt: 'Summoning circle activating with building magical energy, swirling arcane power, runes glowing, portal forming', duration: 6, type: 'sfx', keywords: ['summoning', 'circle', 'ritual', 'portal', 'arcane', 'runes', 'energy', 'conjure'], loop: false },
  { name: 'crystal magic chime', filename: 'crystal-magic-chime.mp3', prompt: 'Magical crystal chiming and resonating, sparkling crystalline tones, enchanted gem pulsing with power, fantasy', duration: 4, type: 'sfx', keywords: ['crystal', 'chime', 'magic', 'gem', 'sparkle', 'resonating', 'enchanted', 'mystical'], loop: false },
  { name: 'dark energy pulse', filename: 'dark-energy-pulse.mp3', prompt: 'Dark energy pulse blast, ominous bass throb, evil magic releasing, shadowy force wave, necromantic power', duration: 3, type: 'sfx', keywords: ['dark', 'energy', 'pulse', 'evil', 'shadow', 'necromantic', 'force', 'blast'], loop: false },
  { name: 'enchantment sparkle apply', filename: 'enchantment-sparkle-apply.mp3', prompt: 'Enchantment being applied to weapon or item, magical sparkles and shimmering, buff spell activating, fantasy RPG', duration: 3, type: 'sfx', keywords: ['enchantment', 'sparkle', 'buff', 'apply', 'weapon', 'item', 'shimmer', 'magic'], loop: false },
  { name: 'ward barrier activate', filename: 'ward-barrier-activate.mp3', prompt: 'Magical ward barrier activating, protective force field humming to life, energy shield forming, defensive spell', duration: 4, type: 'sfx', keywords: ['ward', 'barrier', 'shield', 'protection', 'force', 'defense', 'activate', 'spell'], loop: false },
  { name: 'soul drain dark magic', filename: 'soul-drain-dark-magic.mp3', prompt: 'Soul draining dark magic, eerie ethereal suction, life force being pulled away, ghostly wailing, evil spell', duration: 5, type: 'sfx', keywords: ['soul', 'drain', 'dark', 'life', 'wailing', 'evil', 'necromantic', 'death'], loop: false },

  // ═══════ SFX - ENVIRONMENT & WEATHER (12) ═══════
  { name: 'volcano eruption rumble', filename: 'volcano-eruption-rumble.mp3', prompt: 'Volcano erupting with deep ground-shaking rumble, lava explosions, ash and rock blasting upward, catastrophic', duration: 8, type: 'sfx', keywords: ['volcano', 'eruption', 'rumble', 'lava', 'explosion', 'catastrophic', 'disaster', 'earth'], loop: false },
  { name: 'lava bubbling flow', filename: 'lava-bubbling-flow.mp3', prompt: 'Thick lava bubbling and flowing slowly, molten rock gurgling, volcanic magma, intense heat sizzling', duration: 8, type: 'sfx', keywords: ['lava', 'bubbling', 'magma', 'volcanic', 'molten', 'flow', 'hot', 'gurgling'], loop: true },
  { name: 'heavy rain downpour', filename: 'heavy-rain-downpour.mp3', prompt: 'Intense heavy rain downpour, monsoon-like deluge, loud rainfall hammering on rooftops and ground, torrential', duration: 10, type: 'sfx', keywords: ['rain', 'heavy', 'downpour', 'monsoon', 'torrential', 'deluge', 'storm', 'intense'], loop: true },
  { name: 'hail storm pelting', filename: 'hail-storm-pelting.mp3', prompt: 'Hailstorm pelting with ice chunks, hail hitting roof and ground, harsh frozen precipitation, damaging storm', duration: 8, type: 'sfx', keywords: ['hail', 'storm', 'ice', 'pelting', 'frozen', 'precipitation', 'harsh', 'weather'], loop: false },
  { name: 'ice cracking breaking', filename: 'ice-cracking-breaking.mp3', prompt: 'Thick ice cracking and breaking apart, frozen lake surface fracturing, sharp crystalline snapping sounds', duration: 5, type: 'sfx', keywords: ['ice', 'cracking', 'breaking', 'frozen', 'fracture', 'lake', 'shatter', 'cold'], loop: false },
  { name: 'rockslide avalanche', filename: 'rockslide-avalanche.mp3', prompt: 'Massive rockslide with boulders tumbling down mountainside, cascading debris, ground shaking, destructive landslide', duration: 7, type: 'sfx', keywords: ['rockslide', 'avalanche', 'boulder', 'landslide', 'debris', 'mountain', 'collapse', 'rumble'], loop: false },
  { name: 'quicksand sinking', filename: 'quicksand-sinking.mp3', prompt: 'Sinking into quicksand, thick wet sucking mud sound, struggling, squelching, slowly being pulled under', duration: 6, type: 'sfx', keywords: ['quicksand', 'sinking', 'mud', 'trap', 'sucking', 'stuck', 'struggle', 'sand'], loop: false },
  { name: 'splash water dive', filename: 'splash-water-dive.mp3', prompt: 'Large splash diving into water, body plunging into lake or river, big impact splash, water displacement', duration: 3, type: 'sfx', keywords: ['splash', 'dive', 'water', 'plunge', 'jump', 'lake', 'river', 'impact'], loop: false },
  { name: 'bubbling brook gentle', filename: 'bubbling-brook-gentle.mp3', prompt: 'Gentle bubbling brook stream, peaceful water trickling over rocks, calm forest creek, nature ambience', duration: 10, type: 'sfx', keywords: ['brook', 'stream', 'babbling', 'gentle', 'trickling', 'creek', 'peaceful', 'water'], loop: true },
  { name: 'sail canvas unfurling', filename: 'sail-canvas-unfurling.mp3', prompt: 'Large canvas sail unfurling and catching wind, flapping fabric, rope creaking, sailing ship setting sail', duration: 5, type: 'sfx', keywords: ['sail', 'canvas', 'unfurl', 'wind', 'ship', 'fabric', 'flapping', 'nautical'], loop: false },
  { name: 'rowing oars water', filename: 'rowing-oars-water.mp3', prompt: 'Rhythmic rowing oars dipping into water, wooden oarlocks creaking, small boat paddling across calm water', duration: 8, type: 'sfx', keywords: ['rowing', 'oars', 'paddle', 'boat', 'water', 'creaking', 'dipping', 'rhythmic'], loop: false },
  { name: 'gentle breeze wind chimes', filename: 'gentle-breeze-wind-chimes.mp3', prompt: 'Gentle breeze with wind chimes tinkling softly, peaceful garden ambience, light metallic ringing in the wind', duration: 8, type: 'sfx', keywords: ['breeze', 'wind', 'chimes', 'gentle', 'garden', 'peaceful', 'tinkling', 'soft'], loop: true },

  // ═══════ SFX - DUNGEON & MECHANICAL (8) ═══════
  { name: 'alarm bell medieval', filename: 'alarm-bell-medieval.mp3', prompt: 'Urgent medieval alarm bell ringing frantically, warning bell clanging, alerting guards, castle under attack', duration: 6, type: 'sfx', keywords: ['alarm', 'bell', 'warning', 'medieval', 'alert', 'guard', 'castle', 'urgent'], loop: false },
  { name: 'pickaxe mining stone', filename: 'pickaxe-mining-stone.mp3', prompt: 'Pickaxe striking stone wall in mine, rhythmic chipping at rock, mining ore, metal on stone impact', duration: 5, type: 'sfx', keywords: ['pickaxe', 'mining', 'stone', 'ore', 'rock', 'strike', 'mine', 'dig'], loop: false },
  { name: 'boulder rolling trap', filename: 'boulder-rolling-trap.mp3', prompt: 'Giant boulder starting to roll, getting louder and faster, Indiana Jones style rolling stone trap, rumbling', duration: 6, type: 'sfx', keywords: ['boulder', 'rolling', 'trap', 'stone', 'rumble', 'dungeon', 'danger', 'crushing'], loop: false },
  { name: 'bridge wood creaking', filename: 'bridge-wood-creaking.mp3', prompt: 'Old wooden bridge creaking and groaning under weight, planks shifting, rope bridge swaying, precarious', duration: 5, type: 'sfx', keywords: ['bridge', 'wood', 'creaking', 'groaning', 'rickety', 'rope', 'swaying', 'precarious'], loop: false },
  { name: 'rusty hinge squeak', filename: 'rusty-hinge-squeak.mp3', prompt: 'Old rusty metal hinge squeaking loudly, ancient door or gate slowly opening, grinding corroded metal', duration: 3, type: 'sfx', keywords: ['rusty', 'hinge', 'squeak', 'old', 'metal', 'door', 'gate', 'corroded'], loop: false },
  { name: 'barrel rolling cellar', filename: 'barrel-rolling-cellar.mp3', prompt: 'Wooden barrel rolling across stone cellar floor, heavy round wood tumbling, bouncing on cobblestone', duration: 4, type: 'sfx', keywords: ['barrel', 'rolling', 'cellar', 'wood', 'stone', 'tumbling', 'cobblestone', 'heavy'], loop: false },
  { name: 'secret passage wall', filename: 'secret-passage-wall.mp3', prompt: 'Hidden secret passage opening in stone wall, grinding stone mechanism, dust falling, ancient hidden doorway', duration: 5, type: 'sfx', keywords: ['secret', 'passage', 'wall', 'stone', 'hidden', 'mechanism', 'grinding', 'ancient'], loop: false },
  { name: 'trap dart spring', filename: 'trap-dart-spring.mp3', prompt: 'Dungeon dart trap triggering, spring mechanism releasing, small darts whooshing past, pressure plate click', duration: 2, type: 'sfx', keywords: ['trap', 'dart', 'spring', 'poison', 'dungeon', 'pressure', 'mechanism', 'trigger'], loop: false },

  // ═══════ SFX - ITEMS & INTERACTIONS (10) ═══════
  { name: 'dice rolling table', filename: 'dice-rolling-table.mp3', prompt: 'Multiple dice rolling across wooden table, tumbling polyhedrals, tabletop RPG dice roll, clinking to a stop', duration: 3, type: 'sfx', keywords: ['dice', 'roll', 'table', 'gambling', 'rpg', 'tabletop', 'tumble', 'chance'], loop: false },
  { name: 'coin toss flip', filename: 'coin-toss-flip.mp3', prompt: 'Single coin being flipped into the air, spinning metal, catching coin, decisive moment', duration: 2, type: 'sfx', keywords: ['coin', 'toss', 'flip', 'decision', 'spinning', 'metal', 'catch', 'chance'], loop: false },
  { name: 'quill writing parchment', filename: 'quill-writing-parchment.mp3', prompt: 'Quill pen scratching on parchment paper, writing notes, ink scritching, scholarly scribbling, medieval writing', duration: 6, type: 'sfx', keywords: ['quill', 'writing', 'parchment', 'scroll', 'ink', 'scribble', 'scholar', 'pen'], loop: false },
  { name: 'scroll unfurling open', filename: 'scroll-unfurling-open.mp3', prompt: 'Old parchment scroll being unfurled and opened, paper rustling, ancient document unrolling, important revelation', duration: 3, type: 'sfx', keywords: ['scroll', 'unfurl', 'parchment', 'paper', 'open', 'ancient', 'document', 'reveal'], loop: false },
  { name: 'glass clink toast', filename: 'glass-clink-toast.mp3', prompt: 'Two glasses or goblets clinking together in a toast, celebration drink, cheers, metallic ring', duration: 2, type: 'sfx', keywords: ['glass', 'clink', 'toast', 'cheers', 'goblet', 'drink', 'celebration', 'tavern'], loop: false },
  { name: 'cooking fire sizzle', filename: 'cooking-fire-sizzle.mp3', prompt: 'Food sizzling and cooking over open fire, meat on spit, fat dripping into flames, kitchen sounds', duration: 6, type: 'sfx', keywords: ['cooking', 'sizzle', 'fire', 'food', 'meat', 'kitchen', 'frying', 'grilling'], loop: false },
  { name: 'wood chopping axe', filename: 'wood-chopping-axe.mp3', prompt: 'Axe chopping wood logs, sharp impacts splitting lumber, lumberjack chopping firewood, crack and split', duration: 5, type: 'sfx', keywords: ['wood', 'chopping', 'axe', 'lumber', 'firewood', 'split', 'log', 'chop'], loop: false },
  { name: 'treasure coins pouring', filename: 'treasure-coins-pouring.mp3', prompt: 'Treasure chest opened with coins pouring out, massive gold and silver coins cascading, rich metallic shower', duration: 5, type: 'sfx', keywords: ['treasure', 'coins', 'pouring', 'gold', 'silver', 'chest', 'rich', 'loot', 'cascade'], loop: false },
  { name: 'door slam heavy', filename: 'door-slam-heavy.mp3', prompt: 'Heavy wooden door slamming shut with force, loud dramatic bang, reverberating slam echo, final', duration: 2, type: 'sfx', keywords: ['door', 'slam', 'heavy', 'shut', 'bang', 'loud', 'force', 'dramatic'], loop: false },
  { name: 'mirror shatter cursed', filename: 'mirror-shatter-cursed.mp3', prompt: 'Mirror shattering into pieces with eerie supernatural echo, cursed glass breaking, ominous magical destruction', duration: 3, type: 'sfx', keywords: ['mirror', 'shatter', 'cursed', 'glass', 'break', 'ominous', 'supernatural', 'bad luck'], loop: false },

  // ═══════ SFX - VOCAL & SOCIAL (5) ═══════
  { name: 'crowd quiet murmur', filename: 'crowd-quiet-murmur.mp3', prompt: 'Quiet crowd murmuring in background, low indistinct chatter, gathered people talking softly, audience waiting', duration: 8, type: 'sfx', keywords: ['crowd', 'murmur', 'quiet', 'chatter', 'background', 'gathering', 'audience', 'whisper'], loop: true },
  { name: 'eating drinking gulp', filename: 'eating-drinking-gulp.mp3', prompt: 'Person drinking and gulping liquid from tankard, big satisfying gulp, tavern drinking, swallowing ale', duration: 3, type: 'sfx', keywords: ['eating', 'drinking', 'gulp', 'swallow', 'tankard', 'ale', 'tavern', 'thirsty'], loop: false },
  { name: 'snoring sleeping', filename: 'snoring-sleeping.mp3', prompt: 'Person snoring loudly while sleeping, rhythmic heavy snoring, deep sleep breathing, resting', duration: 6, type: 'sfx', keywords: ['snoring', 'sleeping', 'rest', 'loud', 'breathing', 'sleep', 'night', 'camp'], loop: false },
  { name: 'coughing choking', filename: 'coughing-choking.mp3', prompt: 'Person coughing and choking on smoke or dust, violent coughing fit, gasping for air, struggling to breathe', duration: 4, type: 'sfx', keywords: ['cough', 'choke', 'gasp', 'smoke', 'dust', 'struggle', 'breath', 'sick'], loop: false },
  { name: 'wagon cart cobblestone', filename: 'wagon-cart-cobblestone.mp3', prompt: 'Horse-drawn wagon cart rolling over cobblestone street, wooden wheels rattling, horse hooves, medieval transport', duration: 8, type: 'sfx', keywords: ['wagon', 'cart', 'cobblestone', 'wheel', 'horse', 'medieval', 'transport', 'rattling'], loop: false },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function r2Exists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch { return false; }
}

async function generateSound(prompt, duration) {
  const resp = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: duration,
      prompt_influence: 0.4,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`ElevenLabs ${resp.status}: ${errText}`);
  }

  return Buffer.from(await resp.arrayBuffer());
}

async function uploadToR2(key, body) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1); }

  // Load existing catalog
  const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
  const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
  const catalog = catalogJson.files || catalogJson;
  const existingNames = new Set(catalog.map(s => s.name.toLowerCase()));

  console.log(`\nExisting catalog: ${catalog.length} sounds`);
  console.log(`New sounds to generate: ${NEW_SOUNDS.length}\n`);

  let generated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < NEW_SOUNDS.length; i++) {
    const s = NEW_SOUNDS[i];
    const r2Key = `${PREFIX}${s.filename}`;
    const tag = `[${i + 1}/${NEW_SOUNDS.length}]`;

    // Skip if already in catalog
    if (existingNames.has(s.name.toLowerCase())) {
      console.log(`${tag} SKIP (exists): ${s.name}`);
      skipped++;
      continue;
    }

    // Skip if already in R2
    if (await r2Exists(r2Key)) {
      console.log(`${tag} SKIP (R2): ${s.name}`);
      // Still add to catalog
      catalog.push({
        type: s.type,
        name: s.name,
        file: `sounds/${s.filename}`,
        keywords: s.keywords,
        ...(s.loop ? { loop: true } : {}),
      });
      existingNames.add(s.name.toLowerCase());
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`${tag} Generating: ${s.name} (${s.duration}s)...`);

      const audio = await generateSound(s.prompt, s.duration);
      process.stdout.write(` ${(audio.length / 1024).toFixed(0)}KB...`);

      await uploadToR2(r2Key, audio);

      catalog.push({
        type: s.type,
        name: s.name,
        file: `sounds/${s.filename}`,
        keywords: s.keywords,
        ...(s.loop ? { loop: true } : {}),
      });
      existingNames.add(s.name.toLowerCase());

      console.log(' OK');
      generated++;

      // Rate limit: ~2 requests/sec to be safe
      await sleep(600);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      failed++;
      // If rate limited, wait longer
      if (err.message.includes('429')) {
        console.log('  Rate limited — waiting 30s...');
        await sleep(30000);
        i--; // Retry
      }
    }
  }

  // Save updated catalog (preserve original structure)
  const output = catalogJson.files ? { files: catalog } : catalog;
  await writeFile(catalogPath, JSON.stringify(output, null, 2));

  console.log(`\n════════════════════════════════════`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total catalog: ${catalog.length} sounds`);
  console.log(`Saved to: ${catalogPath}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
