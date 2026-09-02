'use client';

/**
 * Dashboard / Studio Home section.
 * Interactive hub for selecting sound modes, launching live detection,
 * testing soundboards, and managing audio sessions.
 */
export default function DashboardSection() {
  return (
    <div id="dashboardPanel" className="app-section">
      {/* Studio Header Banner */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-badge">
          <span className="hero-pulse-dot" aria-hidden="true" />
          <span>Interactive Audio Workstation</span>
        </div>
        <h1 className="dashboard-title">Reactive Sound Studio</h1>
        <p className="dashboard-sub">
          Generate live soundtracks, atmospheric ambience, and reactive sound effects
          for tabletop games, story narrations, and creative broadcasts.
        </p>
        <div className="dashboard-hero-actions">
          <button id="demoBtn" className="hub-hero-cta btn-primary" data-section="demoMode" type="button">
            Launch Interactive Demo
          </button>
        </div>
      </div>

      <div id="noKeyBanner" className="no-key-banner hidden">
        <span>
          Local sound engine active with full sound library.
        </span>
      </div>

      {/* Primary Studio Modes Grid */}
      <div className="section-title-row">
        <h2>Studio Modes</h2>
        <span className="section-subtitle">Select an environment to begin scoring</span>
      </div>

      <div className="use-case-grid">
        <div className="use-case-card" data-section="dndAutoDetect" data-context="content">
          <div className="use-case-badge">Live Voice</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h3 className="use-case-title">Auto Detect</h3>
          <p className="use-case-desc">
            Speak naturally and allow the engine to detect action, mood, and scenery to trigger sound effects and music on the fly.
          </p>
          <span className="use-case-cta">Start Listening &rarr;</span>
        </div>

        <div className="use-case-card" data-section="tableTopSection" data-context="dnd">
          <div className="use-case-badge">RPG &amp; Dice</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3 className="use-case-title">Table Top RPG</h3>
          <p className="use-case-desc">
            Dedicated atmosphere and battle cues for tabletop roleplay, fantasy dungeon crawls, tavern banter, and epic boss fights.
          </p>
          <span className="use-case-cta">Open Table Top &rarr;</span>
        </div>

        <div className="use-case-card" data-section="storyTellerSection" data-context="storytelling">
          <div className="use-case-badge">Narrative</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3 className="use-case-title">Story Teller</h3>
          <p className="use-case-desc">
            Genre themed audio reactive engine tailored for horror, fairytale, bedtime relaxation, halloween chills, and adventure.
          </p>
          <span className="use-case-cta">Open Story Teller &rarr;</span>
        </div>

        <div className="use-case-card" data-section="creatorSection" data-context="content">
          <div className="use-case-badge">Broadcast</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3 className="use-case-title">Creator Studio</h3>
          <p className="use-case-desc">
            Stream ready tools with voice ducking, quick reaction cues, timeline scoring, and browser source integration for streaming.
          </p>
          <span className="use-case-cta">Open Creator &rarr;</span>
        </div>

        <div className="use-case-card" data-section="dndControlBoard" data-context="dnd">
          <div className="use-case-badge">Soundboard</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h3 className="use-case-title">Control Board</h3>
          <p className="use-case-desc">
            Custom drag and drop soundboard. Create custom scene tabs, pin favorite music loops, and trigger instant sound effects.
          </p>
          <span className="use-case-cta">Open Soundboard &rarr;</span>
        </div>

        <div className="use-case-card" data-section="singSection" data-context="content">
          <div className="use-case-badge">Vocal Sync</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h3 className="use-case-title">Sing Backing</h3>
          <p className="use-case-desc">
            Tempo dynamic backing generator that listens to singing cadence and accompanies with matching rhythm and chords across 18 genres.
          </p>
          <span className="use-case-cta">Open Sing Mode &rarr;</span>
        </div>
      </div>

      {/* Studio Workflow */}
      <section className="hub-how-it-works">
        <div className="section-title-row">
          <h2 className="hub-hiw-title">How It Works</h2>
          <span className="section-subtitle">Real time reactive sound in three simple steps</span>
        </div>
        <div className="hub-hiw-steps">
          <div className="hub-hiw-step">
            <div className="hub-hiw-step-num">1</div>
            <div className="hub-hiw-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h3>Pick a Mode</h3>
            <p>Choose Table Top, Story Teller, Creator Studio, or custom Soundboard.</p>
          </div>
          <div className="hub-hiw-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="hub-hiw-step">
            <div className="hub-hiw-step-num">2</div>
            <div className="hub-hiw-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3>Speak or Play</h3>
            <p>Read your narration aloud, trigger cues, or let microphone input drive the scenes.</p>
          </div>
          <div className="hub-hiw-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="hub-hiw-step">
            <div className="hub-hiw-step-num">3</div>
            <div className="hub-hiw-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3>Hear Dynamic Audio</h3>
            <p>Harmonized music, atmospheric loops, and sound effects play in real time.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
