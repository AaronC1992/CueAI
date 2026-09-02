import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('tutorial content', () => {
  it('keeps the full tutorial page organized by feature areas', () => {
    const source = readProjectFile('app/tutorial/page.jsx');

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
      'Audio Engine',
      'Sound Audit',
    ]) {
      expect(source).toContain(topic);
    }
  });

  it('documents the recorder mixer options', () => {
    const source = readProjectFile('app/tutorial/page.jsx');

    expect(source).toContain('Voice effects include clean, warm, bright, radio, monster, and whisper');
    expect(source).toContain('Input gain changes the microphone level before saving');
    expect(source).toContain('Noise gate reduces quiet room noise');
  });

  it('links the sidebar tutorial action to the page instead of a modal', () => {
    const sidebarSource = readProjectFile('components/Sidebar.jsx');
    const appShellSource = readProjectFile('components/AppShell.jsx');

    expect(sidebarSource).toContain('href="/tutorial"');
    expect(sidebarSource).not.toContain('id="tutorialBtn"');
    expect(appShellSource).not.toContain('TutorialModal');
  });
});
