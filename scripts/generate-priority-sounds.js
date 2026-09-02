#!/usr/bin/env node
/**
 * Generate the next priority sound batch with ElevenLabs, upload to R2, and
 * append entries to public/saved-sounds.json.
 *
 * Usage:
 *   node scripts/generate-priority-sounds.js --dry-run
 *   node scripts/generate-priority-sounds.js
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';
const PREFIX = 'sounds/';
const REQUIRED_ENV = ['ELEVENLABS_API_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

const r2 = DRY_RUN ? null : new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const EVERYDAY_SOUNDS = [
    { name: 'newspaper unfolding pages', filename: 'newspaper-unfolding-pages.mp3', duration: 4, type: 'sfx', keywords: ['newspaper', 'unfold', 'unfolding', 'paper', 'pages', 'rustle', 'reading', 'document', 'indoor'], prompt: 'Realistic newspaper being unfolded by hand, crisp paper rustling, pages opening wide, close microphone, no music, no voices' },
    { name: 'newspaper page turn single', filename: 'newspaper-page-turn-single.mp3', duration: 3, type: 'sfx', keywords: ['newspaper', 'page', 'turn', 'paper', 'rustle', 'reading', 'single', 'document'], prompt: 'One newspaper page being turned slowly, thin paper crackle and rustle, quiet indoor Foley, no music, no voices' },
    { name: 'paper stack shuffle desk', filename: 'paper-stack-shuffle-desk.mp3', duration: 4, type: 'sfx', keywords: ['paper', 'papers', 'stack', 'shuffle', 'desk', 'document', 'office', 'sorting'], prompt: 'Stack of papers being shuffled and squared on a desk, realistic document handling, crisp paper Foley, no music, no voices' },
    { name: 'envelope tear open', filename: 'envelope-tear-open.mp3', duration: 3, type: 'sfx', keywords: ['envelope', 'tear', 'open', 'paper', 'letter', 'mail', 'rip', 'document'], prompt: 'Paper envelope being torn open by hand, rip and flap rustle, realistic close Foley, no music, no voices' },
    { name: 'cardboard box opening', filename: 'cardboard-box-opening.mp3', duration: 5, type: 'sfx', keywords: ['cardboard', 'box', 'open', 'flaps', 'package', 'packing', 'unbox', 'fold'], prompt: 'Cardboard box flaps opening and bending, package being opened, corrugated cardboard creaks, realistic Foley, no music' },
    { name: 'packing tape peel', filename: 'packing-tape-peel.mp3', duration: 4, type: 'sfx', keywords: ['tape', 'packing', 'peel', 'sticky', 'package', 'rip', 'adhesive', 'box'], prompt: 'Packing tape being peeled off a cardboard box, sticky ripping stretch sound, close microphone, no music, no voices' },
    { name: 'chair scrape wooden floor', filename: 'chair-scrape-wooden-floor.mp3', duration: 3, type: 'sfx', keywords: ['chair', 'scrape', 'wooden', 'floor', 'furniture', 'drag', 'table', 'indoor'], prompt: 'Wooden chair being pulled across a wooden floor, legs scraping clearly, short realistic indoor Foley, no music' },
    { name: 'chair bump table', filename: 'chair-bump-table.mp3', duration: 2, type: 'sfx', keywords: ['chair', 'bump', 'table', 'wood', 'furniture', 'knock', 'indoor', 'impact'], prompt: 'Chair legs bumping lightly into a wooden table, small furniture knock, realistic room tone, no music' },
    { name: 'wooden table knock', filename: 'wooden-table-knock.mp3', duration: 2, type: 'sfx', keywords: ['table', 'wooden', 'knock', 'tap', 'desk', 'furniture', 'wood', 'impact'], prompt: 'Knuckles knocking twice on a wooden table, dry resonant wood taps, close microphone, no music, no voices' },
    { name: 'cup set on table', filename: 'cup-set-on-table.mp3', duration: 2, type: 'sfx', keywords: ['cup', 'mug', 'set', 'table', 'ceramic', 'clink', 'drink', 'indoor'], prompt: 'Ceramic cup set down on a wooden table, small clink and contact thud, realistic Foley, no music' },
    { name: 'ceramic plate clatter', filename: 'ceramic-plate-clatter.mp3', duration: 3, type: 'sfx', keywords: ['plate', 'ceramic', 'clatter', 'dish', 'kitchen', 'table', 'dinner', 'clink'], prompt: 'Ceramic plates clattering together on a table, dinnerware handling, realistic kitchen Foley, no music, no voices' },
    { name: 'silverware drawer clink', filename: 'silverware-drawer-clink.mp3', duration: 4, type: 'sfx', keywords: ['silverware', 'drawer', 'clink', 'utensils', 'fork', 'spoon', 'kitchen', 'metal'], prompt: 'Silverware clinking in a kitchen drawer, forks and spoons shifting, drawer opening slightly, no music, no voices' },
    { name: 'keys picked up jingle', filename: 'keys-picked-up-jingle.mp3', duration: 2, type: 'sfx', keywords: ['keys', 'picked', 'jingle', 'metal', 'keyring', 'grab', 'take', 'pickup'], prompt: 'Keys being picked up from a table, small metal jingle and scrape, close realistic Foley, no music' },
    { name: 'keys unlock door', filename: 'keys-unlock-door.mp3', duration: 4, type: 'sfx', keywords: ['keys', 'unlock', 'door', 'lock', 'turn', 'metal', 'handle', 'entry'], prompt: 'Key inserted into a door lock and turned, lock clicking open, metal keyring jingle, realistic Foley, no music' },
    { name: 'light switch click', filename: 'light-switch-click.mp3', duration: 1, type: 'sfx', keywords: ['light', 'switch', 'click', 'toggle', 'lamp', 'electric', 'room', 'indoor'], prompt: 'Single wall light switch clicking on, crisp plastic toggle click, quiet room, no music, no voices' },
    { name: 'drawer open close wooden', filename: 'drawer-open-close-wooden.mp3', duration: 4, type: 'sfx', keywords: ['drawer', 'open', 'close', 'wooden', 'desk', 'furniture', 'slide', 'indoor'], prompt: 'Wooden desk drawer sliding open and closing, light scrape and stop, realistic indoor Foley, no music' },
    { name: 'cabinet door close', filename: 'cabinet-door-close.mp3', duration: 3, type: 'sfx', keywords: ['cabinet', 'door', 'close', 'kitchen', 'wood', 'cupboard', 'shut', 'indoor'], prompt: 'Kitchen cabinet door closing with a soft wooden clack, hinge movement, realistic Foley, no music' },
    { name: 'refrigerator door open hum', filename: 'refrigerator-door-open-hum.mp3', duration: 5, type: 'sfx', keywords: ['refrigerator', 'fridge', 'door', 'open', 'hum', 'kitchen', 'appliance', 'modern'], prompt: 'Refrigerator door opening, rubber seal release, faint appliance hum, bottles lightly rattling, realistic kitchen Foley' },
    { name: 'microwave beep door', filename: 'microwave-beep-door.mp3', duration: 3, type: 'sfx', keywords: ['microwave', 'beep', 'door', 'kitchen', 'appliance', 'open', 'modern', 'button'], prompt: 'Microwave finished beep followed by small door opening click, realistic kitchen appliance sound, no music' },
    { name: 'phone vibration on table', filename: 'phone-vibration-on-table.mp3', duration: 4, type: 'sfx', keywords: ['phone', 'vibration', 'table', 'buzz', 'mobile', 'text', 'call', 'modern'], prompt: 'Mobile phone vibrating on a wooden table, buzzing rattle in short pulses, realistic close Foley, no ringtone' },
    { name: 'keyboard typing fast', filename: 'keyboard-typing-fast.mp3', duration: 5, type: 'sfx', keywords: ['keyboard', 'typing', 'type', 'computer', 'keys', 'office', 'fast', 'modern'], prompt: 'Fast typing on a computer keyboard, realistic office Foley, no voices, no music, close microphone' },
    { name: 'computer mouse double click', filename: 'computer-mouse-double-click.mp3', duration: 1, type: 'sfx', keywords: ['mouse', 'click', 'double', 'computer', 'button', 'office', 'modern', 'desktop'], prompt: 'Computer mouse double click, crisp plastic button clicks, quiet room, no music, no voices' },
    { name: 'pen clicking fidget', filename: 'pen-clicking-fidget.mp3', duration: 3, type: 'sfx', keywords: ['pen', 'click', 'fidget', 'button', 'office', 'desk', 'plastic', 'writing'], prompt: 'Retractable pen clicking repeatedly as someone fidgets, small plastic clicks, close microphone, no music' },
    { name: 'pencil writing paper close', filename: 'pencil-writing-paper-close.mp3', duration: 6, type: 'sfx', keywords: ['pencil', 'writing', 'paper', 'scribble', 'desk', 'draw', 'notes', 'close'], prompt: 'Pencil writing on paper close up, graphite scratch and small hand movement, realistic quiet Foley, no music' },
    { name: 'book pages flipping', filename: 'book-pages-flipping.mp3', duration: 5, type: 'sfx', keywords: ['book', 'pages', 'flipping', 'paper', 'reading', 'library', 'page', 'turn'], prompt: 'Book pages flipping quickly by hand, paper flutter and soft cover movement, realistic library Foley, no music' },
    { name: 'book closing heavy', filename: 'book-closing-heavy.mp3', duration: 2, type: 'sfx', keywords: ['book', 'close', 'closing', 'heavy', 'slam', 'cover', 'library', 'thud'], prompt: 'Heavy hardcover book closing with a solid thump, pages compressing, quiet room, realistic Foley, no music' },
    { name: 'zipper open close jacket', filename: 'zipper-open-close-jacket.mp3', duration: 4, type: 'sfx', keywords: ['zipper', 'open', 'close', 'jacket', 'clothes', 'fabric', 'coat', 'zip'], prompt: 'Jacket zipper opening and closing, metal zipper teeth and fabric rustle, close realistic Foley, no music' },
    { name: 'jacket fabric rustle', filename: 'jacket-fabric-rustle.mp3', duration: 4, type: 'sfx', keywords: ['jacket', 'fabric', 'rustle', 'clothing', 'coat', 'movement', 'cloth', 'wear'], prompt: 'Jacket fabric rustling as someone moves, sleeves brushing, realistic clothing Foley, no music, no voices' },
    { name: 'footsteps wooden floor indoor', filename: 'footsteps-wooden-floor-indoor.mp3', duration: 6, type: 'sfx', keywords: ['footsteps', 'walking', 'wooden', 'floor', 'indoor', 'steps', 'shoes', 'room'], prompt: 'Single person walking across an indoor wooden floor, natural footsteps, no outdoor ambience, no birds, no music' },
    { name: 'footsteps carpet soft', filename: 'footsteps-carpet-soft.mp3', duration: 5, type: 'sfx', keywords: ['footsteps', 'carpet', 'soft', 'walking', 'indoor', 'steps', 'quiet', 'room'], prompt: 'Soft footsteps on carpet in a quiet room, muffled walking, realistic indoor Foley, no music, no voices' },
    { name: 'footsteps tile hallway', filename: 'footsteps-tile-hallway.mp3', duration: 6, type: 'sfx', keywords: ['footsteps', 'tile', 'hallway', 'walking', 'indoor', 'echo', 'steps', 'shoes'], prompt: 'Footsteps walking down a tiled hallway, slight indoor echo, clean shoe taps, no outdoor ambience, no music' },
    { name: 'stairs creaking footsteps', filename: 'stairs-creaking-footsteps.mp3', duration: 6, type: 'sfx', keywords: ['stairs', 'creaking', 'footsteps', 'wood', 'steps', 'walking', 'house', 'indoor'], prompt: 'Person walking up old wooden stairs, stair boards creaking under weight, realistic indoor Foley, no music' },
    { name: 'window opening squeak', filename: 'window-opening-squeak.mp3', duration: 4, type: 'sfx', keywords: ['window', 'open', 'opening', 'squeak', 'glass', 'frame', 'house', 'indoor'], prompt: 'Old window being opened, frame squeak and glass rattle, realistic home Foley, no music, no weather' },
    { name: 'curtains drawn fabric', filename: 'curtains-drawn-fabric.mp3', duration: 4, type: 'sfx', keywords: ['curtains', 'drawn', 'fabric', 'slide', 'window', 'drape', 'cloth', 'room'], prompt: 'Curtains being drawn across a curtain rod, fabric sliding and rings moving, quiet indoor Foley, no music' },
    { name: 'blinds raised rattle', filename: 'blinds-raised-rattle.mp3', duration: 4, type: 'sfx', keywords: ['blinds', 'raised', 'rattle', 'window', 'cord', 'slats', 'room', 'shade'], prompt: 'Window blinds being raised with cord pull, plastic slats rattling, realistic room Foley, no music' },
    { name: 'glass window tap', filename: 'glass-window-tap.mp3', duration: 2, type: 'sfx', keywords: ['glass', 'window', 'tap', 'knock', 'pane', 'finger', 'room', 'indoor'], prompt: 'Finger tapping twice on a glass window pane, light sharp glass taps, quiet room, no music' },
    { name: 'door handle rattle', filename: 'door-handle-rattle.mp3', duration: 3, type: 'sfx', keywords: ['door', 'handle', 'rattle', 'knob', 'locked', 'jiggle', 'entry', 'metal'], prompt: 'Door handle rattling and jiggling on a locked door, metal knob movement, realistic Foley, no music' },
    { name: 'door creak slow indoor', filename: 'door-creak-slow-indoor.mp3', duration: 5, type: 'sfx', keywords: ['door', 'creak', 'slow', 'open', 'hinge', 'indoor', 'wood', 'room'], prompt: 'Interior wooden door slowly creaking open on old hinges, realistic close Foley, no horror music, no ambience bed' },
    { name: 'shower water running', filename: 'shower-water-running.mp3', duration: 8, type: 'sfx', keywords: ['shower', 'water', 'running', 'bathroom', 'spray', 'faucet', 'indoor', 'modern'], prompt: 'Bathroom shower water running steadily, water spray on tile, realistic indoor sound, no music, no voices' },
    { name: 'faucet drip sink', filename: 'faucet-drip-sink.mp3', duration: 6, type: 'sfx', keywords: ['faucet', 'drip', 'sink', 'water', 'bathroom', 'kitchen', 'drop', 'indoor'], prompt: 'Leaky faucet dripping into a sink, repeated water drops with small porcelain echo, realistic Foley, no music' },
    { name: 'toilet flush bathroom', filename: 'toilet-flush-bathroom.mp3', duration: 6, type: 'sfx', keywords: ['toilet', 'flush', 'bathroom', 'water', 'modern', 'plumbing', 'indoor', 'drain'], prompt: 'Toilet flushing in a bathroom, water rush and refill start, realistic indoor plumbing sound, no music' },
    { name: 'broom sweeping floor', filename: 'broom-sweeping-floor.mp3', duration: 6, type: 'sfx', keywords: ['broom', 'sweeping', 'floor', 'cleaning', 'bristles', 'dust', 'indoor', 'sweep'], prompt: 'Broom sweeping a hard floor, bristles brushing dust in steady strokes, realistic indoor Foley, no music' },
    { name: 'vacuum cleaner start', filename: 'vacuum-cleaner-start.mp3', duration: 5, type: 'sfx', keywords: ['vacuum', 'cleaner', 'start', 'cleaning', 'appliance', 'motor', 'carpet', 'modern'], prompt: 'Vacuum cleaner turning on and beginning to run, electric motor rising, household cleaning sound, no music' },
    { name: 'clothes washer spin', filename: 'clothes-washer-spin.mp3', duration: 8, type: 'sfx', keywords: ['washer', 'washing', 'clothes', 'spin', 'laundry', 'machine', 'appliance', 'modern'], prompt: 'Clothes washing machine spin cycle, wet laundry tumbling and motor hum, realistic household appliance, no music' },
    { name: 'baby monitor static', filename: 'baby-monitor-static.mp3', duration: 6, type: 'sfx', keywords: ['baby', 'monitor', 'static', 'speaker', 'nursery', 'radio', 'hum', 'modern'], prompt: 'Baby monitor speaker with soft static and faint room noise, subtle electronic hiss, no voices, no music' },
    { name: 'dog collar tags jingle', filename: 'dog-collar-tags-jingle.mp3', duration: 3, type: 'sfx', keywords: ['dog', 'collar', 'tags', 'jingle', 'pet', 'metal', 'animal', 'movement'], prompt: 'Dog collar ID tags jingling as a pet moves, small metal tag sounds, no barking, no outdoor ambience, no music' },
    { name: 'cat purr close', filename: 'cat-purr-close.mp3', duration: 6, type: 'sfx', keywords: ['cat', 'purr', 'purring', 'pet', 'animal', 'close', 'calm', 'feline'], prompt: 'Close gentle cat purring, warm domestic pet sound, no meowing, no music, no background ambience' },
    { name: 'restaurant low chatter ambience', filename: 'restaurant-low-chatter-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['restaurant', 'chatter', 'crowd', 'dining', 'ambience', 'ambient', 'indoor', 'people'], prompt: 'Low restaurant chatter ambience loop, indistinct diners talking softly, occasional plates and glasses, no music, no clear words' },
    { name: 'office room tone typing ambience', filename: 'office-room-tone-typing-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['office', 'room tone', 'typing', 'ambience', 'ambient', 'computer', 'workplace', 'indoor'], prompt: 'Quiet office ambience loop, faint keyboard typing, distant chair movement, HVAC room tone, no voices, no music' },
    { name: 'quiet study page turns ambience', filename: 'quiet-study-page-turns-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['study', 'quiet', 'pages', 'book', 'library', 'ambience', 'ambient', 'reading'], prompt: 'Quiet study room ambience loop, soft page turns, pencil notes, calm indoor room tone, no voices, no music' },
];

const TABLETOP_SOUNDS = [
    { name: 'initiative dice roll handful', filename: 'initiative-dice-roll-handful.mp3', duration: 3, type: 'sfx', keywords: ['initiative', 'dice', 'roll', 'handful', 'tabletop', 'rpg', 'dnd', 'start'], prompt: 'Handful of polyhedral tabletop dice rolling on a wooden table, energetic start of combat, clean realistic Foley, no voices' },
    { name: 'dice tray natural twenty', filename: 'dice-tray-natural-twenty.mp3', duration: 3, type: 'sfx', keywords: ['dice', 'natural twenty', 'nat 20', 'critical', 'tray', 'tabletop', 'rpg', 'dnd'], prompt: 'Single polyhedral die rolling in a dice tray and landing with a satisfying stop, triumphant subtle sparkle, natural twenty moment, no voices' },
    { name: 'stone dungeon door opening', filename: 'stone-dungeon-door-opening.mp3', duration: 6, type: 'sfx', keywords: ['stone', 'dungeon', 'door', 'open', 'grind', 'ancient', 'tabletop', 'dnd'], prompt: 'Ancient stone dungeon door grinding open, heavy rock scraping, dust falling, dark fantasy adventure Foley, no music' },
    { name: 'pressure plate trap click', filename: 'pressure-plate-trap-click.mp3', duration: 2, type: 'sfx', keywords: ['pressure plate', 'trap', 'click', 'dungeon', 'mechanism', 'trigger', 'tabletop', 'dnd'], prompt: 'Dungeon pressure plate clicking underfoot, tiny mechanical trigger sound, immediate trap tension, no music' },
    { name: 'poison dart trap volley', filename: 'poison-dart-trap-volley.mp3', duration: 3, type: 'sfx', keywords: ['poison', 'dart', 'trap', 'volley', 'dungeon', 'whoosh', 'tabletop', 'dnd'], prompt: 'Poison dart trap firing a quick volley from dungeon walls, small darts whooshing past, spring mechanism, no music' },
    { name: 'spike trap spring burst', filename: 'spike-trap-spring-burst.mp3', duration: 3, type: 'sfx', keywords: ['spike', 'trap', 'spring', 'burst', 'dungeon', 'metal', 'danger', 'dnd'], prompt: 'Metal spike trap springing upward suddenly, sharp mechanism snap and dangerous metal thrust, fantasy dungeon Foley, no music' },
    { name: 'pit trap crumble fall', filename: 'pit-trap-crumble-fall.mp3', duration: 5, type: 'sfx', keywords: ['pit', 'trap', 'crumble', 'fall', 'dungeon', 'stone', 'collapse', 'dnd'], prompt: 'Hidden pit trap collapsing, stone floor crumbling, debris falling into darkness, fantasy dungeon danger sound, no music' },
    { name: 'locked chest opening', filename: 'locked-chest-opening.mp3', duration: 5, type: 'sfx', keywords: ['locked', 'chest', 'open', 'treasure', 'hinge', 'wood', 'loot', 'dnd'], prompt: 'Old locked treasure chest opening, latch click, creaking hinges, wooden lid lifting, subtle coins inside, no music' },
    { name: 'treasure chest coins reveal', filename: 'treasure-chest-coins-reveal.mp3', duration: 5, type: 'sfx', keywords: ['treasure', 'chest', 'coins', 'reveal', 'loot', 'gold', 'sparkle', 'dnd'], prompt: 'Treasure chest revealed with gold coins shifting and sparkling, satisfying loot discovery, fantasy adventure Foley, no music' },
    { name: 'potion cork pop drink', filename: 'potion-cork-pop-drink.mp3', duration: 3, type: 'sfx', keywords: ['potion', 'cork', 'pop', 'drink', 'bottle', 'magic', 'healing', 'dnd'], prompt: 'Small potion bottle cork popping out followed by a quick drink gulp, glass and liquid Foley, fantasy roleplaying item, no music' },
    { name: 'potion bottle smash', filename: 'potion-bottle-smash.mp3', duration: 3, type: 'sfx', keywords: ['potion', 'bottle', 'smash', 'glass', 'break', 'alchemy', 'magic', 'dnd'], prompt: 'Glass potion bottle smashing on stone floor, liquid splashing with a tiny magical fizz, fantasy Foley, no music' },
    { name: 'healing potion shimmer', filename: 'healing-potion-shimmer.mp3', duration: 4, type: 'sfx', keywords: ['healing', 'potion', 'shimmer', 'magic', 'heal', 'restore', 'tabletop', 'dnd'], prompt: 'Healing potion magical shimmer after drinking, warm restorative sparkle and soft chime, fantasy item effect, no music' },
    { name: 'arcane spellbook page flip', filename: 'arcane-spellbook-page-flip.mp3', duration: 4, type: 'sfx', keywords: ['spellbook', 'arcane', 'page', 'flip', 'magic', 'wizard', 'book', 'dnd'], prompt: 'Large arcane spellbook pages flipping with faint magical energy, parchment rustle and subtle shimmer, no voices, no music' },
    { name: 'ritual candles ignite', filename: 'ritual-candles-ignite.mp3', duration: 4, type: 'sfx', keywords: ['ritual', 'candles', 'ignite', 'magic', 'flame', 'ceremony', 'arcane', 'dnd'], prompt: 'Circle of ritual candles igniting one after another with small magical whooshes, dark fantasy ceremony, no music' },
    { name: 'magic shield absorbs hit', filename: 'magic-shield-absorbs-hit.mp3', duration: 3, type: 'sfx', keywords: ['magic', 'shield', 'absorb', 'hit', 'barrier', 'ward', 'protection', 'dnd'], prompt: 'Magical shield barrier absorbing an incoming hit, bright energy impact and protective hum, fantasy combat sound, no music' },
    { name: 'fireball spell launch', filename: 'fireball-spell-launch.mp3', duration: 3, type: 'sfx', keywords: ['fireball', 'spell', 'launch', 'fire', 'evocation', 'magic', 'wizard', 'dnd'], prompt: 'Fireball spell launching from hands, flame building into a fast fiery projectile, fantasy magic attack, no music' },
    { name: 'fireball impact detonation', filename: 'fireball-impact-detonation.mp3', duration: 4, type: 'sfx', keywords: ['fireball', 'impact', 'detonation', 'explosion', 'fire', 'blast', 'magic', 'dnd'], prompt: 'Fireball spell impact detonation, roaring fire explosion with concussive blast and flame tail, fantasy combat, no music' },
    { name: 'lightning spell crack', filename: 'lightning-spell-crack.mp3', duration: 3, type: 'sfx', keywords: ['lightning', 'spell', 'crack', 'electric', 'bolt', 'thunder', 'magic', 'dnd'], prompt: 'Lightning bolt spell cracking through the air, sharp electric discharge and thunder snap, fantasy magic attack, no music' },
    { name: 'ice shard impact spell', filename: 'ice-shard-impact-spell.mp3', duration: 3, type: 'sfx', keywords: ['ice', 'shard', 'impact', 'spell', 'frost', 'cold', 'magic', 'dnd'], prompt: 'Ice shard spell firing and shattering on impact, crystalline whoosh and frozen splinter burst, fantasy magic, no music' },
    { name: 'thunderwave blast spell', filename: 'thunderwave-blast-spell.mp3', duration: 4, type: 'sfx', keywords: ['thunderwave', 'thunder', 'blast', 'spell', 'sonic', 'shockwave', 'magic', 'dnd'], prompt: 'Thunderwave spell blast, massive sonic shockwave expanding outward with deep boom and air pressure, fantasy magic, no music' },
    { name: 'necrotic drain spell', filename: 'necrotic-drain-spell.mp3', duration: 5, type: 'sfx', keywords: ['necrotic', 'drain', 'spell', 'dark', 'death', 'life', 'magic', 'dnd'], prompt: 'Necrotic life drain spell, dark energy pulling vitality away with eerie suction and ghostly resonance, fantasy magic, no music' },
    { name: 'radiant smite impact', filename: 'radiant-smite-impact.mp3', duration: 3, type: 'sfx', keywords: ['radiant', 'smite', 'impact', 'holy', 'divine', 'paladin', 'magic', 'dnd'], prompt: 'Radiant divine smite impact, holy light burst over weapon strike, bright sacred energy and heavy hit, fantasy combat, no music' },
    { name: 'arcane portal opening', filename: 'arcane-portal-opening.mp3', duration: 5, type: 'sfx', keywords: ['portal', 'open', 'arcane', 'teleport', 'magic', 'rift', 'gateway', 'dnd'], prompt: 'Arcane portal opening, swirling magical vortex forming with dimensional hum and sparkling energy, fantasy teleportation, no music' },
    { name: 'teleport vanish pop', filename: 'teleport-vanish-pop.mp3', duration: 3, type: 'sfx', keywords: ['teleport', 'vanish', 'pop', 'magic', 'blink', 'arcane', 'disappear', 'dnd'], prompt: 'Teleport vanish sound, quick magical pop and airy implosion as a character disappears, fantasy magic Foley, no music' },
    { name: 'invisibility fade shimmer', filename: 'invisibility-fade-shimmer.mp3', duration: 4, type: 'sfx', keywords: ['invisibility', 'fade', 'shimmer', 'stealth', 'magic', 'vanish', 'spell', 'dnd'], prompt: 'Invisibility spell fading a person from sight, soft magical shimmer and subtle airy sparkle, stealth fantasy magic, no music' },
    { name: 'counterspell fizz cancel', filename: 'counterspell-fizz-cancel.mp3', duration: 3, type: 'sfx', keywords: ['counterspell', 'fizz', 'cancel', 'dispel', 'magic', 'spell', 'interrupt', 'dnd'], prompt: 'Counterspell cancelling another spell, magical energy fizzing out and collapsing, sharp reverse whoosh, fantasy magic, no music' },
    { name: 'dragon wing flap huge', filename: 'dragon-wing-flap-huge.mp3', duration: 4, type: 'sfx', keywords: ['dragon', 'wing', 'flap', 'huge', 'flight', 'beast', 'fantasy', 'dnd'], prompt: 'Huge dragon wings flapping overhead, massive leathery air displacement, fantasy creature flying close, no music' },
    { name: 'dragon roar close', filename: 'dragon-roar-close.mp3', duration: 5, type: 'sfx', keywords: ['dragon', 'roar', 'close', 'beast', 'monster', 'fantasy', 'threat', 'dnd'], prompt: 'Close dragon roar, enormous fantasy beast bellowing with chest-rattling power and fiery breath texture, no music' },
    { name: 'goblin skitter footsteps', filename: 'goblin-skitter-footsteps.mp3', duration: 4, type: 'sfx', keywords: ['goblin', 'skitter', 'footsteps', 'small', 'creature', 'sneak', 'fantasy', 'dnd'], prompt: 'Small fantasy creature skittering footsteps on stone, quick nervous movement, leather and claws, dungeon Foley, no music' },
    { name: 'orc battle shout', filename: 'orc-battle-shout.mp3', duration: 3, type: 'sfx', keywords: ['orc', 'battle', 'shout', 'war cry', 'creature', 'combat', 'fantasy', 'dnd'], prompt: 'Orc warrior battle shout, guttural aggressive war cry charging into combat, fantasy creature vocal, no music' },
    { name: 'skeleton bones marching', filename: 'skeleton-bones-marching.mp3', duration: 5, type: 'sfx', keywords: ['skeleton', 'bones', 'marching', 'undead', 'rattle', 'footsteps', 'fantasy', 'dnd'], prompt: 'Animated skeleton bones marching on stone, dry bone rattles and light weapon clinks, undead dungeon Foley, no music' },
    { name: 'zombie shambling groan', filename: 'zombie-shambling-groan.mp3', duration: 5, type: 'sfx', keywords: ['zombie', 'shambling', 'groan', 'undead', 'footsteps', 'horror', 'fantasy', 'dnd'], prompt: 'Zombie shambling slowly with wet undead groan, dragging feet and decayed movement, fantasy horror Foley, no music' },
    { name: 'giant footsteps approach', filename: 'giant-footsteps-approach.mp3', duration: 7, type: 'sfx', keywords: ['giant', 'footsteps', 'approach', 'stomp', 'huge', 'earth', 'fantasy', 'dnd'], prompt: 'Giant footsteps approaching from the distance, heavy earth-shaking stomps growing closer, fantasy encounter sound, no music' },
    { name: 'spider swarm skitter', filename: 'spider-swarm-skitter.mp3', duration: 5, type: 'sfx', keywords: ['spider', 'swarm', 'skitter', 'legs', 'creepy', 'dungeon', 'fantasy', 'dnd'], prompt: 'Swarm of spiders skittering rapidly across stone, many tiny legs, creepy dungeon movement, no music' },
    { name: 'wolf pack howls distant', filename: 'wolf-pack-howls-distant.mp3', duration: 7, type: 'sfx', keywords: ['wolf', 'pack', 'howls', 'distant', 'night', 'wilderness', 'fantasy', 'dnd'], prompt: 'Distant wolf pack howling at night, several wolves answering across wilderness, eerie but natural, no music' },
    { name: 'tavern toast cheer ambience', filename: 'tavern-toast-cheer-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['tavern', 'toast', 'cheer', 'crowd', 'ambience', 'ambient', 'fantasy', 'dnd'], prompt: 'Fantasy tavern ambience loop with patrons cheering a toast, mugs clinking, warm crowd energy, no music, indistinct voices' },
    { name: 'tavern brawl furniture smash', filename: 'tavern-brawl-furniture-smash.mp3', duration: 6, type: 'sfx', keywords: ['tavern', 'brawl', 'furniture', 'smash', 'fight', 'chair', 'table', 'dnd'], prompt: 'Tavern brawl furniture smash, wooden chair breaking and table knocked over, chaotic fantasy pub fight Foley, no music' },
    { name: 'blacksmith forge hammer ambience', filename: 'blacksmith-forge-hammer-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['blacksmith', 'forge', 'hammer', 'anvil', 'ambience', 'ambient', 'fantasy', 'dnd'], prompt: 'Blacksmith forge ambience loop, hammer striking anvil, bellows breathing, fire roaring, fantasy town workshop, no music' },
    { name: 'stable horse snorts ambience', filename: 'stable-horse-snorts-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['stable', 'horse', 'snorts', 'hay', 'ambience', 'ambient', 'fantasy', 'dnd'], prompt: 'Fantasy stable ambience loop, horses snorting softly, hay rustling, wooden stall creaks, calm barn room tone, no music' },
    { name: 'campfire bedroll night ambience', filename: 'campfire-bedroll-night-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['campfire', 'bedroll', 'night', 'camp', 'ambience', 'ambient', 'wilderness', 'dnd'], prompt: 'Adventurer campsite night ambience loop, small campfire crackling, bedroll fabric movement, quiet wilderness, no music' },
    { name: 'dungeon drip chains ambience', filename: 'dungeon-drip-chains-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['dungeon', 'drip', 'chains', 'stone', 'ambience', 'ambient', 'dark', 'dnd'], prompt: 'Dungeon ambience loop, water dripping in stone corridors, faint chains clinking far away, oppressive underground air, no music' },
    { name: 'crypt tomb low ambience', filename: 'crypt-tomb-low-ambience.mp3', duration: 18, type: 'ambience', loop: true, keywords: ['crypt', 'tomb', 'low', 'undead', 'ambience', 'ambient', 'eerie', 'dnd'], prompt: 'Crypt tomb ambience loop, low cold air, distant stone settling, faint eerie resonance, no music, no clear voices' },
    { name: 'cave bat flutter swarm', filename: 'cave-bat-flutter-swarm.mp3', duration: 5, type: 'sfx', keywords: ['cave', 'bat', 'flutter', 'swarm', 'wings', 'dungeon', 'fantasy', 'dnd'], prompt: 'Swarm of bats fluttering out of a cave, many small wings rushing overhead, dark fantasy cave Foley, no music' },
    { name: 'rope bridge snap', filename: 'rope-bridge-snap.mp3', duration: 4, type: 'sfx', keywords: ['rope', 'bridge', 'snap', 'break', 'wood', 'fall', 'danger', 'dnd'], prompt: 'Old rope bridge snapping, ropes tearing and wooden planks cracking, dangerous collapse moment, fantasy adventure Foley, no music' },
    { name: 'rope pulley lift', filename: 'rope-pulley-lift.mp3', duration: 5, type: 'sfx', keywords: ['rope', 'pulley', 'lift', 'creak', 'mechanism', 'elevator', 'fantasy', 'dnd'], prompt: 'Rope pulley lifting a heavy platform, rope strain, wooden wheel creak, medieval mechanism, no music' },
    { name: 'horse cart road travel', filename: 'horse-cart-road-travel.mp3', duration: 8, type: 'sfx', keywords: ['horse', 'cart', 'road', 'travel', 'wagon', 'wheels', 'fantasy', 'dnd'], prompt: 'Horse-drawn cart traveling on a dirt road, wooden wheels creaking and hooves walking, fantasy travel Foley, no music' },
    { name: 'sailing ship deck creak', filename: 'sailing-ship-deck-creak.mp3', duration: 8, type: 'sfx', keywords: ['sailing', 'ship', 'deck', 'creak', 'wood', 'sea', 'fantasy', 'dnd'], prompt: 'Wooden sailing ship deck creaking with gentle sea motion, ropes and rigging softly moving, no music, no voices' },
    { name: 'war horn charge signal', filename: 'war-horn-charge-signal.mp3', duration: 5, type: 'sfx', keywords: ['war', 'horn', 'charge', 'signal', 'battle', 'army', 'fantasy', 'dnd'], prompt: 'Deep war horn blast signaling a charge, resonant battlefield call echoing across hills, fantasy combat cue, no music' },
    { name: 'shield block heavy impact', filename: 'shield-block-heavy-impact.mp3', duration: 2, type: 'sfx', keywords: ['shield', 'block', 'heavy', 'impact', 'combat', 'metal', 'defense', 'dnd'], prompt: 'Heavy attack blocked by a metal shield, loud clang and body impact, fantasy melee combat Foley, no music' },
    { name: 'sword draw clash combo', filename: 'sword-draw-clash-combo.mp3', duration: 3, type: 'sfx', keywords: ['sword', 'draw', 'clash', 'weapon', 'combat', 'blade', 'melee', 'dnd'], prompt: 'Sword drawn from scabbard followed by one sharp blade clash, clean fantasy melee combat Foley, no music' },
];

const NEW_SOUNDS = [
    ...EVERYDAY_SOUNDS.map((sound) => ({ ...sound, group: 'everyday' })),
    ...TABLETOP_SOUNDS.map((sound) => ({ ...sound, group: 'tabletop' })),
];

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeKeywords(keywords) {
    const seen = new Set();
    const normalized = [];
    for (const rawKeyword of keywords || []) {
        const keyword = String(rawKeyword).trim().toLowerCase();
        if (!keyword || seen.has(keyword)) continue;
        seen.add(keyword);
        normalized.push(keyword);
    }
    return normalized;
}

function catalogEntry(sound) {
    return {
        type: sound.type,
        name: sound.name,
        file: `${PREFIX}${sound.filename}`,
        keywords: normalizeKeywords(sound.keywords),
        ...(sound.loop ? { loop: true } : {}),
    };
}

function validateSounds() {
    const errors = [];
    const seenNames = new Set();
    const seenFiles = new Set();
    const groupCounts = NEW_SOUNDS.reduce((counts, sound) => {
        counts[sound.group] = (counts[sound.group] || 0) + 1;
        return counts;
    }, {});

    if (groupCounts.everyday !== 50) errors.push(`expected 50 everyday sounds, found ${groupCounts.everyday || 0}`);
    if (groupCounts.tabletop !== 50) errors.push(`expected 50 tabletop sounds, found ${groupCounts.tabletop || 0}`);

    for (const sound of NEW_SOUNDS) {
        for (const requiredKey of ['name', 'filename', 'prompt', 'duration', 'type', 'keywords', 'group']) {
            if (sound[requiredKey] === undefined || sound[requiredKey] === null) {
                errors.push(`${sound.name || '(unnamed)'}: missing ${requiredKey}`);
            }
        }
        if (!['music', 'sfx', 'ambience'].includes(sound.type)) errors.push(`${sound.name}: invalid type ${sound.type}`);
        if (!Number.isFinite(sound.duration) || sound.duration <= 0 || sound.duration > 22) errors.push(`${sound.name}: invalid duration ${sound.duration}`);
        if (!Array.isArray(sound.keywords) || sound.keywords.length < 5) errors.push(`${sound.name}: expected at least 5 keywords`);
        if (!String(sound.filename || '').endsWith('.mp3')) errors.push(`${sound.name}: filename must be mp3`);
        if (seenNames.has(sound.name.toLowerCase())) errors.push(`${sound.name}: duplicate name`);
        if (seenFiles.has(sound.filename.toLowerCase())) errors.push(`${sound.filename}: duplicate filename`);
        seenNames.add(sound.name.toLowerCase());
        seenFiles.add(sound.filename.toLowerCase());
    }

    return errors;
}

async function r2Exists(key) {
    try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}

async function generateSound(prompt, duration) {
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
        method: 'POST',
        headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: prompt,
            duration_seconds: duration,
            prompt_influence: 0.45,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`ElevenLabs ${response.status}: ${errorText}`);
    }

    return Buffer.from(await response.arrayBuffer());
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

async function writeCatalog(catalogPath, catalogJson, catalog) {
    await writeFile(catalogPath, JSON.stringify({ ...catalogJson, files: catalog }, null, 2) + '\n');
}

async function main() {
    const validationErrors = validateSounds();
    if (validationErrors.length) {
        console.error('Schema validation failed:');
        for (const validationError of validationErrors) console.error(`  - ${validationError}`);
        process.exit(1);
    }

    const byType = NEW_SOUNDS.reduce((counts, sound) => {
        counts[sound.type] = (counts[sound.type] || 0) + 1;
        return counts;
    }, {});
    const byGroup = NEW_SOUNDS.reduce((counts, sound) => {
        counts[sound.group] = (counts[sound.group] || 0) + 1;
        return counts;
    }, {});
    const totalDuration = NEW_SOUNDS.reduce((sum, sound) => sum + sound.duration, 0);

    console.log(`\nPriority ElevenLabs batch: ${NEW_SOUNDS.length} sounds`);
    console.log(`  everyday precision: ${byGroup.everyday}`);
    console.log(`  tabletop fantasy:   ${byGroup.tabletop}`);
    for (const [type, count] of Object.entries(byType)) console.log(`  ${type.padEnd(10)} ${count}`);
    console.log(`  total requested duration: ${totalDuration}s (~${Math.ceil(totalDuration / 60)} min)`);

    const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
    const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
    const catalog = Array.isArray(catalogJson.files) ? catalogJson.files : [];
    const existingNames = new Set(catalog.map((sound) => String(sound.name || '').toLowerCase()));
    const existingFiles = new Set(catalog.map((sound) => String(sound.file || '').toLowerCase()));
    const newCatalogEntries = NEW_SOUNDS.filter((sound) => {
        const entry = catalogEntry(sound);
        return !existingNames.has(entry.name.toLowerCase()) && !existingFiles.has(entry.file.toLowerCase());
    });

    console.log(`  existing catalog: ${catalog.length}`);
    console.log(`  entries not yet cataloged: ${newCatalogEntries.length}`);

    if (DRY_RUN) {
        console.log('\n(dry-run - no API calls, no R2 uploads, catalog not touched)');
        return;
    }

    const missingEnvironment = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missingEnvironment.length) {
        console.error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
        process.exit(1);
    }

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    console.log('');
    for (let index = 0; index < NEW_SOUNDS.length; index++) {
        const sound = NEW_SOUNDS[index];
        const entry = catalogEntry(sound);
        const r2Key = entry.file;
        const tag = `[${index + 1}/${NEW_SOUNDS.length}]`;

        if (existingNames.has(entry.name.toLowerCase()) || existingFiles.has(entry.file.toLowerCase())) {
            console.log(`${tag} SKIP (catalog): ${sound.name}`);
            skipped++;
            continue;
        }

        if (await r2Exists(r2Key)) {
            console.log(`${tag} SKIP (R2 exists, cataloged): ${sound.name}`);
            catalog.push(entry);
            existingNames.add(entry.name.toLowerCase());
            existingFiles.add(entry.file.toLowerCase());
            skipped++;
            continue;
        }

        try {
            process.stdout.write(`${tag} Generating: ${sound.name} (${sound.duration}s)...`);
            const audio = await generateSound(sound.prompt, sound.duration);
            process.stdout.write(` ${(audio.length / 1024).toFixed(0)}KB...`);
            await uploadToR2(r2Key, audio);
            catalog.push(entry);
            existingNames.add(entry.name.toLowerCase());
            existingFiles.add(entry.file.toLowerCase());
            generated++;
            console.log(' OK');

            if ((generated + skipped) % 10 === 0) {
                await writeCatalog(catalogPath, catalogJson, catalog);
                console.log(`  [checkpoint: saved ${catalog.length} catalog entries]`);
            }

            await sleep(500);
        } catch (error) {
            failed++;
            console.log(` FAIL: ${error.message}`);
            if (String(error.message).includes('429')) {
                console.log('  Rate limited; waiting before continuing...');
                await sleep(30000);
            }
        }
    }

    await writeCatalog(catalogPath, catalogJson, catalog);
    console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed. Catalog now ${catalog.length} entries.`);
    if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
