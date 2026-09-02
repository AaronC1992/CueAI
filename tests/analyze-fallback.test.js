import { describe, expect, it } from 'vitest';
import { buildFallbackDecision } from '../app/api/analyze/route.js';
import { classifyLocal } from '../lib/modules/local-classifier.js';

describe('analyze fallback precision', () => {
  it('keeps automatic SFX silent when AI analysis fails', () => {
    const local = classifyLocal('A sudden knock rattled the door.');
    const fallback = buildFallbackDecision(local, new Error('upstream unavailable'));

    expect(local.sfx).not.toEqual([]);
    expect(fallback.sfx).toEqual([]);
    expect(fallback.confidence).toBeLessThanOrEqual(0.35);
  });
});