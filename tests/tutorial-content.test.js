import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('tutorial content', () => {
  it('keeps the main menu tutorial organized by feature areas', () => {
    const source = readProjectFile('components/modals/Modals.jsx');

    for (const topic of [
      'Start Here',
      'Modes',
      'Sound Library',
      'Control Board',
      'Voice Recorder',
      'Creator Studio',
      'OBS',
      'Settings',
      'Trouble Shooting',
    ]) {
      expect(source).toContain(topic);
    }
  });

  it('documents the recorder mixer options', () => {
    const source = readProjectFile('components/modals/Modals.jsx');

    expect(source).toContain('Clean, warm, bright, radio, monster, and whisper change the captured signal');
    expect(source).toContain('Input gain boosts or lowers the mic');
    expect(source).toContain('Noise gate removes quiet room noise');
  });
});
