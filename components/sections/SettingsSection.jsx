'use client';

import { useEffect, useMemo, useState } from 'react';

import { CONFIG } from '../../lib/config.js';
import SectionBackButton from '../SectionBackButton';

const LOOK_PRESETS = [
  {
    value: 'classic',
    name: 'Classic Console',
    description: 'Current SuiteRhythm layout with a sharper red/orange pulse.',
    previewClass: 'look-preview-classic',
    theme: 'dark',
    palette: 'crimson-circuit',
  },
  {
    value: 'studio-console',
    name: 'Studio Console',
    description: 'Dense production desk, compact panels, cool meters.',
    previewClass: 'look-preview-studio',
    theme: 'dark',
    palette: 'arctic-minimal',
  },
  {
    value: 'broadcast-neon',
    name: 'Broadcast Neon',
    description: 'Horizontal show-control layout built for stream setups.',
    previewClass: 'look-preview-broadcast',
    theme: 'dark',
    palette: 'neon-pink',
  },
  {
    value: 'story-paper',
    name: 'Story Paper',
    description: 'Readable writers desk with soft surfaces and editorial spacing.',
    previewClass: 'look-preview-paper',
    theme: 'light',
    palette: 'rose-gold',
  },
  {
    value: 'control-deck',
    name: 'Control Deck',
    description: 'Compact left rail and tighter tool panels for fast triggering.',
    previewClass: 'look-preview-deck',
    theme: 'dark',
    palette: 'amber-dusk',
  },
  {
    value: 'cinema-wide',
    name: 'Cinema Wide',
    description: 'Roomy cinematic composition for demos and live sessions.',
    previewClass: 'look-preview-cinema',
    theme: 'dark',
    palette: 'sunset-funk',
  },
];

const PALETTE_NAMES = {
  '': 'Deep Violet',
  'midnight-ocean': 'Midnight Ocean',
  'crimson-circuit': 'Crimson Circuit',
  'forest-synth': 'Forest Synth',
  'rose-gold': 'Rose Gold',
  'arctic-minimal': 'Arctic Minimal',
  'sunset-funk': 'Sunset Funk',
  'pastel-vaporwave': 'Pastel Vaporwave',
  'monochrome-pro': 'Monochrome Pro',
  'toxic-goblin': 'Toxic Goblin',
  'neon-pink': 'Neon Pink',
  'deep-space': 'Deep Space',
  'matrix': 'Matrix',
  'cobalt-storm': 'Cobalt Storm',
  'amber-dusk': 'Amber Dusk',
  'neon-arcade': 'Neon Arcade',
};

/** Settings section — volume, playback options, scene presets, custom triggers. */
export default function SettingsSection() {
  const [activeLook, setActiveLook] = useState('classic');
  const activeLookName = useMemo(
    () => LOOK_PRESETS.find((preset) => preset.value === activeLook)?.name ?? 'Classic Console',
    [activeLook]
  );

  useEffect(() => {
    setActiveLook(localStorage.getItem('SuiteRhythm_look') || 'classic');
  }, []);

  function applyLookPreset(preset) {
    const root = document.documentElement;
    root.setAttribute('data-look', preset.value);
    root.setAttribute('data-theme', preset.theme);
    if (preset.palette) root.setAttribute('data-color-palette', preset.palette);
    else root.removeAttribute('data-color-palette');

    localStorage.setItem('SuiteRhythm_look', preset.value);
    localStorage.setItem('SuiteRhythm_theme', preset.theme);
    localStorage.setItem('SuiteRhythm_palette', preset.palette);

    document.querySelectorAll('.theme-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.themeValue === preset.theme);
    });
    document.querySelectorAll('.palette-swatch').forEach((swatch) => {
      swatch.classList.toggle('active', (swatch.dataset.paletteValue ?? '') === preset.palette);
    });
    const paletteName = document.getElementById('paletteName');
    if (paletteName) paletteName.textContent = PALETTE_NAMES[preset.palette] ?? 'Deep Violet';

    setActiveLook(preset.value);
  }

  return (
    <div id="settingsSection" className="app-section hidden">
      <div className="section-header">
        <SectionBackButton />
        <h2>Settings</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">Adjust volume, playback options, and performance settings.</p>
        <p id="settingsAppVersion" className="info-text" style={{ marginTop: -6, marginBottom: 16 }}>
          Game Version: v{CONFIG.VERSION}
        </p>

        {/* Appearance / Theme */}
        <section className="menu-section">
          <button className="menu-toggle active" id="appearanceMenuToggle">
            Appearance
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content" id="appearanceMenuContent">
            <h3>Look Presets</h3>
            <div className="look-picker" id="lookPicker">
              {LOOK_PRESETS.map((preset) => (
                <button
                  className={`look-card${activeLook === preset.value ? ' active' : ''}`}
                  data-look-value={preset.value}
                  data-look-theme={preset.theme}
                  data-look-palette={preset.palette}
                  key={preset.value}
                  onClick={() => applyLookPreset(preset)}
                  type="button"
                >
                  <div className={`look-preview ${preset.previewClass}`}><span /><span /><span /></div>
                  <div className="look-card-copy">
                    <strong>{preset.name}</strong>
                    <span>{preset.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="look-label" id="lookName">{activeLookName}</div>

            <h3>Theme</h3>
            <div className="theme-picker" id="themePicker">
              <button className="theme-card active" data-theme-value="dark" type="button">
                <div className="theme-card-preview dark-preview" />
                <div className="theme-card-label">Dark</div>
              </button>
              <button className="theme-card" data-theme-value="light" type="button">
                <div className="theme-card-preview light-preview" />
                <div className="theme-card-label">Light</div>
              </button>
            </div>

            <h3 style={{ marginTop: 20 }}>Color Palette</h3>
            <div className="palette-picker" id="palettePicker">
              <button className="palette-swatch"        data-palette-value=""          type="button" title="Deep Violet"    style={{ '--swatch-a': '#8a2be2', '--swatch-b': '#03dac6' }} />
              <button className="palette-swatch"        data-palette-value="midnight-ocean"    type="button" title="Midnight Ocean"  style={{ '--swatch-a': '#1565c0', '--swatch-b': '#00acc1' }} />
              <button className="palette-swatch active" data-palette-value="crimson-circuit"   type="button" title="Crimson Circuit" style={{ '--swatch-a': '#b71c1c', '--swatch-b': '#ff8f00' }} />
              <button className="palette-swatch"        data-palette-value="forest-synth"      type="button" title="Forest Synth"   style={{ '--swatch-a': '#2e7d32', '--swatch-b': '#b2ff59' }} />
              <button className="palette-swatch"        data-palette-value="rose-gold"         type="button" title="Rose Gold"      style={{ '--swatch-a': '#ad1457', '--swatch-b': '#ffb300' }} />
              <button className="palette-swatch"        data-palette-value="arctic-minimal"    type="button" title="Arctic Minimal" style={{ '--swatch-a': '#0277bd', '--swatch-b': '#00bcd4' }} />
              <button className="palette-swatch"        data-palette-value="sunset-funk"       type="button" title="Sunset Funk"    style={{ '--swatch-a': '#e65100', '--swatch-b': '#ffd600' }} />
              <button className="palette-swatch"        data-palette-value="pastel-vaporwave"  type="button" title="Pastel Vaporwave" style={{ '--swatch-a': '#8e24aa', '--swatch-b': '#80deea' }} />
              <button className="palette-swatch"        data-palette-value="monochrome-pro"    type="button" title="Monochrome Pro" style={{ '--swatch-a': '#424242', '--swatch-b': '#bdbdbd' }} />
              <button className="palette-swatch"        data-palette-value="toxic-goblin"      type="button" title="Toxic Goblin"   style={{ '--swatch-a': '#6200ea', '--swatch-b': '#76ff03' }} />
              <button className="palette-swatch"        data-palette-value="neon-pink"         type="button" title="Neon Pink"      style={{ '--swatch-a': '#e91e63', '--swatch-b': '#00e5ff' }} />
              <button className="palette-swatch"        data-palette-value="deep-space"        type="button" title="Deep Space"     style={{ '--swatch-a': '#1a237e', '--swatch-b': '#ffd740' }} />
              <button className="palette-swatch"        data-palette-value="matrix"            type="button" title="Matrix"         style={{ '--swatch-a': '#1b5e20', '--swatch-b': '#00e676' }} />
              <button className="palette-swatch"        data-palette-value="cobalt-storm"      type="button" title="Cobalt Storm"   style={{ '--swatch-a': '#283593', '--swatch-b': '#cfd8dc' }} />
              <button className="palette-swatch"        data-palette-value="amber-dusk"        type="button" title="Amber Dusk"     style={{ '--swatch-a': '#f57f17', '--swatch-b': '#00838f' }} />
              <button className="palette-swatch"        data-palette-value="neon-arcade"       type="button" title="Neon Arcade"    style={{ '--swatch-a': '#00b0ff', '--swatch-b': '#ff6d00' }} />
            </div>
            <div className="palette-label" id="paletteName">Crimson Circuit</div>
          </div>
        </section>

        {/* Audio Source (Pixabay) */}
        <section className="menu-section">
          <button className="menu-toggle" id="audioSourceMenuToggle">
            Audio Source
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="audioSourceMenuContent">
            <p className="info-text" style={{ marginBottom: 8 }}>
              SuiteRhythm uses the built in library first. If a server side Pixabay key is configured,
              the app can also search Pixabay without exposing the key in your browser.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button id="saveAudioKeys" className="btn-secondary">Check Pixabay Proxy</button>
            </div>
            <div id="pixabayKeyStatus" className="info-text" style={{ marginTop: 6, fontSize: '0.8rem' }}>
              Built in library available. Pixabay proxy not checked yet.
            </div>
          </div>
        </section>

        {/* Volume Control */}
        <section className="menu-section">
          <button className="menu-toggle" id="volumeMenuToggle">
            Volume Control
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="volumeMenuContent">
            <h3>Volume Range</h3>
            <div className="slider-container">
              <label>Minimum: <span id="minVolumeValue">20</span>%</label>
              <input type="range" id="minVolume" min="0" max="100" defaultValue="20" />
            </div>
            <div className="slider-container">
              <label>Maximum: <span id="maxVolumeValue">70</span>%</label>
              <input type="range" id="maxVolume" min="0" max="100" defaultValue="70" />
            </div>
            <h3 style={{ marginTop: 20 }}>Mixer</h3>
            <div className="slider-container">
              <label>Music Level: <span id="musicLevelValue">50</span>%</label>
              <input type="range" id="musicLevel" min="0" max="100" defaultValue="50" />
            </div>
            <div className="slider-container">
              <label>Sound Effects Level: <span id="sfxLevelValue">90</span>%</label>
              <input type="range" id="sfxLevel" min="0" max="100" defaultValue="90" />
            </div>
            <button id="testSoundBtn" className="btn-secondary" style={{ marginTop: 8, width: '100%', fontSize: '0.85rem' }}>
              Test Sound
            </button>
            <h3 style={{ marginTop: 20 }}>Mood</h3>
            <div className="slider-container">
              <label>Mood/Intensity: <span id="moodBiasValue">50</span>%</label>
              <input type="range" id="moodBias" min="0" max="100" defaultValue="50" />
            </div>
          </div>
        </section>

        {/* Playback Options */}
        <section className="menu-section">
          <button className="menu-toggle" id="settingsMenuToggle">
            Settings
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="settingsMenuContent">
            <h3>Playback Options</h3>
            <div className="toggle-row">
              <label htmlFor="toggleMusic">Music</label>
              <label className="toggle-switch">
                <input type="checkbox" id="toggleMusic" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="toggleSfx">Sound Effects</label>
              <label className="toggle-switch">
                <input type="checkbox" id="toggleSfx" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="togglePrediction">Auto Scene Detection</label>
              <label className="toggle-switch">
                <input type="checkbox" id="togglePrediction" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="automaticAtmosphereToggle">Automatic Atmosphere</label>
              <label className="toggle-switch">
                <input type="checkbox" id="automaticAtmosphereToggle" />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="info-text" style={{ marginTop: -4, marginBottom: 12 }}>
              Add ambient beds and occasional accent sounds between spoken events. Disabled by default for precision.
            </p>

            <h3 style={{ marginTop: 20 }}>Creator Tools</h3>
            <div className="toggle-row">
              <label htmlFor="voiceDuckToggle">Voice Ducking</label>
              <label className="toggle-switch">
                <input type="checkbox" id="voiceDuckToggle" />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="info-text" style={{ marginTop: -4, marginBottom: 12 }}>
              Automatically lower music &amp; ambience when your voice is detected, then restore during pauses.
            </p>
            <div className="toggle-row">
              <label htmlFor="creatorModeToggle">Live Streamer Mode</label>
              <label className="toggle-switch">
                <input type="checkbox" id="creatorModeToggle" />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="info-text" style={{ marginTop: -4, marginBottom: 12 }}>
              Shorter cooldowns and snappier SFX triggering for live streams. Leave off for story narration.
            </p>

            <h3 style={{ marginTop: 20 }}>Performance</h3>
            <div className="toggle-row">
              <label
                htmlFor="lowLatencyMode"
                id="lowLatencyTooltip"
                className="tooltip"
                aria-describedby="lowLatencyTip"
              >
                Low Latency Mode
                <button
                  type="button"
                  id="lowLatencyHelp"
                  className="tooltip-icon"
                  aria-label="What is Low Latency Mode?"
                  aria-describedby="lowLatencyTip"
                >
                  ?
                </button>
                <span id="lowLatencyTip" role="tooltip" className="tooltip-content">
                  Preloads more sounds in parallel for faster reactions. Best on strong networks.
                </span>
              </label>
              <label className="toggle-switch">
                <input type="checkbox" id="lowLatencyMode" />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>

        {/* Trigger Cooldown */}
        <section className="menu-section">
          <button className="menu-toggle" id="triggerCooldownToggle">
            Trigger Cooldown
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="triggerCooldownContent">
            <p className="info-text">
              How long to wait before the same keyword can trigger a sound again. Lower = more
              responsive, Higher = less repetitive.
            </p>
            <div className="slider-container">
              <label>Cooldown: <span id="keywordCooldownValue">3</span>s</label>
              <input type="range" id="keywordCooldown" min="1" max="30" step="1" defaultValue="3" />
            </div>
          </div>
        </section>

        {/* Scene Presets */}
        <section className="menu-section">
          <button className="menu-toggle" id="scenePresetsToggle">
            Scene Presets
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="scenePresetsContent">
            <p className="info-text">
              Quick switch scene buttons shown in Auto Detect. Click a preset to instantly set the
              mood and context. Double click a preset name above to rename it.
            </p>
            <div id="scenePresetsList" />
            <button id="addScenePresetBtn" className="btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: '0.85rem' }}>
              Add Preset
            </button>
          </div>
        </section>

        {/* Custom Phrase Triggers */}
        <section className="menu-section">
          <button className="menu-toggle" id="customPhrasesToggle">
            Custom Phrase Triggers
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="customPhrasesContent">
            <p className="info-text">
              Add phrases that trigger a specific sound when spoken aloud. The phrase is matched as
              a substring, multiple variants can share one sound.
            </p>
            <div id="customPhrasesList" />
            <div
              className="custom-phrase-add-row"
              style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
            >
              <input
                id="customPhraseInput"
                type="text"
                placeholder='e.g. "draws his blade"'
                style={{ flex: 2, minWidth: 120 }}
              />
              <input
                id="customPhraseQuery"
                type="text"
                placeholder="Sound query, e.g. sword draw"
                style={{ flex: 2, minWidth: 120 }}
              />
              <input
                id="customPhraseVolume"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0.8"
                style={{ flex: '0 0 auto', minWidth: 55 }}
              />
              <button id="addCustomPhraseBtn" className="btn-secondary" style={{ flex: '0 0 auto' }}>
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Bedtime Timer */}
        <section className="menu-section">
          <button className="menu-toggle" id="bedtimeMenuToggle">
            Bedtime Timer
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="bedtimeMenuContent">
            <p className="info-text">
              Automatically fade out all audio after a set time. The master volume fades over the
              final 60 seconds, then stops all audio.
            </p>
            <div className="slider-container">
              <label htmlFor="bedtimeTimerSelect">Fade out after:</label>
              <select id="bedtimeTimerSelect" defaultValue="0">
                <option value="0">Off</option>
                <option value="5">5 min</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>
        </section>

        {/* Session Recording */}
        <section className="menu-section">
          <button className="menu-toggle" id="sessionRecMenuToggle">
            Session Recording
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="sessionRecMenuContent">
            <p className="info-text">
              Record everything, all sounds, music, and ambience, into a single downloadable audio file.
            </p>
            <div className="session-rec-controls">
              <button id="recStartBtn" className="btn-primary">Record Session</button>
              <button id="recStopBtn" className="btn-stop hidden">Stop Recording</button>
              <span id="recTimer" className="rec-timer hidden">0:00</span>
              <span id="recIndicator" className="rec-indicator hidden" />
            </div>
            <div id="recDownload" className="rec-download hidden">
              <audio id="recAudio" controls style={{ width: '100%', marginBottom: 8 }} />
              <div className="rec-download-actions">
                <button id="recDownloadBtn" className="btn-secondary">Download Mix</button>
                <button id="recDownloadStemsBtn" className="btn-secondary">Download Stems</button>
              </div>
            </div>
          </div>
        </section>

        {/* OBS WebSocket Integration */}
        <section className="menu-section">
          <button className="menu-toggle" id="obsSettingsToggle">
            OBS Integration
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="obsSettingsContent">
            <p className="info-text">
              Connect to OBS Studio via WebSocket to switch scenes automatically based on mood changes.
              Requires OBS with the obs websocket plugin enabled.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <input
                id="obsHost"
                type="text"
                placeholder="Host (localhost)"
                defaultValue="localhost"
                style={{ flex: 2, minWidth: 100 }}
              />
              <input
                id="obsPort"
                type="number"
                placeholder="Port"
                defaultValue="4455"
                style={{ flex: '0 0 auto', width: 80 }}
              />
            </div>
            <input
              id="obsPassword"
              type="password"
              placeholder="Password (optional)"
              autoComplete="off"
              style={{ width: '100%', marginTop: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button id="obsConnectBtn" className="btn-primary" style={{ flex: 1 }}>
                Connect
              </button>
              <button id="obsDisconnectBtn" className="btn-secondary" style={{ flex: 1 }}>
                Disconnect
              </button>
            </div>
            <div id="obsConnectionStatus" className="info-text" style={{ marginTop: 8 }}>
              Not connected
            </div>
            <h3 style={{ marginTop: 16 }}>Scene Mapping</h3>
            <p className="info-text">
              Map moods to OBS scene names. When SuiteRhythm detects a mood change, OBS will switch
              automatically.
            </p>
            <div id="obsSceneMapList" style={{ marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                id="obsMapMood"
                type="text"
                placeholder="Mood (e.g. combat)"
                style={{ flex: 1, minWidth: 100 }}
              />
              <input
                id="obsMapScene"
                type="text"
                placeholder="OBS Scene name"
                style={{ flex: 1, minWidth: 100 }}
              />
              <button id="obsAddMapping" className="btn-secondary" style={{ flex: '0 0 auto' }}>
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
