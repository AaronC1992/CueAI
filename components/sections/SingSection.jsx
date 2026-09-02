'use client';

/** Sing section — dedicated screen for Sing mode with backing music. */
export default function SingSection() {
  return (
    <div id="singSection" className="app-section hidden">
      <div className="section-header">
        <h2>Sing</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">
          Start singing and SuiteRhythm will pick backing music that matches your tempo and energy.
          Headphones recommended so your mic doesn&apos;t pick up the music.
        </p>

        {/* Hidden mode button — auto-clicked by engine when entering this section */}
        <button className="mode-btn hidden" data-mode="sing" data-auto-select="true" style={{ display: 'none' }}>Sing</button>

        {/* Genre Selector */}
        <section className="sing-genre-section" style={{ marginBottom: 16 }}>
          <label htmlFor="singGenreSelect" style={{ fontWeight: 600, marginRight: 10 }}>Genre</label>
          <select id="singGenreSelect" className="sing-genre-select" defaultValue="pop">
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="country">Country</option>
            <option value="rap">Rap / Hip Hop</option>
            <option value="rnb">R&amp;B / Soul</option>
            <option value="jazz">Jazz</option>
            <option value="blues">Blues</option>
            <option value="folk">Folk / Acoustic</option>
            <option value="electronic">Electronic / EDM</option>
            <option value="reggae">Reggae</option>
            <option value="classical">Classical</option>
            <option value="metal">Metal</option>
            <option value="punk">Punk</option>
            <option value="indie">Indie</option>
            <option value="latin">Latin</option>
            <option value="kpop">K Pop</option>
            <option value="lofi">Lo Fi</option>
            <option value="gospel">Gospel</option>
          </select>
          <p className="info-text" style={{ marginTop: 4 }}>
            Tells SuiteRhythm what style of backing music to play while you sing.
          </p>
        </section>

        {/* Audio Visualizer */}
        <section className="visualizer-section" id="singVisualizerSection">
          <canvas id="singVisualizer" className="visualizer-mirror" />
          <div className="status-row">
            <span className="mic-indicator" id="singMicIndicator" />
            <div id="singStatusText" className="status-text">Ready to listen...</div>
          </div>
        </section>

        {/* Control Buttons */}
        <section className="controls">
          <button className="btn-test section-test-mic">Test Microphone</button>
          <button className="btn-start section-start-btn">Start Listening</button>
          <button className="btn-stop hidden section-stop-btn">Stop Listening</button>
          <button className="btn-stop-audio section-stop-audio">Stop Audio</button>
          <button className="btn-secondary section-undo-music" title="Revert the most recent music change">Undo Music</button>
        </section>

        {/* Sing Stats */}
        <div className="sing-stats" style={{ marginTop: 16 }}>
          <div className="stat-item">
            <span className="stat-value" id="singSectionBpmReadout">0 BPM</span>
            <span className="stat-label">Detected Tempo</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="singSectionStateReadout">idle</span>
            <span className="stat-label">State</span>
          </div>
        </div>

        {/* Sing Options */}
        <div style={{ marginTop: 16 }}>
          <div className="toggle-row" style={{ marginTop: 8 }}>
            <label htmlFor="singSectionApplauseToggle">Applause on song end</label>
            <label className="toggle-switch">
              <input type="checkbox" id="singSectionApplauseToggle" className="sing-applause-mirror" defaultChecked />
              <span className="toggle-slider" />
            </label>
          </div>
          <p className="info-text" style={{ marginTop: 0 }}>
            Plays a crowd applause cue after silence following a sustained song.
          </p>
          <div className="toggle-row" style={{ marginTop: 8 }}>
            <label htmlFor="singSectionStageFeelToggle">Live stage feel</label>
            <label className="toggle-switch">
              <input type="checkbox" id="singSectionStageFeelToggle" className="sing-stage-mirror" />
              <span className="toggle-slider" />
            </label>
          </div>
          <p className="info-text" style={{ marginTop: 0 }}>
            Occasional quiet crowd cheers or whistles during songs, like a live gig. Off equals silent audience.
          </p>
        </div>

        {/* Audio Controls */}
        <section className="audio-controls-panel">
          <h3 className="audio-controls-title">Audio Controls</h3>
          <div className="audio-controls-grid">
            <div className="audio-control-row">
              <label className="audio-control-label">Music</label>
              <label className="toggle-switch">
                <input type="checkbox" className="music-toggle-mirror" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>

        {/* Currently Playing */}
        <section className="sounds-section">
          <h3>Currently Playing</h3>
          <div className="sounds-list section-current-sounds">
            <div className="sound-item inactive">No sounds playing</div>
          </div>
        </section>

        {/* Activity Feed */}
        <section className="activity-feed-section">
          <h3>Engine Activity <span className="toggle-indicator">&#9660;</span></h3>
          <div className="activity-log section-activity-log" />
        </section>
      </div>
    </div>
  );
}
