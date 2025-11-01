#!/usr/bin/env node
/**
 * Rebuild soundCatalog.json from all files in server/media
 * Automatically generates IDs, types, tags, and metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaDir = path.join(__dirname, 'media');
const catalogPath = path.join(__dirname, 'soundCatalog.json');

// Tag mapping: filename patterns -> semantic tags
const tagPatterns = [
  // Monsters & creatures
  { pattern: /dragon|monster|ogre|beast/i, tags: ['monster', 'creature', 'beast', 'danger'] },
  { pattern: /zombie|undead/i, tags: ['zombie', 'undead', 'horror', 'monster'] },
  { pattern: /wolf/i, tags: ['wolf', 'animal', 'howl', 'night'] },
  { pattern: /growl|roar/i, tags: ['growl', 'roar', 'monster', 'aggressive'] },
  
  // Combat & weapons
  { pattern: /sword|blade/i, tags: ['sword', 'weapon', 'combat', 'metal'] },
  { pattern: /bow|arrow/i, tags: ['bow', 'arrow', 'weapon', 'projectile'] },
  { pattern: /fight|combat/i, tags: ['combat', 'battle', 'fighting'] },
  { pattern: /explosion|blast|boom/i, tags: ['explosion', 'blast', 'boom', 'loud'] },
  { pattern: /gun|shoot|shot/i, tags: ['gun', 'gunshot', 'weapon', 'modern'] },
  
  // Magic & spells
  { pattern: /magic|spell/i, tags: ['magic', 'spell', 'fantasy', 'mystical'] },
  { pattern: /fireball/i, tags: ['fireball', 'fire', 'magic', 'explosion'] },
  { pattern: /heal/i, tags: ['heal', 'magic', 'restoration', 'holy'] },
  
  // Animals
  { pattern: /horse/i, tags: ['horse', 'animal', 'hooves'] },
  { pattern: /dog|bark|woof/i, tags: ['dog', 'bark', 'animal', 'pet'] },
  { pattern: /cat|meow/i, tags: ['cat', 'meow', 'animal', 'pet'] },
  { pattern: /bird|crow|owl|rooster|chicken/i, tags: ['bird', 'animal', 'nature'] },
  { pattern: /cow/i, tags: ['cow', 'animal', 'farm'] },
  
  // Movement
  { pattern: /footstep|walk/i, tags: ['footsteps', 'walking', 'movement'] },
  { pattern: /gallop|trot/i, tags: ['horse', 'galloping', 'fast', 'movement'] },
  { pattern: /running|run/i, tags: ['running', 'fast', 'movement'] },
  
  // Weather & nature
  { pattern: /thunder|storm/i, tags: ['thunder', 'storm', 'weather', 'loud'] },
  { pattern: /lightning/i, tags: ['lightning', 'storm', 'electric', 'weather'] },
  { pattern: /rain/i, tags: ['rain', 'water', 'weather', 'ambient'] },
  { pattern: /wind/i, tags: ['wind', 'weather', 'ambient'] },
  { pattern: /fire|flame|crackling/i, tags: ['fire', 'flames', 'crackling', 'warm'] },
  { pattern: /water|stream/i, tags: ['water', 'stream', 'nature', 'flowing'] },
  
  // Atmosphere
  { pattern: /christmas|holiday|festive|xmas/i, tags: ['christmas', 'holiday', 'festive', 'winter'] },
  { pattern: /horror|creepy|eerie|spooky/i, tags: ['horror', 'creepy', 'eerie', 'dark'] },
  { pattern: /medieval|fantasy|rpg/i, tags: ['medieval', 'fantasy', 'rpg', 'adventure'] },
  { pattern: /tavern|pub|crowd/i, tags: ['tavern', 'crowd', 'people', 'ambient'] },
  { pattern: /village|town/i, tags: ['village', 'town', 'settlement', 'ambient'] },
  { pattern: /forest|wood/i, tags: ['forest', 'woods', 'nature', 'trees'] },
  { pattern: /night|evening/i, tags: ['night', 'evening', 'dark', 'ambient'] },
  { pattern: /pirate|ship|sea/i, tags: ['pirate', 'ship', 'sea', 'water'] },
  
  // Actions & events
  { pattern: /door|creak|open|close/i, tags: ['door', 'creak', 'interior'] },
  { pattern: /knock/i, tags: ['knock', 'door', 'impact'] },
  { pattern: /bell|chime|ding/i, tags: ['bell', 'chime', 'ring'] },
  { pattern: /coin|gold|money/i, tags: ['coin', 'gold', 'money', 'collect'] },
  { pattern: /scream|yell/i, tags: ['scream', 'yell', 'voice', 'horror'] },
  { pattern: /breathing/i, tags: ['breathing', 'breath', 'voice', 'human'] },
  { pattern: /heartbeat|heart/i, tags: ['heartbeat', 'heart', 'pulse', 'tension'] },
  { pattern: /cheer|applause/i, tags: ['cheering', 'applause', 'crowd', 'celebration'] },
  { pattern: /glass|shatter|break/i, tags: ['glass', 'shatter', 'break', 'crash'] },
  { pattern: /tree/i, tags: ['tree', 'wood', 'nature', 'forest'] },
  { pattern: /train/i, tags: ['train', 'locomotive', 'transport', 'modern'] },
  { pattern: /car|vehicle/i, tags: ['car', 'vehicle', 'engine', 'modern'] },
  { pattern: /elevator/i, tags: ['elevator', 'lift', 'interior', 'modern'] },
  { pattern: /phone/i, tags: ['phone', 'telephone', 'ring', 'modern'] },
  { pattern: /alarm/i, tags: ['alarm', 'clock', 'wake', 'alert'] },
  { pattern: /anvil/i, tags: ['anvil', 'metal', 'forge', 'blacksmith'] },
  { pattern: /pencil|writing/i, tags: ['writing', 'pencil', 'paper', 'quiet'] },
  { pattern: /radio/i, tags: ['radio', 'static', 'electronic', 'modern'] },
  { pattern: /scratch/i, tags: ['scratch', 'scraping', 'creepy'] },
  { pattern: /firework/i, tags: ['fireworks', 'celebration', 'explosion', 'festive'] },
  { pattern: /whoosh|swish/i, tags: ['whoosh', 'swish', 'air', 'fast'] },
  { pattern: /poof/i, tags: ['poof', 'magic', 'disappear', 'smoke'] },
  { pattern: /punch|thud|impact/i, tags: ['punch', 'impact', 'hit', 'combat'] },
  { pattern: /rewind/i, tags: ['rewind', 'tape', 'retro', 'time'] },
  { pattern: /ringing.*ear/i, tags: ['ringing', 'tinnitus', 'ears', 'effect'] },
  { pattern: /woman/i, tags: ['woman', 'female', 'voice', 'human'] },
  
  // Music types
  { pattern: /piano/i, tags: ['piano', 'keys', 'melodic', 'calm'] },
  { pattern: /music.*box/i, tags: ['music box', 'mechanical', 'delicate', 'nostalgic'] },
  { pattern: /orchestral/i, tags: ['orchestral', 'epic', 'grand', 'cinematic'] },
  { pattern: /ambient|ambience/i, tags: ['ambient', 'atmosphere', 'background', 'calm'] },
];

function generateTags(filename, folderType) {
  const tags = new Set();
  
  // Add type-based tags
  if (folderType === 'music') {
    tags.add('music');
    tags.add('looping');
    tags.add('background');
  } else if (folderType === 'ambience') {
    tags.add('ambience');
    tags.add('ambient');
    tags.add('atmosphere');
    tags.add('looping');
  } else {
    tags.add('sfx');
    tags.add('effect');
  }
  
  // Match patterns
  for (const { pattern, tags: patternTags } of tagPatterns) {
    if (pattern.test(filename)) {
      patternTags.forEach(t => tags.add(t));
    }
  }
  
  // Extract words from filename (split on _ - . and space)
  const words = filename
    .replace(/\.[^.]+$/, '') // remove extension
    .split(/[-_.\s]+/)
    .filter(w => w.length > 2 && !/^\d+$/.test(w)); // skip short words and numbers
  
  words.forEach(w => tags.add(w.toLowerCase()));

  // Expand with synonyms/canonical tags for stronger matching
  const expandSynonyms = (set) => {
    const has = (t) => set.has(t);
    const add = (arr) => arr.forEach(t => set.add(t));

    // Creatures/monsters
    if (has('ogre') || has('troll') || has('orc') || has('goblin') || has('beast')) add(['monster', 'creature']);
    if (has('dragon')) add(['monster', 'creature']);
    if (has('zombie') || has('undead')) add(['zombie', 'undead', 'horror', 'monster']);

    // Vocalizations
    if (has('roar') || has('growl') || has('snarl')) add(['growl', 'roar']);
    if (has('scream') || has('shriek') || has('yell')) add(['scream', 'yell']);

    // Weather
    if (has('lightning')) add(['thunder', 'storm']);
    if (has('thunder')) add(['lightning', 'storm']);
    if (has('wind') || has('whoosh') || has('gust')) add(['wind', 'whoosh']);
    if (has('rain') || has('drizzle') || has('shower')) add(['rain']);

    // Movement
    if (has('footstep') || has('footsteps') || has('walking') || has('steps')) add(['footsteps']);
    if (has('gallop') || has('galloping') || has('trot') || has('trotting')) add(['horse', 'galloping']);

    // Weapons/metal
    if (has('sword') || has('blade') || has('steel')) add(['sword', 'weapon', 'metal']);

    // Doors
    if (has('door') || has('creak') || has('squeak')) add(['door', 'creak']);

    // Fireworks
    if (has('firework') || has('fireworks')) add(['fireworks', 'explosion']);

    return set;
  };

  const expanded = Array.from(expandSynonyms(tags));
  return expanded;
}

function generateId(filename) {
  return filename
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/[-\s.]+/g, '_') // normalize separators to underscore
    .toLowerCase();
}

function scanMediaFolder(folder, type) {
  const folderPath = path.join(mediaDir, folder);
  const sounds = [];
  
  try {
    const files = fs.readdirSync(folderPath).filter(f => 
      !f.startsWith('.') && 
      /\.(mp3|wav|ogg|flac|m4a)$/i.test(f)
    );
    
    for (const file of files) {
      const id = generateId(file);
      const tags = generateTags(file, type);
      const loop = (type === 'music' || type === 'ambience' || file.includes('loop'));
      
      const base = process.env.MEDIA_BASE_URL ? String(process.env.MEDIA_BASE_URL).replace(/\/$/,'') : '';
      const src = base ? `${base}/${folder}/${file}` : `/media/${folder}/${file}`;
      sounds.push({
        id,
        type,
        tags,
        src,
        loop,
        license: 'saved-sounds-collection'
      });
    }
    
    console.log(`✓ Found ${files.length} ${type} files`);
  } catch (err) {
    console.warn(`⚠️  Could not scan ${folder}:`, err.message);
  }
  
  return sounds;
}

// Rebuild catalog
console.log('🔄 Rebuilding sound catalog from media files...\n');

const catalog = [
  ...scanMediaFolder('music', 'music'),
  ...scanMediaFolder('ambience', 'ambience'),
  ...scanMediaFolder('sfx', 'sfx')
];

// Write to file
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

console.log(`\n✅ Rebuilt catalog with ${catalog.length} sounds`);
console.log(`   Music: ${catalog.filter(s => s.type === 'music').length}`);
console.log(`   Ambience: ${catalog.filter(s => s.type === 'ambience').length}`);
console.log(`   SFX: ${catalog.filter(s => s.type === 'sfx').length}`);
console.log(`\n📝 Saved to: ${catalogPath}`);
