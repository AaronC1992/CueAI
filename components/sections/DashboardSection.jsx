'use client';

/**
 * Dashboard / Studio Home section.
 * Focused cinematic presentation: bold headline, real time story demo, and three core use cases.
 */
export default function DashboardSection() {
  return (
    <div id="dashboardPanel" className="app-section">
      {/* Cinematic Hero Section */}
      <div className="dashboard-hero">
        <h1 className="dashboard-title">Your AI audio director for live stories</h1>
        <p className="dashboard-sub">
          Speak your story out loud. SuiteRhythm listens live, scoring the scene as it unfolds and firing sound effects the moment the action lands.
        </p>
        <div className="dashboard-hero-actions">
          <button id="demoBtn" className="hub-hero-cta btn-primary" data-section="demoMode" type="button">
            Enter Interactive Demo
          </button>
          <button className="hub-hero-cta btn-secondary" data-section="dndAutoDetect" type="button">
            Launch Microphone
          </button>
        </div>
      </div>

      <div id="noKeyBanner" className="no-key-banner hidden">
        <span>
          Local sound engine active with full sound library.
        </span>
      </div>

      {/* Live Example Driven Demo Callout */}
      <section className="live-demo-banner" aria-label="Live story sample">
        <div className="demo-banner-header">
          <span className="demo-banner-tag">Live Voice Reactive Example</span>
          <span className="demo-banner-hint">Say these lines out loud and listen to the world wake up</span>
        </div>
        <div className="demo-banner-quotes">
          <div className="demo-quote-card">
            <span className="demo-quote-icon" aria-hidden="true">⚔️</span>
            <p className="demo-quote-line">&ldquo;The iron gate creaked as three goblins charged through the rain.&rdquo;</p>
            <div className="demo-quote-cues">
              <span className="cue-pill">gate creak</span>
              <span className="cue-pill">goblin growl</span>
              <span className="cue-pill">rain storm</span>
            </div>
          </div>
          <div className="demo-quote-card">
            <span className="demo-quote-icon" aria-hidden="true">🔥</span>
            <p className="demo-quote-line">&ldquo;Flames roared across the deck while the captain drew his blade.&rdquo;</p>
            <div className="demo-quote-cues">
              <span className="cue-pill">fire crackle</span>
              <span className="cue-pill">ship creak</span>
              <span className="cue-pill">sword draw</span>
            </div>
          </div>
          <div className="demo-quote-card">
            <span className="demo-quote-icon" aria-hidden="true">🌲</span>
            <p className="demo-quote-line">&ldquo;Footsteps hurried down the stone stairs as thunder shook the tower.&rdquo;</p>
            <div className="demo-quote-cues">
              <span className="cue-pill">stone steps</span>
              <span className="cue-pill">thunder crack</span>
              <span className="cue-pill">dark ambient</span>
            </div>
          </div>
        </div>
      </section>

      {/* Three Core Use Case Cards */}
      <div className="section-title-row">
        <h2>Three Ways to Score</h2>
        <span className="section-subtitle">Pick your realm to begin directing live audio</span>
      </div>

      <div className="use-case-grid">
        <div className="use-case-card" data-section="tableTopSection" data-context="dnd">
          <div className="use-case-badge">Campaign Play</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3 className="use-case-title">Tabletop RPGs</h3>
          <p className="use-case-desc">
            Immerse your party in rich fantasy tavern songs, sudden dungeon traps, clashing blades, and epic monster battle themes without touching a soundboard.
          </p>
          <span className="use-case-cta">Launch Tabletop Realm &rarr;</span>
        </div>

        <div className="use-case-card" data-section="creatorSection" data-context="content">
          <div className="use-case-badge">Live Broadcast</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3 className="use-case-title">Streamers</h3>
          <p className="use-case-desc">
            Broadcast ready integration with instant mic ducking, dramatic reaction stings, and overlay friendly audio controls built for your live audience.
          </p>
          <span className="use-case-cta">Open Streamer Studio &rarr;</span>
        </div>

        <div className="use-case-card" data-section="storyTellerSection" data-context="storytelling">
          <div className="use-case-badge">Narration</div>
          <div className="use-case-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3 className="use-case-title">Audiobooks &amp; Tales</h3>
          <p className="use-case-desc">
            Transform spoken stories, scary campfire tales, bedtime folklore, and audio dramas into fully scored audio productions on the fly.
          </p>
          <span className="use-case-cta">Start Storyteller &rarr;</span>
        </div>
      </div>
    </div>
  );
}
