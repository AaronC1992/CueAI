#!/usr/bin/env node
/**
 * Generate the second needed-area sound batch with ElevenLabs, upload to R2,
 * and append entries to public/saved-sounds.json.
 *
 * Usage:
 *   node scripts/generate-needed-sounds.js --dry-run
 *   node scripts/generate-needed-sounds.js
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

const NEEDED_SOUNDS = [
    { name: 'human gasp sudden', filename: 'human-gasp-sudden.mp3', duration: 2, type: 'sfx', group: 'human', keywords: ['human', 'gasp', 'sudden', 'surprise', 'breath', 'reaction', 'shock', 'voice'], prompt: 'Short sudden human gasp of surprise, natural breath reaction, close microphone, no words, no music' },
    { name: 'human sigh tired', filename: 'human-sigh-tired.mp3', duration: 3, type: 'sfx', group: 'human', keywords: ['human', 'sigh', 'tired', 'exhale', 'weary', 'breath', 'reaction', 'voice'], prompt: 'Tired human sigh and soft exhale, realistic close voice Foley, no words, no music' },
    { name: 'nervous laugh short', filename: 'nervous-laugh-short.mp3', duration: 3, type: 'sfx', group: 'human', keywords: ['nervous', 'laugh', 'short', 'human', 'awkward', 'reaction', 'chuckle', 'voice'], prompt: 'Short nervous human laugh, awkward little chuckle, no spoken words, no music' },
    { name: 'throat clearing single', filename: 'throat-clearing-single.mp3', duration: 2, type: 'sfx', group: 'human', keywords: ['throat', 'clearing', 'clear', 'cough', 'human', 'voice', 'attention', 'single'], prompt: 'Single person clearing their throat politely, close realistic voice Foley, no words, no music' },
    { name: 'cough single dry', filename: 'cough-single-dry.mp3', duration: 2, type: 'sfx', group: 'human', keywords: ['cough', 'single', 'dry', 'human', 'throat', 'sick', 'reaction', 'voice'], prompt: 'Single dry human cough, natural and brief, no words, no music, quiet room' },
    { name: 'sneeze single close', filename: 'sneeze-single-close.mp3', duration: 2, type: 'sfx', group: 'human', keywords: ['sneeze', 'single', 'human', 'close', 'reaction', 'nose', 'voice', 'body'], prompt: 'Single close human sneeze, realistic and brief, no words, no music' },
    { name: 'crying sniffle quiet', filename: 'crying-sniffle-quiet.mp3', duration: 5, type: 'sfx', group: 'human', keywords: ['crying', 'sniffle', 'quiet', 'sad', 'human', 'tears', 'sob', 'voice'], prompt: 'Quiet crying sniffle, restrained sadness, soft breath and nose sniff, no spoken words, no music' },
    { name: 'heartbeat tense close', filename: 'heartbeat-tense-close.mp3', duration: 8, type: 'sfx', group: 'human', keywords: ['heartbeat', 'heart', 'tense', 'pulse', 'body', 'fear', 'close', 'suspense'], prompt: 'Close tense heartbeat pulse, steady but anxious, medical-free cinematic body sound, no music' },
    { name: 'breathing heavy running', filename: 'breathing-heavy-running.mp3', duration: 6, type: 'sfx', group: 'human', keywords: ['breathing', 'heavy', 'running', 'panting', 'human', 'exertion', 'breath', 'chase'], prompt: 'Heavy human breathing after running, panting and exertion, no words, no footsteps, no music' },
    { name: 'hand clap single', filename: 'hand-clap-single.mp3', duration: 1, type: 'sfx', group: 'human', keywords: ['hand', 'clap', 'single', 'applause', 'hands', 'slap', 'human', 'impact'], prompt: 'Single clean hand clap, close microphone, natural room tone, no crowd, no music' },
    { name: 'applause small room', filename: 'applause-small-room.mp3', duration: 7, type: 'sfx', group: 'human', keywords: ['applause', 'small', 'room', 'clapping', 'audience', 'hands', 'people', 'indoor'], prompt: 'Small indoor room applause, several people clapping warmly, no cheering, no music, no clear voices' },
    { name: 'body fall onto floor', filename: 'body-fall-onto-floor.mp3', duration: 3, type: 'sfx', group: 'human', keywords: ['body', 'fall', 'floor', 'thud', 'collapse', 'impact', 'human', 'drop'], prompt: 'Human body falling onto a hard indoor floor with a heavy thud, realistic Foley, no gore, no music' },
    { name: 'pockets pat down search', filename: 'pockets-pat-down-search.mp3', duration: 5, type: 'sfx', group: 'human', keywords: ['pockets', 'pat', 'down', 'search', 'clothes', 'fabric', 'hands', 'checking'], prompt: 'Person patting down jacket and pants pockets, fabric taps and hand movement, realistic Foley, no music' },
    { name: 'backpack rummage zipper', filename: 'backpack-rummage-zipper.mp3', duration: 6, type: 'sfx', group: 'human', keywords: ['backpack', 'rummage', 'zipper', 'bag', 'search', 'fabric', 'pocket', 'gear'], prompt: 'Backpack being rummaged through with zipper and fabric movement, small objects shifting, no music, no voices' },
    { name: 'coin purse rummage', filename: 'coin-purse-rummage.mp3', duration: 4, type: 'sfx', group: 'human', keywords: ['coin', 'purse', 'rummage', 'coins', 'money', 'bag', 'jingle', 'search'], prompt: 'Small coin purse being rummaged through, coins jingling softly in fabric pouch, realistic Foley, no music' },

    { name: 'doorbell chime house', filename: 'doorbell-chime-house.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['doorbell', 'chime', 'house', 'front', 'door', 'ring', 'ding', 'home'], prompt: 'House doorbell chime, classic front door ding dong in quiet home, no music, no voices' },
    { name: 'door knock soft indoor', filename: 'door-knock-soft-indoor.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['door', 'knock', 'soft', 'indoor', 'wood', 'tap', 'room', 'home'], prompt: 'Soft polite knock on an interior wooden door, realistic indoor Foley, no music' },
    { name: 'door knock urgent indoor', filename: 'door-knock-urgent-indoor.mp3', duration: 4, type: 'sfx', group: 'home', keywords: ['door', 'knock', 'urgent', 'indoor', 'wood', 'pounding', 'room', 'home'], prompt: 'Urgent repeated knocking on a wooden door, firm indoor knocks, no voices, no music' },
    { name: 'doorknob turn open', filename: 'doorknob-turn-open.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['doorknob', 'turn', 'open', 'door', 'handle', 'latch', 'metal', 'entry'], prompt: 'Metal doorknob turning and latch opening, quiet interior door Foley, no music' },
    { name: 'sliding closet door', filename: 'sliding-closet-door.mp3', duration: 5, type: 'sfx', group: 'home', keywords: ['sliding', 'closet', 'door', 'track', 'open', 'close', 'room', 'home'], prompt: 'Sliding closet door moving along its track, soft rumble and stop, realistic room Foley, no music' },
    { name: 'metal lock latch click', filename: 'metal-lock-latch-click.mp3', duration: 2, type: 'sfx', group: 'home', keywords: ['metal', 'lock', 'latch', 'click', 'bolt', 'door', 'secure', 'mechanism'], prompt: 'Small metal lock latch clicking shut, crisp bolt mechanism, close microphone, no music' },
    { name: 'glass breaking small', filename: 'glass-breaking-small.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['glass', 'breaking', 'break', 'small', 'shatter', 'cup', 'impact', 'pieces'], prompt: 'Small glass object breaking on a hard floor, sharp shatter and little pieces settling, no music, no voices' },
    { name: 'glass bottle set down', filename: 'glass-bottle-set-down.mp3', duration: 2, type: 'sfx', group: 'home', keywords: ['glass', 'bottle', 'set', 'down', 'table', 'clink', 'drink', 'surface'], prompt: 'Glass bottle set down on a wooden table, clean clink and contact, realistic Foley, no music' },
    { name: 'liquid pouring glass', filename: 'liquid-pouring-glass.mp3', duration: 5, type: 'sfx', group: 'home', keywords: ['liquid', 'pouring', 'glass', 'water', 'drink', 'cup', 'stream', 'fill'], prompt: 'Liquid pouring into a glass, clear stream and filling sound, close realistic Foley, no music' },
    { name: 'spoon stirring mug', filename: 'spoon-stirring-mug.mp3', duration: 5, type: 'sfx', group: 'home', keywords: ['spoon', 'stirring', 'mug', 'cup', 'ceramic', 'tea', 'coffee', 'clink'], prompt: 'Metal spoon stirring inside a ceramic mug, gentle clinks and liquid swirl, no music, no voices' },
    { name: 'kettle boiling whistle', filename: 'kettle-boiling-whistle.mp3', duration: 8, type: 'sfx', group: 'home', keywords: ['kettle', 'boiling', 'whistle', 'tea', 'water', 'steam', 'kitchen', 'appliance'], prompt: 'Tea kettle boiling and beginning to whistle, steam pressure rising, realistic kitchen sound, no music' },
    { name: 'frying pan sizzle', filename: 'frying-pan-sizzle.mp3', duration: 8, type: 'sfx', group: 'home', keywords: ['frying', 'pan', 'sizzle', 'cooking', 'food', 'kitchen', 'oil', 'stove'], prompt: 'Food sizzling in a frying pan with hot oil, realistic kitchen cooking sound, no music, no voices' },
    { name: 'chopping vegetables board', filename: 'chopping-vegetables-board.mp3', duration: 6, type: 'sfx', group: 'home', keywords: ['chopping', 'vegetables', 'board', 'knife', 'cutting', 'kitchen', 'food', 'prep'], prompt: 'Knife chopping vegetables on a cutting board, steady kitchen prep Foley, no music, no voices' },
    { name: 'toaster pop toast', filename: 'toaster-pop-toast.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['toaster', 'pop', 'toast', 'kitchen', 'appliance', 'spring', 'breakfast', 'click'], prompt: 'Toaster popping toast up with spring snap and small appliance click, realistic kitchen Foley, no music' },
    { name: 'food wrapper crinkle', filename: 'food-wrapper-crinkle.mp3', duration: 4, type: 'sfx', group: 'home', keywords: ['food', 'wrapper', 'crinkle', 'plastic', 'snack', 'package', 'crumple', 'bag'], prompt: 'Plastic food wrapper crinkling in hands, snack package handling, close microphone, no music' },
    { name: 'chip bag opening', filename: 'chip-bag-opening.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['chip', 'bag', 'opening', 'snack', 'crinkle', 'plastic', 'rip', 'food'], prompt: 'Bag of chips being opened, plastic crinkle and small tear, realistic close Foley, no music' },
    { name: 'trash can lid close', filename: 'trash-can-lid-close.mp3', duration: 3, type: 'sfx', group: 'home', keywords: ['trash', 'can', 'lid', 'close', 'bin', 'metal', 'garbage', 'clank'], prompt: 'Trash can lid closing with a hollow clank, household garbage bin Foley, no music' },
    { name: 'paper towel tear', filename: 'paper-towel-tear.mp3', duration: 2, type: 'sfx', group: 'home', keywords: ['paper', 'towel', 'tear', 'rip', 'kitchen', 'roll', 'sheet', 'cleaning'], prompt: 'Paper towel sheet being torn from a roll, perforation rip and soft paper movement, no music' },
    { name: 'light bulb buzz flicker', filename: 'light-bulb-buzz-flicker.mp3', duration: 6, type: 'sfx', group: 'home', keywords: ['light', 'bulb', 'buzz', 'flicker', 'electric', 'lamp', 'hum', 'room'], prompt: 'Light bulb buzzing and flickering softly in a quiet room, electrical hum, no music' },
    { name: 'ceiling fan hum wobble', filename: 'ceiling-fan-hum-wobble.mp3', duration: 8, type: 'sfx', group: 'home', keywords: ['ceiling', 'fan', 'hum', 'wobble', 'room', 'motor', 'air', 'indoor'], prompt: 'Ceiling fan spinning with soft motor hum and slight wobble, quiet indoor room tone, no music' },

    { name: 'printer printing pages', filename: 'printer-printing-pages.mp3', duration: 7, type: 'sfx', group: 'tech', keywords: ['printer', 'printing', 'pages', 'paper', 'office', 'machine', 'feed', 'document'], prompt: 'Office printer printing several pages, paper feeding and mechanical movement, no voices, no music' },
    { name: 'scanner pass beep', filename: 'scanner-pass-beep.mp3', duration: 5, type: 'sfx', group: 'tech', keywords: ['scanner', 'scan', 'pass', 'beep', 'office', 'machine', 'document', 'light'], prompt: 'Document scanner pass followed by a small beep, office machine Foley, no music' },
    { name: 'camera shutter click', filename: 'camera-shutter-click.mp3', duration: 1, type: 'sfx', group: 'tech', keywords: ['camera', 'shutter', 'click', 'photo', 'picture', 'snapshot', 'lens', 'device'], prompt: 'Single camera shutter click, crisp photo capture sound, no music, no voices' },
    { name: 'phone notification ding', filename: 'phone-notification-ding.mp3', duration: 1, type: 'sfx', group: 'tech', keywords: ['phone', 'notification', 'ding', 'text', 'message', 'alert', 'mobile', 'chime'], prompt: 'Simple phone notification ding, clean modern alert tone, no ringtone melody, no music bed' },
    { name: 'laptop lid close', filename: 'laptop-lid-close.mp3', duration: 2, type: 'sfx', group: 'tech', keywords: ['laptop', 'lid', 'close', 'computer', 'shut', 'plastic', 'office', 'device'], prompt: 'Laptop lid closing with a soft plastic clack, office desk Foley, no music' },
    { name: 'usb plug insert', filename: 'usb-plug-insert.mp3', duration: 2, type: 'sfx', group: 'tech', keywords: ['usb', 'plug', 'insert', 'cable', 'computer', 'device', 'click', 'port'], prompt: 'USB plug inserted into a computer port, small plastic and metal click, close microphone, no music' },
    { name: 'power button click startup', filename: 'power-button-click-startup.mp3', duration: 4, type: 'sfx', group: 'tech', keywords: ['power', 'button', 'click', 'startup', 'device', 'computer', 'electronics', 'beep'], prompt: 'Power button clicked followed by subtle electronic startup beep and hum, no music' },
    { name: 'router modem beep', filename: 'router-modem-beep.mp3', duration: 4, type: 'sfx', group: 'tech', keywords: ['router', 'modem', 'beep', 'internet', 'electronics', 'device', 'network', 'status'], prompt: 'Small router modem status beep with faint electronic hum, modern device sound, no music' },
    { name: 'fluorescent light hum', filename: 'fluorescent-light-hum.mp3', duration: 8, type: 'sfx', group: 'tech', keywords: ['fluorescent', 'light', 'hum', 'electric', 'buzz', 'office', 'ceiling', 'lamp'], prompt: 'Fluorescent ceiling light humming with faint electric buzz, quiet office room tone, no music' },
    { name: 'projector fan start', filename: 'projector-fan-start.mp3', duration: 6, type: 'sfx', group: 'tech', keywords: ['projector', 'fan', 'start', 'presentation', 'office', 'motor', 'machine', 'hum'], prompt: 'Projector powering on with fan starting and lamp hum, classroom or office device, no music' },
    { name: 'whiteboard marker writing', filename: 'whiteboard-marker-writing.mp3', duration: 6, type: 'sfx', group: 'tech', keywords: ['whiteboard', 'marker', 'writing', 'office', 'classroom', 'squeak', 'pen', 'board'], prompt: 'Dry erase marker writing on a whiteboard, soft squeaks and strokes, no voices, no music' },
    { name: 'stapler punch paper', filename: 'stapler-punch-paper.mp3', duration: 2, type: 'sfx', group: 'tech', keywords: ['stapler', 'punch', 'paper', 'office', 'staple', 'document', 'click', 'desk'], prompt: 'Stapler punching through a small stack of paper, sharp office desk click, no music' },
    { name: 'hole punch paper', filename: 'hole-punch-paper.mp3', duration: 2, type: 'sfx', group: 'tech', keywords: ['hole', 'punch', 'paper', 'office', 'document', 'binder', 'click', 'desk'], prompt: 'Two-hole paper punch pressing through sheets, mechanical office click, no music' },
    { name: 'tape dispenser strip', filename: 'tape-dispenser-strip.mp3', duration: 3, type: 'sfx', group: 'tech', keywords: ['tape', 'dispenser', 'strip', 'office', 'adhesive', 'tear', 'desk', 'package'], prompt: 'Clear tape pulled from a desktop tape dispenser and torn on the teeth, realistic office Foley, no music' },
    { name: 'cash register drawer', filename: 'cash-register-drawer.mp3', duration: 3, type: 'sfx', group: 'tech', keywords: ['cash', 'register', 'drawer', 'money', 'shop', 'checkout', 'bell', 'open'], prompt: 'Cash register drawer opening with small bell and money tray rattle, shop checkout Foley, no music' },

    { name: 'car door open close', filename: 'car-door-open-close.mp3', duration: 4, type: 'sfx', group: 'vehicle', keywords: ['car', 'door', 'open', 'close', 'vehicle', 'slam', 'handle', 'street'], prompt: 'Car door opening and closing with solid vehicle slam, realistic exterior Foley, no music' },
    { name: 'car engine start idle', filename: 'car-engine-start-idle.mp3', duration: 8, type: 'sfx', group: 'vehicle', keywords: ['car', 'engine', 'start', 'idle', 'vehicle', 'ignition', 'motor', 'street'], prompt: 'Car engine starting and settling into idle, modern vehicle ignition, no music' },
    { name: 'car drive by street', filename: 'car-drive-by-street.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['car', 'drive', 'by', 'street', 'vehicle', 'pass', 'road', 'traffic'], prompt: 'Single car driving by on a city street, realistic pass-by Doppler, no music, no horn' },
    { name: 'tire screech short', filename: 'tire-screech-short.mp3', duration: 3, type: 'sfx', group: 'vehicle', keywords: ['tire', 'screech', 'short', 'car', 'brake', 'skid', 'vehicle', 'road'], prompt: 'Short car tire screech and skid on pavement, urgent braking sound, no crash, no music' },
    { name: 'car horn double honk', filename: 'car-horn-double-honk.mp3', duration: 2, type: 'sfx', group: 'vehicle', keywords: ['car', 'horn', 'double', 'honk', 'vehicle', 'traffic', 'street', 'alert'], prompt: 'Car horn double honk, short urban traffic alert, no music' },
    { name: 'truck reverse beeps', filename: 'truck-reverse-beeps.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['truck', 'reverse', 'beeps', 'backup', 'vehicle', 'construction', 'warning', 'street'], prompt: 'Truck reversing with steady backup beeps, industrial vehicle warning, no voices, no music' },
    { name: 'bus air brakes stop', filename: 'bus-air-brakes-stop.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['bus', 'air', 'brakes', 'stop', 'vehicle', 'street', 'transit', 'hiss'], prompt: 'City bus stopping with air brake hiss and heavy vehicle settling, no voices, no music' },
    { name: 'subway train arriving', filename: 'subway-train-arriving.mp3', duration: 10, type: 'sfx', group: 'vehicle', keywords: ['subway', 'train', 'arriving', 'station', 'rail', 'transit', 'brakes', 'urban'], prompt: 'Subway train arriving at a station, rail rumble and brakes, no announcements, no music' },
    { name: 'train horn distant', filename: 'train-horn-distant.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['train', 'horn', 'distant', 'rail', 'whistle', 'crossing', 'transport', 'night'], prompt: 'Distant train horn echoing across town, realistic railway whistle, no music' },
    { name: 'motorcycle rev pass', filename: 'motorcycle-rev-pass.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['motorcycle', 'rev', 'pass', 'engine', 'vehicle', 'street', 'bike', 'road'], prompt: 'Motorcycle engine revving and passing by on a road, realistic vehicle sound, no music' },
    { name: 'bicycle bell ring', filename: 'bicycle-bell-ring.mp3', duration: 2, type: 'sfx', group: 'vehicle', keywords: ['bicycle', 'bell', 'ring', 'bike', 'ding', 'street', 'alert', 'cycle'], prompt: 'Bicycle bell ringing twice, bright small ding, outdoor street Foley, no music' },
    { name: 'elevator ding doors open', filename: 'elevator-ding-doors-open.mp3', duration: 5, type: 'sfx', group: 'vehicle', keywords: ['elevator', 'ding', 'doors', 'open', 'lift', 'building', 'metal', 'lobby'], prompt: 'Elevator ding followed by metal doors sliding open, office building lobby sound, no music' },
    { name: 'escalator mechanical hum', filename: 'escalator-mechanical-hum.mp3', duration: 8, type: 'sfx', group: 'vehicle', keywords: ['escalator', 'mechanical', 'hum', 'steps', 'mall', 'building', 'motor', 'movement'], prompt: 'Escalator mechanical hum with moving steps, indoor mall or transit building, no voices, no music' },
    { name: 'crosswalk signal beep', filename: 'crosswalk-signal-beep.mp3', duration: 6, type: 'sfx', group: 'vehicle', keywords: ['crosswalk', 'signal', 'beep', 'street', 'pedestrian', 'traffic', 'walk', 'alert'], prompt: 'Pedestrian crosswalk signal beeping steadily at an intersection, no traffic bed, no music' },
    { name: 'city traffic light ambience', filename: 'city-traffic-light-ambience.mp3', duration: 18, type: 'ambience', loop: true, group: 'vehicle', keywords: ['city', 'traffic', 'light', 'ambience', 'ambient', 'street', 'cars', 'urban'], prompt: 'Light city traffic ambience loop, distant cars passing, soft urban street tone, no horns, no music, no voices' },
    { name: 'police siren pass', filename: 'police-siren-pass.mp3', duration: 8, type: 'sfx', group: 'vehicle', keywords: ['police', 'siren', 'pass', 'emergency', 'vehicle', 'street', 'wail', 'urban'], prompt: 'Police car siren passing by on a city street, realistic Doppler movement, no music' },
    { name: 'ambulance siren pass', filename: 'ambulance-siren-pass.mp3', duration: 8, type: 'sfx', group: 'vehicle', keywords: ['ambulance', 'siren', 'pass', 'emergency', 'vehicle', 'street', 'medical', 'wail'], prompt: 'Ambulance siren passing by, urgent emergency vehicle sound with Doppler, no music' },
    { name: 'helicopter overhead distant', filename: 'helicopter-overhead-distant.mp3', duration: 10, type: 'sfx', group: 'vehicle', keywords: ['helicopter', 'overhead', 'distant', 'rotor', 'aircraft', 'sky', 'pass', 'vehicle'], prompt: 'Distant helicopter passing overhead, rotor thump in the sky, realistic exterior sound, no music' },
    { name: 'airplane overhead distant', filename: 'airplane-overhead-distant.mp3', duration: 10, type: 'sfx', group: 'vehicle', keywords: ['airplane', 'overhead', 'distant', 'aircraft', 'jet', 'sky', 'pass', 'vehicle'], prompt: 'Distant airplane passing overhead, low jet rumble in open sky, no music' },
    { name: 'garage door opening', filename: 'garage-door-opening.mp3', duration: 8, type: 'sfx', group: 'vehicle', keywords: ['garage', 'door', 'opening', 'motor', 'track', 'house', 'vehicle', 'rumble'], prompt: 'Automatic garage door opening on motorized track, rumble and chain movement, no music' },

    { name: 'rain on window ambience', filename: 'rain-on-window-ambience.mp3', duration: 18, type: 'ambience', loop: true, group: 'nature', keywords: ['rain', 'window', 'ambience', 'ambient', 'glass', 'weather', 'indoor', 'drops'], prompt: 'Rain tapping against a window ambience loop, cozy indoor perspective, no thunder, no music, no voices' },
    { name: 'heavy rain roof ambience', filename: 'heavy-rain-roof-ambience.mp3', duration: 18, type: 'ambience', loop: true, group: 'nature', keywords: ['heavy', 'rain', 'roof', 'ambience', 'ambient', 'weather', 'storm', 'house'], prompt: 'Heavy rain on a roof ambience loop, steady weather texture, no thunder, no music, no voices' },
    { name: 'thunder crack close', filename: 'thunder-crack-close.mp3', duration: 5, type: 'sfx', group: 'nature', keywords: ['thunder', 'crack', 'close', 'storm', 'weather', 'boom', 'lightning', 'sky'], prompt: 'Close thunder crack with deep rumble tail, dramatic storm sound, no rain bed, no music' },
    { name: 'wind through trees', filename: 'wind-through-trees.mp3', duration: 10, type: 'sfx', group: 'nature', keywords: ['wind', 'through', 'trees', 'forest', 'gust', 'leaves', 'weather', 'nature'], prompt: 'Wind gust moving through trees and leaves, natural outdoor sound, no birds, no music' },
    { name: 'leaves rustle gust', filename: 'leaves-rustle-gust.mp3', duration: 6, type: 'sfx', group: 'nature', keywords: ['leaves', 'rustle', 'gust', 'wind', 'forest', 'foliage', 'nature', 'outdoor'], prompt: 'Dry leaves rustling in a gust of wind, close natural foliage movement, no footsteps, no birds, no music' },
    { name: 'river stream gentle ambience', filename: 'river-stream-gentle-ambience.mp3', duration: 18, type: 'ambience', loop: true, group: 'nature', keywords: ['river', 'stream', 'gentle', 'ambience', 'ambient', 'water', 'flow', 'nature'], prompt: 'Gentle river stream ambience loop, flowing water over stones, no birds, no music, no voices' },
    { name: 'ocean wave crash shore', filename: 'ocean-wave-crash-shore.mp3', duration: 8, type: 'sfx', group: 'nature', keywords: ['ocean', 'wave', 'crash', 'shore', 'sea', 'water', 'surf', 'beach'], prompt: 'Single ocean wave crashing on shore and receding, realistic surf impact, no gulls, no music' },
    { name: 'snow footsteps crunch', filename: 'snow-footsteps-crunch.mp3', duration: 6, type: 'sfx', group: 'nature', keywords: ['snow', 'footsteps', 'crunch', 'walking', 'winter', 'boots', 'outdoor', 'steps'], prompt: 'Footsteps crunching through fresh snow, single walker, quiet winter outdoor Foley, no wind, no music' },
    { name: 'mud footsteps squelch', filename: 'mud-footsteps-squelch.mp3', duration: 6, type: 'sfx', group: 'nature', keywords: ['mud', 'footsteps', 'squelch', 'walking', 'wet', 'boots', 'outdoor', 'steps'], prompt: 'Boot footsteps squelching through wet mud, sticky outdoor movement, no rain, no music' },
    { name: 'gravel footsteps outdoor', filename: 'gravel-footsteps-outdoor.mp3', duration: 6, type: 'sfx', group: 'nature', keywords: ['gravel', 'footsteps', 'outdoor', 'walking', 'stones', 'path', 'boots', 'steps'], prompt: 'Single person walking on gravel path, crunchy small stones under shoes, no ambience bed, no music' },
    { name: 'campfire crackle close', filename: 'campfire-crackle-close.mp3', duration: 10, type: 'sfx', group: 'nature', keywords: ['campfire', 'crackle', 'close', 'fire', 'wood', 'flame', 'outdoor', 'logs'], prompt: 'Close campfire crackling with small wood pops, natural fire Foley, no crickets, no music' },
    { name: 'torch wall crackle dungeon', filename: 'torch-wall-crackle-dungeon.mp3', duration: 8, type: 'sfx', group: 'nature', keywords: ['torch', 'wall', 'crackle', 'dungeon', 'fire', 'flame', 'stone', 'fantasy'], prompt: 'Wall torch crackling in a stone dungeon, close flame texture, no ambience bed, no music' },
    { name: 'puddle splash step', filename: 'puddle-splash-step.mp3', duration: 3, type: 'sfx', group: 'nature', keywords: ['puddle', 'splash', 'step', 'water', 'foot', 'walking', 'wet', 'outdoor'], prompt: 'Single foot stepping into a shallow puddle, water splash and shoe movement, no rain bed, no music' },
    { name: 'branch snap underfoot', filename: 'branch-snap-underfoot.mp3', duration: 2, type: 'sfx', group: 'nature', keywords: ['branch', 'snap', 'underfoot', 'twig', 'forest', 'step', 'break', 'outdoor'], prompt: 'Dry branch snapping underfoot, sharp twig break on forest floor, no birds, no music' },
    { name: 'night insects ambience', filename: 'night-insects-ambience.mp3', duration: 18, type: 'ambience', loop: true, group: 'nature', keywords: ['night', 'insects', 'ambience', 'ambient', 'crickets', 'outdoor', 'summer', 'field'], prompt: 'Night insects ambience loop, crickets and soft summer field texture, no frogs, no music, no voices' },

    { name: 'crossbow bolt fire', filename: 'crossbow-bolt-fire.mp3', duration: 3, type: 'sfx', group: 'tabletop', keywords: ['crossbow', 'bolt', 'fire', 'shoot', 'weapon', 'twang', 'fantasy', 'dnd'], prompt: 'Crossbow firing a bolt, mechanical twang and projectile release, fantasy combat Foley, no music' },
    { name: 'arrow hit wooden target', filename: 'arrow-hit-wooden-target.mp3', duration: 2, type: 'sfx', group: 'tabletop', keywords: ['arrow', 'hit', 'wooden', 'target', 'bow', 'thunk', 'projectile', 'dnd'], prompt: 'Arrow hitting a wooden target with a firm thunk, medieval archery Foley, no music' },
    { name: 'arrow fly whoosh', filename: 'arrow-fly-whoosh.mp3', duration: 2, type: 'sfx', group: 'tabletop', keywords: ['arrow', 'fly', 'whoosh', 'bow', 'projectile', 'shot', 'air', 'dnd'], prompt: 'Arrow flying quickly past with a clean whoosh, fantasy projectile sound, no impact, no music' },
    { name: 'dagger draw quick', filename: 'dagger-draw-quick.mp3', duration: 2, type: 'sfx', group: 'tabletop', keywords: ['dagger', 'draw', 'quick', 'blade', 'knife', 'weapon', 'unsheath', 'dnd'], prompt: 'Quick dagger drawn from a sheath, short metal blade scrape, fantasy stealth Foley, no music' },
    { name: 'shield bash heavy shove', filename: 'shield-bash-heavy-shove.mp3', duration: 3, type: 'sfx', group: 'tabletop', keywords: ['shield', 'bash', 'heavy', 'shove', 'impact', 'combat', 'metal', 'dnd'], prompt: 'Heavy shield bash shove into an enemy, metal impact and body push, fantasy combat Foley, no music' },
    { name: 'armor strap buckle', filename: 'armor-strap-buckle.mp3', duration: 4, type: 'sfx', group: 'tabletop', keywords: ['armor', 'strap', 'buckle', 'leather', 'metal', 'gear', 'equip', 'dnd'], prompt: 'Armor strap and buckle being tightened, leather pull and metal buckle clicks, fantasy gear Foley, no music' },
    { name: 'armor clank movement', filename: 'armor-clank-movement.mp3', duration: 5, type: 'sfx', group: 'tabletop', keywords: ['armor', 'clank', 'movement', 'metal', 'walking', 'plate', 'gear', 'dnd'], prompt: 'Plate armor clanking as a warrior shifts and walks, metal movement Foley, no music' },
    { name: 'chainmail movement rustle', filename: 'chainmail-movement-rustle.mp3', duration: 5, type: 'sfx', group: 'tabletop', keywords: ['chainmail', 'movement', 'rustle', 'metal', 'armor', 'links', 'gear', 'dnd'], prompt: 'Chainmail rustling with body movement, many small metal links shifting, fantasy armor Foley, no music' },
    { name: 'lock picking tools', filename: 'lock-picking-tools.mp3', duration: 6, type: 'sfx', group: 'tabletop', keywords: ['lock', 'picking', 'tools', 'pick', 'thief', 'metal', 'click', 'dnd'], prompt: 'Lock picking tools working inside a small lock, tiny metal clicks and tension, fantasy stealth Foley, no music' },
    { name: 'magic wand spark', filename: 'magic-wand-spark.mp3', duration: 3, type: 'sfx', group: 'tabletop', keywords: ['magic', 'wand', 'spark', 'spell', 'arcane', 'wizard', 'cast', 'dnd'], prompt: 'Magic wand producing a small bright spark, delicate arcane crackle and shimmer, no music' },
    { name: 'spell charge buildup', filename: 'spell-charge-buildup.mp3', duration: 5, type: 'sfx', group: 'tabletop', keywords: ['spell', 'charge', 'buildup', 'magic', 'arcane', 'energy', 'cast', 'dnd'], prompt: 'Spell energy charging up before release, growing arcane hum and sparkle, fantasy magic, no music' },
    { name: 'poison gas hiss trap', filename: 'poison-gas-hiss-trap.mp3', duration: 5, type: 'sfx', group: 'tabletop', keywords: ['poison', 'gas', 'hiss', 'trap', 'dungeon', 'danger', 'cloud', 'dnd'], prompt: 'Poison gas trap hissing from dungeon vents, dangerous vapor release, no voices, no music' },
    { name: 'boulder trap rolling rumble', filename: 'boulder-trap-rolling-rumble.mp3', duration: 7, type: 'sfx', group: 'tabletop', keywords: ['boulder', 'trap', 'rolling', 'rumble', 'stone', 'dungeon', 'chase', 'dnd'], prompt: 'Huge boulder trap rolling down a stone corridor, heavy rumble growing closer, fantasy dungeon Foley, no music' },
    { name: 'portcullis slam drop', filename: 'portcullis-slam-drop.mp3', duration: 4, type: 'sfx', group: 'tabletop', keywords: ['portcullis', 'slam', 'drop', 'gate', 'metal', 'castle', 'dungeon', 'dnd'], prompt: 'Heavy metal portcullis dropping and slamming shut, castle gate impact, fantasy dungeon Foley, no music' },
    { name: 'treasure coins handful spill', filename: 'treasure-coins-handful-spill.mp3', duration: 4, type: 'sfx', group: 'tabletop', keywords: ['treasure', 'coins', 'handful', 'spill', 'gold', 'loot', 'money', 'dnd'], prompt: 'Handful of gold coins spilling onto a wooden table, bright treasure jingle, fantasy loot Foley, no music' },
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

    if (NEEDED_SOUNDS.length !== 100) errors.push(`expected 100 sounds, found ${NEEDED_SOUNDS.length}`);

    for (const sound of NEEDED_SOUNDS) {
        for (const requiredKey of ['name', 'filename', 'prompt', 'duration', 'type', 'keywords', 'group']) {
            if (sound[requiredKey] === undefined || sound[requiredKey] === null) {
                errors.push(`${sound.name || '(unnamed)'}: missing ${requiredKey}`);
            }
        }
        if (!['music', 'sfx', 'ambience'].includes(sound.type)) errors.push(`${sound.name}: invalid type ${sound.type}`);
        if (!Number.isFinite(sound.duration) || sound.duration <= 0 || sound.duration > 22) errors.push(`${sound.name}: invalid duration ${sound.duration}`);
        if (!Array.isArray(sound.keywords) || sound.keywords.length < 8) errors.push(`${sound.name}: expected at least 8 keywords`);
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

    const byType = NEEDED_SOUNDS.reduce((counts, sound) => {
        counts[sound.type] = (counts[sound.type] || 0) + 1;
        return counts;
    }, {});
    const byGroup = NEEDED_SOUNDS.reduce((counts, sound) => {
        counts[sound.group] = (counts[sound.group] || 0) + 1;
        return counts;
    }, {});
    const totalDuration = NEEDED_SOUNDS.reduce((sum, sound) => sum + sound.duration, 0);

    console.log(`\nNeeded-area ElevenLabs batch: ${NEEDED_SOUNDS.length} sounds`);
    for (const [group, count] of Object.entries(byGroup)) console.log(`  ${group.padEnd(10)} ${count}`);
    for (const [type, count] of Object.entries(byType)) console.log(`  ${type.padEnd(10)} ${count}`);
    console.log(`  total requested duration: ${totalDuration}s (~${Math.ceil(totalDuration / 60)} min)`);

    const catalogPath = join(process.cwd(), 'public', 'saved-sounds.json');
    const catalogJson = JSON.parse(await readFile(catalogPath, 'utf-8'));
    const catalog = Array.isArray(catalogJson.files) ? catalogJson.files : [];
    const existingNames = new Set(catalog.map((sound) => String(sound.name || '').toLowerCase()));
    const existingFiles = new Set(catalog.map((sound) => String(sound.file || '').toLowerCase()));
    const newCatalogEntries = NEEDED_SOUNDS.filter((sound) => {
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
    for (let index = 0; index < NEEDED_SOUNDS.length; index++) {
        const sound = NEEDED_SOUNDS[index];
        const entry = catalogEntry(sound);
        const r2Key = entry.file;
        const tag = `[${index + 1}/${NEEDED_SOUNDS.length}]`;

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
