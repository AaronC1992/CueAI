import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('settings menu wiring', () => {
  it('uses generic accordion wiring for all settings menu toggles', () => {
    const engineSource = readProjectFile('engine/SuiteRhythm.js');

    expect(engineSource).toContain("document.querySelectorAll('.menu-toggle')");
    expect(engineSource).toContain("toggle.dataset.menuToggleBound");
  });

  it('keeps every settings menu toggle next to a menu content panel', () => {
    const settingsSource = readProjectFile('components/sections/SettingsSection.jsx');
    const toggleIds = [...settingsSource.matchAll(/<button className="menu-toggle" id="([^"]+)"/g)]
      .map(([, toggleId]) => toggleId);
    const pairs = [...settingsSource.matchAll(
      /<button className="menu-toggle" id="([^"]+)"[\s\S]*?<\/button>\s*<div className="menu-content(?: hidden)?" id="([^"]+)"/g
    )].map(([, toggleId, contentId]) => ({ toggleId, contentId }));

    expect(toggleIds.length).toBeGreaterThan(0);
    expect(pairs.map((pair) => pair.toggleId)).toEqual(toggleIds);

    expect(pairs.map((pair) => pair.toggleId)).not.toContain('subscriptionMenuToggle');
  });
});