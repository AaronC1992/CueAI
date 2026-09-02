import { describe, expect, it } from 'vitest';
import { buildTriggerMap, rankInstantPreloadFiles } from '../lib/modules/trigger-system.js';

const triggerMap = buildTriggerMap({ files: [] });

describe('instant preload ranking', () => {
  it('ranks files by how many keywords they answer', () => {
    const ranked = rankInstantPreloadFiles({
      a: { file: 'one.mp3', category: 'misc' },
      b: { file: 'two.mp3', category: 'misc' },
      c: { file: 'two.mp3', category: 'misc' },
      d: { file: 'three.mp3', category: 'misc' },
      e: { file: 'three.mp3', category: 'misc' },
      f: { file: 'three.mp3', category: 'misc' },
    });

    expect(ranked.map((r) => r.file)).toEqual(['three.mp3', 'two.mp3', 'one.mp3']);
    expect(ranked[0].keywordCount).toBe(3);
  });

  it('breaks ties on category priority', () => {
    const ranked = rankInstantPreloadFiles({
      a: { file: 'christmas.mp3', category: 'christmas' },
      b: { file: 'sword.mp3', category: 'combat' },
    });

    expect(ranked[0].file).toBe('sword.mp3');
  });

  it('ignores keywords with no direct file', () => {
    const ranked = rankInstantPreloadFiles({
      a: { query: 'thunder' },
      b: { file: 'one.mp3', category: 'weather' },
    });

    expect(ranked).toHaveLength(1);
  });

  it('spreads the real trigger map across more than two categories', () => {
    // Regression: the previous category-only sort filled the whole budget with
    // combat + creature, leaving animal/weather/door at zero coverage.
    const top30 = rankInstantPreloadFiles(triggerMap).slice(0, 30);
    const categories = new Set(top30.map((r) => r.category));

    expect(top30).toHaveLength(30);
    expect(categories.size).toBeGreaterThan(2);
  });

  it('covers materially more keywords than a category-only ordering', () => {
    const ranked = rankInstantPreloadFiles(triggerMap);
    const covered = ranked.slice(0, 30).reduce((sum, r) => sum + r.keywordCount, 0);

    expect(covered).toBeGreaterThan(120);
  });

  it('prefers cheaper files when two candidates cover a similar number of keywords', () => {
    const ranked = rankInstantPreloadFiles({
      heavyA: { file: 'Saved sounds/gigantic-ambience.flac', category: 'weather', estimatedBytes: 5 * 1024 * 1024 },
      heavyB: { file: 'Saved sounds/gigantic-ambience.flac', category: 'weather', estimatedBytes: 5 * 1024 * 1024 },
      heavyC: { file: 'Saved sounds/gigantic-ambience.flac', category: 'weather', estimatedBytes: 5 * 1024 * 1024 },
      heavyD: { file: 'Saved sounds/gigantic-ambience.flac', category: 'weather', estimatedBytes: 5 * 1024 * 1024 },
      quickA: { file: 'Saved sounds/quick-hit.mp3', category: 'combat', estimatedBytes: 180 * 1024 },
      quickB: { file: 'Saved sounds/quick-hit.mp3', category: 'combat', estimatedBytes: 180 * 1024 },
    });

    expect(ranked[0].file).toBe('Saved sounds/quick-hit.mp3');
    expect(ranked[0].keywordCount).toBeGreaterThanOrEqual(2);
    expect(ranked[0].estimatedBytes).toBeLessThan(5 * 1024 * 1024);
  });
});
