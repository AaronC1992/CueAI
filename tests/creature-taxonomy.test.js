import { describe, it, expect } from 'vitest';
import { WOLF_NOUNS, DOG_NOUNS, buildNounVerbGate } from '../lib/modules/creature-taxonomy.js';

describe('creature-taxonomy', () => {
    it('builds a gate that matches noun-before-verb and verb-before-noun', () => {
        const gate = buildNounVerbGate(WOLF_NOUNS, 'howl(?:s|ed|ing)?');
        expect(gate.test('the wolf howled in the distance')).toBe(true);
        expect(gate.test('a distant howl from the wolves')).toBe(true);
    });

    it('does not match the verb without a qualifying noun nearby', () => {
        const gate = buildNounVerbGate(WOLF_NOUNS, 'howl(?:s|ed|ing)?');
        expect(gate.test('the wind howled through the trees')).toBe(false);
    });

    it('respects the gap distance between noun and verb', () => {
        const gate = buildNounVerbGate(DOG_NOUNS, 'bark(?:s|ed|ing)?', 10);
        expect(gate.test('the dog barked')).toBe(true);
        expect(gate.test('the dog that lived next door for many years finally barked')).toBe(false);
    });
});
