import { describe, expect, it } from 'vitest';
import {
  CUE_MAP_VERSION,
  buildFallbackTranscript,
  buildStudioCueMap,
  getCueRenderTime,
  getRenderableCues,
  migrateCueMap,
  validateCueMap,
} from '../lib/studio/cue-map.js';

describe('studio cue map', () => {
  it('builds a renderer-ready cue map with stable timing', () => {
    const cueMap = buildStudioCueMap({
      media: { name: 'scene.mp4', kind: 'video', duration: 12, file: { type: 'video/mp4', size: 1024 } },
      transcriptText: 'A door opens',
      transcriptItems: [{ id: 'word-1', text: 'door', start: 1, end: 1.4, type: 'word' }],
      cues: [{
        id: 'cue-1',
        phrase: 'door',
        label: 'Door creak',
        startTime: 1,
        endTime: 1.4,
        offset: -0.25,
        cueType: 'sound effect',
        soundSrc: 'sounds/door-creak.mp3',
        volume: 0.8,
        duration: 2.5,
        trimStart: 0.4,
        repeatMode: 'loop',
        playbackRate: 1.25,
      }],
      savedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(cueMap.version).toBe(CUE_MAP_VERSION);
    expect(cueMap.media.kind).toBe('video');
    expect(cueMap.cues[0].renderTime).toBe(0.75);
    expect(cueMap.cues[0].duration).toBe(2.5);
    expect(cueMap.cues[0].trimStart).toBe(0.4);
    expect(cueMap.cues[0].repeatMode).toBe('loop');
    expect(cueMap.cues[0].playbackRate).toBe(1.25);
    expect(validateCueMap(cueMap, { requireCues: true }).valid).toBe(true);
    expect(getRenderableCues(cueMap)).toHaveLength(1);
  });

  it('migrates the original Studio Mode cue map shape', () => {
    const migrated = migrateCueMap({
      version: 1,
      mediaName: 'track.wav',
      mediaKind: 'audio',
      mediaDuration: 8,
      transcriptText: 'Thunder rolls',
      transcriptItems: [{ id: 'manual-0', text: 'Thunder', start: 0, end: 0.5, type: 'word' }],
      cues: [{
        id: 'cue-old',
        phrase: 'Thunder',
        startTime: 0,
        cueType: 'ambience',
        soundSrc: 'sounds/thunder.mp3',
      }],
      savedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(migrated.version).toBe(CUE_MAP_VERSION);
    expect(migrated.media.name).toBe('track.wav');
    expect(migrated.transcript.text).toBe('Thunder rolls');
    expect(migrated.cues[0].renderable).toBe(true);
  });

  it('flags invalid renderable cues', () => {
    const cueMap = buildStudioCueMap({
      media: { name: 'track.wav', kind: 'audio', duration: 3 },
      cues: [{ id: 'cue-1', phrase: 'hit', startTime: 1, cueType: 'sound effect', soundSrc: '', volume: 2 }],
    });

    const validation = validateCueMap(cueMap, { requireCues: true });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('missing a renderable sound source');
  });

  it('shares fallback transcript and cue timing helpers with the UI', () => {
    const words = buildFallbackTranscript('Hello there.', 2);

    expect(words).toHaveLength(3);
    expect(words[0].start).toBe(0);
    expect(getCueRenderTime({ startTime: words[1].start, offset: -10 })).toBe(0);
  });

  it('preserves muted cue volume during normalization', () => {
    const cueMap = buildStudioCueMap({
      media: { name: 'track.wav', kind: 'audio', duration: 3 },
      cues: [{ id: 'cue-1', phrase: 'hit', startTime: 1, cueType: 'sound effect', soundSrc: 'hit.wav', volume: 0 }],
    });

    expect(cueMap.cues[0].volume).toBe(0);
  });
});