import fs from 'fs';
import path from 'path';
import { normalizeSoundForApi } from './sound-catalog.js';

export { normalizeSoundForApi } from './sound-catalog.js';

let staticSoundsCache = null;
let staticStoriesCache = null;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'onto', 'over', 'under',
  'then', 'than', 'they', 'them', 'their', 'there', 'here', 'have', 'has', 'had',
  'was', 'were', 'are', 'is', 'you', 'your', 'but', 'not', 'all', 'out', 'our',
  'she', 'his', 'her', 'him', 'who', 'what', 'when', 'where', 'why', 'how', 'can',
  'will', 'would', 'could', 'should', 'about', 'after', 'before', 'through', 'around',
  'auto',
]);

// Exported so other server routes (e.g. the AI sound generation fallback) can
// reuse the same "is this transcript describing a real sound event" gate
// instead of re-implementing their own evidence regex.
// Past-tense/irregular forms (roared, tore, fell, slammed, ...) are included
// deliberately — narration is overwhelmingly past tense, and missing those
// forms silently zeroed out both normal SFX candidates and the AI sound
// generation fallback's "missingSound" gate for very common phrasing.
export const SFX_EVENT_EVIDENCE = /\b(knock(?:s|ed|ing)?|slams?|slammed|slamming|creak(?:s|ed|ing)?|squeak(?:s|ed|ing)?|scrapes?|scraped|scraping|drags?|dragged|dragging|pull(?:s|ed|ing)?|unfold(?:s|ed|ing)?|unfurl(?:s|ed|ing)?|tears?|tore|torn|tearing|shatter(?:s|ed|ing)?|smash(?:es|ed|ing)?|crash(?:es|ed|ing)?|thuds?|thudded|thudding|thumps?|thumped|thumping|bangs?|banged|banging|booms?|boomed|booming|explod(?:e|es|ed|ing)|thunder(?:s|ed|ing)?|lightning|rain(?:s|ed|ing)?|storm(?:s|ed|ing)?|wind|howls?|howled|howling|barks?|barked|barking|chirps?|chirped|chirping|caws?|cawed|cawing|hoots?|hooted|hooting|growls?|growled|growling|roars?|roared|roaring|screams?|screamed|screaming|shrieks?|shrieked|shrieking|laughs?|laughed|laughing|whispers?|whispered|whispering|footsteps?|walk(?:s|ed|ing)?|runs?|ran|running|gallop(?:s|ed|ing)?|hooves?|sword|blade|slashes?|slashed|slashing|stabs?|stabbed|stabbing|clashes?|clashed|clashing|parr(?:y|ies|ied|ying)|blocks?|blocked|blocking|punch(?:es|ed|ing)?|hits?|hitting|arrow|bow|gunshot|gun|shot|fire|fired|firing|flames?|spell|magic|casts?|casting|bell|rings?|rang|rung|ringing|chimes?|chimed|drips?|dripped|dripping|splashes?|splashed|splashing|waves?|waved|crowd|cheers?|cheered|cheering|applause|dice|potion|trap|falls?|fell|fallen|falling|snaps?|snapped|snapping|cracks?|cracked|cracking|splinters?|splintered|splintering|collapse(?:s|d)?|collapsing|timber)\b/i;


const TERM_EXPANSIONS = {
  newspaper: ['paper', 'document', 'unfurl'],
  newspapers: ['paper', 'document', 'unfurl'],
  unfold: ['unfurl'],
  unfolds: ['unfurl'],
  unfolded: ['unfurl'],
  unfolding: ['unfurl'],
  unfurls: ['unfurl'],
  unfurled: ['unfurl'],
  pages: ['page', 'paper'],
};

const PHRASE_EXPANSIONS = [
  {
    pattern: /\b(pull|pulls|pulled|drag|drags|dragged|slide|slides|slid)\b.{0,40}\bchair\b|\bchair\b.{0,40}\b(pull|pulls|pulled|drag|drags|dragged|slide|slides|slid)\b/,
    terms: ['chair', 'scrape', 'drag', 'slide', 'furniture', 'wooden'],
  },
  {
    pattern: /\bchair\b.{0,40}\b(bump|bumps|bumped|hit|hits|knock|knocks|knocked)\b.{0,40}\btable\b|\btable\b.{0,40}\b(bump|bumps|bumped|hit|hits|knock|knocks|knocked)\b.{0,40}\bchair\b/,
    terms: ['chair', 'table', 'bump', 'knock', 'impact', 'furniture', 'wood'],
  },
];

export function getStaticSoundFiles() {
  if (staticSoundsCache) return staticSoundsCache;
  const filePath = path.join(process.cwd(), 'public', 'saved-sounds.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  staticSoundsCache = Array.isArray(data?.files) ? data.files : [];
  return staticSoundsCache;
}

export function getStaticStories() {
  if (staticStoriesCache) return staticStoriesCache;
  const filePath = path.join(process.cwd(), 'public', 'stories.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  staticStoriesCache = Array.isArray(data?.stories) ? data.stories : [];
  return staticStoriesCache;
}

export function getStaticSoundsForApi() {
  return getStaticSoundFiles().map(normalizeSoundForApi);
}

export function getStaticStoriesForApi() {
  return getStaticStories().map((story) => ({
    id: story.id,
    title: story.title,
    theme: story.theme || '',
    description: story.description || '',
    text: story.text || story.body || '',
    demo: !!story.demo,
  }));
}

export function buildCatalogSummary({ transcript = '', mode = 'auto', context = null } = {}) {
  const files = getStaticSoundFiles();
  const musicTerms = collectTerms(transcript, mode, context);
  // Automatic SFX must be grounded in fresh narration. Session state can
  // shape music, but must not make an old scene sound like a new event.
  const sfxTerms = collectTerms(transcript);
  const music = selectCandidates(files, musicTerms, 'music', 30);
  const sfx = SFX_EVENT_EVIDENCE.test(transcript)
    ? selectCandidates(files, sfxTerms, 'sfx', 70)
    : [];

  const musicLines = music.map((sound) => {
    const keywords = (sound.keywords || []).slice(0, 5).join(', ');
    return `${sound.name}${keywords ? ` [${keywords}]` : ''}`;
  });
  const sfxLines = sfx.map((sound) => sound.name);

  return `\nAVAILABLE MUSIC CANDIDATES (${musicLines.length} tracks - pick by exact name):\n${musicLines.join(' | ')}\n\nAVAILABLE SFX CANDIDATES (${sfxLines.length} sounds - pick by exact name):\n${sfxLines.join(' | ')}`;
}

function collectTerms(transcript, mode, context) {
  const textParts = [transcript, mode];
  if (context && typeof context === 'object') {
    textParts.push(
      context.sessionContext,
      context.newSpeech,
      context.storyTitle,
      context.singGenre,
    );
  }

  const text = String(textParts.filter(Boolean).join(' ')).toLowerCase();
  const terms = new Set();
  text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .forEach((term) => {
      addTerm(terms, term);
    });

  for (const expansion of PHRASE_EXPANSIONS) {
    if (expansion.pattern.test(text)) expansion.terms.forEach((term) => addTerm(terms, term));
  }

  return terms;
}

function addTerm(terms, term) {
  if (term.length < 3 || STOP_WORDS.has(term)) return;
  terms.add(term);

  for (const variant of deriveTermVariants(term)) {
    if (variant.length >= 3 && !STOP_WORDS.has(variant)) terms.add(variant);
  }

  for (const candidate of [term, ...deriveTermVariants(term)]) {
    const expansions = TERM_EXPANSIONS[candidate];
    if (expansions) expansions.forEach((expanded) => terms.add(expanded));
  }
}

function deriveTermVariants(term) {
  const variants = new Set();
  if (term.length > 4 && term.endsWith('ing')) variants.add(term.slice(0, -3));
  if (term.length > 4 && term.endsWith('ed')) variants.add(term.slice(0, -2));
  if (term.length > 4 && term.endsWith('es')) variants.add(term.slice(0, -2));
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) variants.add(term.slice(0, -1));
  return Array.from(variants);
}

// Scene tags mirror the CONTEXT_RULES in scripts/enrich-keywords.js so a sound
// tagged at runtime lands in the same buckets as the hand-curated catalog.
const SCENE_TAG_RULES = [
  { tag: 'tavern', match: /\b(tavern|inn|pub|bar)\b/ },
  { tag: 'city', match: /\b(city|market|bazaar|street|alley|marketplace)\b/ },
  { tag: 'dungeon', match: /\b(dungeon|crypt|tomb|underground|cave|cavern)\b/ },
  { tag: 'forest', match: /\b(forest|woodland|jungle|rainforest|meadow|grove|tree|trees)\b/ },
  { tag: 'mountain', match: /\b(mountain|peak|summit|cliff)\b/ },
  { tag: 'sea', match: /\b(sea|ocean|coast|harbor|docks|naval|pirate|ship|sailing|wave|waves)\b/ },
  { tag: 'desert', match: /\b(desert|sand|dunes|arabian|egyptian)\b/ },
  { tag: 'swamp', match: /\b(swamp|marsh|bayou|bog)\b/ },
  { tag: 'temple', match: /\b(temple|sacred|holy|shrine|cathedral|monastery)\b/ },
  { tag: 'castle', match: /\b(castle|fortress|keep|throne|royal|noble)\b/ },
  { tag: 'combat', match: /\b(battle|battlefield|war|siege|army|cavalry|sword|blade|arrow|cannon|gunshot|fight|duel)\b/ },
  { tag: 'creature', match: /\b(dragon|wolf|beast|monster|goblin|demon|spider|snake|bird|dog|horse)\b/ },
  { tag: 'magic', match: /\b(magic|arcane|spell|enchanted|mystical|ethereal|rune|portal)\b/ },
  { tag: 'weather', match: /\b(rain|storm|thunder|snow|wind|blizzard|weather|lightning)\b/ },
  { tag: 'fire', match: /\b(fire|flame|flames|burning|blaze|ember|embers|torch)\b/ },
  { tag: 'water', match: /\b(water|river|stream|splash|underwater|rain|waterfall)\b/ },
  { tag: 'space', match: /\b(space|cosmic|starship|alien|planet|spaceship|laser)\b/ },
  { tag: 'graveyard', match: /\b(graveyard|cemetery|crypt|undead|zombie|ghost)\b/ },
];

/**
 * Turn free text (a cue description, a sound name) into catalog keywords using
 * the same stopword list, stemming and expansions the search side already uses,
 * so runtime-tagged sounds are retrievable by the same queries as curated ones.
 */
export function buildKeywords(text, { type = 'sfx', max = 16 } = {}) {
  const clean = String(text || '').toLowerCase();
  const tags = new Set();

  for (const raw of clean.split(/[^a-z0-9']+/)) {
    const term = raw.replace(/^'+|'+$/g, '');
    if (term.length < 3 || STOP_WORDS.has(term)) continue;
    tags.add(term);

    // Singular form only. The -ing/-ed stems used for search-side recall turn
    // "revving" into "revv" and "biting" into "bit", which would match wrongly.
    // -ss/-is/-us/-as endings are not plurals (portcullis, chorus, glass).
    if (term.length > 3 && /[^siua]s$/.test(term)) {
      const singular = term.slice(0, -1);
      if (singular.length >= 3 && !STOP_WORDS.has(singular)) tags.add(singular);
    }

    const expansions = TERM_EXPANSIONS[term];
    if (expansions) expansions.forEach((e) => tags.add(e));
  }

  for (const rule of SCENE_TAG_RULES) {
    if (rule.match.test(clean)) tags.add(rule.tag);
  }
  if (type === 'ambience') tags.add('ambience');

  return Array.from(tags).slice(0, max);
}

function selectCandidates(files, terms, type, limit) {
  const family = type === 'music'
    ? (sound) => sound.type === 'music'
    : (sound) => sound.type !== 'music';

  const scored = files
    .filter(family)
    .map((sound, index) => ({ sound, index, score: scoreSound(sound, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const matches = scored.filter((item) => item.score > 0).slice(0, limit);
  return matches.map((item) => item.sound);
}

function scoreSound(sound, terms) {
  if (!terms.size) return 0;
  const name = String(sound.name || '').toLowerCase();
  const nameWords = new Set(name.split(/[^a-z0-9']+/).filter(Boolean));
  const keywords = new Set((sound.keywords || []).map((kw) => String(kw).toLowerCase()));
  const haystack = `${name} ${Array.from(keywords).join(' ')}`;
  const haystackWords = new Set(haystack.split(/[^a-z0-9']+/).filter(Boolean));
  let score = 0;

  for (const term of terms) {
    if (keywords.has(term)) score += 8;
    if (nameWords.has(term)) score += 6;
    else if (haystackWords.has(term)) score += 2;
    else if (term.length >= 6 && name.includes(term)) score += 3;
    else if (term.length >= 6 && haystack.includes(term)) score += 1;
  }

  if (sound.type === 'ambience' && (terms.has('rain') || terms.has('storm') || terms.has('forest') || terms.has('tavern'))) {
    score += 4;
  }

  return score;
}
