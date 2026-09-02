import { describe, expect, it } from 'vitest';
import {
  getR2AudioBase,
  isSavedSoundsPath,
  joinAudioUrlBase,
  normalizeAudioUrl,
} from '../lib/modules/audio-url.js';

describe('audio-url helpers', () => {
  it('encodes raw saved-sound paths once', () => {
    expect(normalizeAudioUrl('sounds/car horn.mp3')).toBe('sounds/car%20horn.mp3');
  });

  it('keeps already encoded saved-sound paths idempotent', () => {
    expect(normalizeAudioUrl('sounds/car%20horn.mp3')).toBe('sounds/car%20horn.mp3');
  });

  it('repairs double-encoded saved-sound paths', () => {
    expect(normalizeAudioUrl('Saved%2520sounds/ES_Hardwood,%2520Boots.mp3')).toBe(
      'sounds/ES_Hardwood%2C%20Boots.mp3',
    );
  });

  it('preserves query strings on absolute URLs', () => {
    expect(normalizeAudioUrl('https://cdn.example.com/Saved%2520sounds/a%2520b.mp3?sig=a%2Fb')).toBe(
      'https://cdn.example.com/sounds/a%20b.mp3?sig=a%2Fb',
    );
  });

  it('joins the R2 proxy without double-encoding path segments', () => {
    expect(joinAudioUrlBase('/r2-audio', 'Saved%2520sounds/footsteps_daytime_hike.mp3')).toBe(
      '/r2-audio/sounds/footsteps_daytime_hike.mp3',
    );
  });

  it('defaults client audio to the R2 proxy path', () => {
    expect(getR2AudioBase()).toBe('/r2-audio');
  });

  it('prefers a runtime override over the configured base', () => {
    const previous = globalThis.window;
    globalThis.window = { __R2_PUBLIC_URL: 'https://cdn.example.com' };
    try {
      expect(getR2AudioBase()).toBe('https://cdn.example.com');
    } finally {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    }
  });

  it('does not duplicate the R2 proxy prefix when joining', () => {
    expect(joinAudioUrlBase('/r2-audio', '/r2-audio/sounds/glass-shatter.mp3')).toBe(
      '/r2-audio/sounds/glass-shatter.mp3',
    );
  });

  it('recognizes saved sound paths with or without the R2 proxy prefix', () => {
    expect(isSavedSoundsPath('sounds/door-creak.mp3')).toBe(true);
    expect(isSavedSoundsPath('/r2-audio/sounds/door-creak.mp3')).toBe(true);
  });
});
