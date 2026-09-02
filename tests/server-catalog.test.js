import { describe, it, expect } from 'vitest';
import { buildCatalogSummary, getStaticSoundsForApi, getStaticStoriesForApi } from '../lib/server-catalog.js';

describe('server-catalog', () => {
    it('loads normalized static sounds and stories', () => {
        const sounds = getStaticSoundsForApi();
        const stories = getStaticStoriesForApi();

        expect(sounds.length).toBeGreaterThan(0);
        expect(sounds[0]).toHaveProperty('file');
        expect(sounds[0]).toHaveProperty('keywords');
        expect(stories.length).toBeGreaterThan(0);
        expect(stories[0]).toHaveProperty('text');
    });

    it('builds a bounded candidate list instead of the full catalog', () => {
        const summary = buildCatalogSummary({
            transcript: 'The party enters a rainy tavern before a stormy battle',
            mode: 'dnd',
        });
        const musicList = summary.match(/AVAILABLE MUSIC CANDIDATES \(\d+ tracks[^\n]*\):\n([^\n]*)/)?.[1] || '';
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';

        expect(musicList.split(' | ').filter(Boolean).length).toBeLessThanOrEqual(30);
        expect(sfxList.split(' | ').filter(Boolean).length).toBeLessThanOrEqual(70);
        expect(summary.length).toBeLessThan(12000);
    });

    it('does not pad weak object-action matches with unrelated ambience', () => {
        const summary = buildCatalogSummary({
            transcript: 'he pulls a chair up to a table and unfolds a newspaper',
            mode: 'auto',
        });
        const musicList = summary.match(/AVAILABLE MUSIC CANDIDATES \(\d+ tracks[^\n]*\):\n([^\n]*)/)?.[1] || '';
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';

        expect(musicList).toBe('');
        expect(sfxList).toContain('newspaper unfolding pages');
        expect(sfxList).toContain('chair scrape wooden floor');
        expect(sfxList).toContain('scroll unfurling open');
        expect(sfxList).not.toContain('bird whistling chirping');
        expect(sfxList).not.toContain('footsteps leaves');
        expect(sfxList).not.toContain('eerie forest ambience');
    });

    it('does not let recent wrong sounds seed the next candidate list', () => {
        const summary = buildCatalogSummary({
            transcript: 'he pulls a chair up to a table and unfolds a newspaper',
            mode: 'auto',
            context: {
                sceneState: 'forest clearing',
                sceneMemory: 'forest ambience with birds',
                recentSounds: ['forest ambience daytime', 'bird whistling chirping', 'footsteps leaves'],
            },
        });
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';

        expect(sfxList).toContain('scroll unfurling open');
        expect(sfxList).toContain('newspaper unfolding pages');
        expect(sfxList).not.toContain('bird whistling chirping');
        expect(sfxList).not.toContain('footsteps leaves');
        expect(sfxList).not.toContain('forest ambience daytime');
    });

    it('does not produce SFX candidates from context when fresh narration has no event evidence', () => {
        const summary = buildCatalogSummary({
            transcript: 'The narrator pauses for a moment.',
            mode: 'dnd',
            context: {
                sessionContext: 'A stormy forest battle with wolves and thunder',
                storyTitle: 'The Howling Forest',
            },
        });
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';

        expect(sfxList).toBe('');
    });

    it('surfaces exact new Foley for chair movement and inflected actions', () => {
        const summary = buildCatalogSummary({
            transcript: 'he pulls a chair up to a table',
            mode: 'auto',
        });
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';
        const candidates = sfxList.split(' | ').filter(Boolean);

        expect(candidates[0]).toBe('chair scrape wooden floor');
        expect(sfxList).toContain('chair bump table');
    });

    it('maps common tabletop inflections to the exact generated cues', () => {
        const summary = buildCatalogSummary({
            transcript: 'the pressure plate trap clicks and he draws his sword then blocks with a shield',
            mode: 'dnd',
        });
        const sfxList = summary.match(/AVAILABLE SFX CANDIDATES \(\d+ sounds[^\n]*\):\n([^\n]*)/)?.[1] || '';

        expect(sfxList).toContain('pressure plate trap click');
        expect(sfxList).toContain('sword draw clash combo');
        expect(sfxList).toContain('shield block heavy impact');
    });
});
