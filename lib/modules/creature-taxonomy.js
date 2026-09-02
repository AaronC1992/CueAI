/**
 * Canonical noun-equivalence groups for animal/creature sound gating.
 *
 * Single source of truth for "these words refer to the same sound source"
 * so the fact doesn't quietly drift out of sync between the places that
 * need it — today that's the instant-keyword context gates
 * (lib/modules/trigger-system.js) and the engine's transcript synonym
 * expansion (engine/SuiteRhythm.js `_synonymGroups`). Add a word once,
 * here, and both consumers see it.
 *
 * This intentionally does NOT try to unify every keyword taxonomy in the
 * app (tfidfMatch's relatedness synonyms and server-catalog's AI-candidate
 * term expansions serve a different purpose — fuzzy relevance boosting,
 * not "is this actually the same noun" gating — and merging those carries
 * real regression risk for comparatively little benefit).
 */

export const WOLF_NOUNS = ['wolf', 'wolves', 'hound', 'hounds', 'warg', 'coyote', 'coyotes'];
export const DOG_NOUNS = ['dog', 'dogs', 'hound', 'hounds', 'puppy', 'puppies'];
export const CAT_NOUNS = ['cat', 'cats', 'kitten', 'kittens'];
export const SNAKE_NOUNS = ['snake', 'snakes', 'serpent', 'serpents'];
// Generic monster/creature cluster used for growl/snarl/roar gating —
// deliberately separate from the engine's narrower "dragon" synonym group
// (drake/wyrm/wyvern) so merging this doesn't change existing dragon-cue
// synonym expansion behavior.
export const CREATURE_NOUNS = [
    'monster', 'monsters', 'beast', 'beasts', 'creature', 'creatures',
    'demon', 'demons', 'troll', 'trolls', 'orc', 'orcs', 'goblin', 'goblins',
    'zombie', 'zombies', 'werewolf', 'werewolves', 'ogre', 'ogres',
    'bear', 'bears', 'lion', 'lions', 'tiger', 'tigers', 'dragon', 'dragons',
];

/**
 * Build a bidirectional "noun near verb" regex, e.g.
 *   buildNounVerbGate(WOLF_NOUNS, 'howl(?:s|ed|ing)?')
 * matches "the wolf howled" and "howling wolves" but not a bare "howled".
 */
export function buildNounVerbGate(nouns, verbPattern, gapChars = 40) {
    const nounAlt = nouns.join('|');
    return new RegExp(
        `\\b(?:${nounAlt})\\b.{0,${gapChars}}\\b(?:${verbPattern})\\b|\\b(?:${verbPattern})\\b.{0,${gapChars}}\\b(?:${nounAlt})\\b`,
        'i'
    );
}
