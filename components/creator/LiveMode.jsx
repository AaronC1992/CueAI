'use client';

export default function LiveMode({ active }) {
  return (
    <div className={`creator-mode-panel${active ? '' : ' hidden'}`} role="tabpanel" aria-label="Live Mode">
      <p className="section-intro">
        Trigger sounds, music, and ambience in real time while recording or streaming.
      </p>

      <div className="scene-presets-bar" id="creatorPresetsBar" />

      <div className="context-input-area">
        <label htmlFor="creatorContextInput">Context (Optional)</label>
        <textarea
          id="creatorContextInput"
          className="context-input-mirror"
          rows="3"
          placeholder="Example: 'Chill lo fi podcast recording session' or 'High energy gaming stream'"
        />
        <p className="info-text">
          Describe your content type or mood to help SuiteRhythm choose better sounds.
        </p>
      </div>

      <section className="visualizer-section" id="creatorVisualizerSection">
        <canvas id="creatorVisualizer" className="visualizer-mirror" />
        <div className="status-row">
          <span className="mic-indicator" id="creatorMicIndicator" />
          <div id="creatorStatusText" className="status-text">Ready to listen...</div>
        </div>
      </section>

      <section className="controls">
        <button type="button" className="btn-test section-test-mic">Test Microphone</button>
        <button type="button" className="btn-start section-start-btn">Start Listening</button>
        <button type="button" className="btn-stop hidden section-stop-btn">Stop Listening</button>
        <button type="button" className="btn-stop-audio section-stop-audio">Stop Audio</button>
        <button type="button" className="btn-secondary section-undo-music" title="Revert the most recent music change">Undo Music</button>
      </section>

      <section className="creator-options" style={{ marginTop: 16 }}>
        <div className="toggle-row">
          <label htmlFor="creatorVoiceDuck">Voice Ducking</label>
          <label className="toggle-switch">
            <input type="checkbox" id="creatorVoiceDuck" className="voice-duck-mirror" />
            <span className="toggle-slider" />
          </label>
        </div>
        <p className="info-text" style={{ marginTop: 0, marginBottom: 12 }}>
          Automatically lower music &amp; ambience when your voice is detected, then restore during pauses.
        </p>
        <div className="toggle-row">
          <label htmlFor="creatorStreamerMode">Live Streamer Mode</label>
          <label className="toggle-switch">
            <input type="checkbox" id="creatorStreamerMode" className="streamer-mode-mirror" />
            <span className="toggle-slider" />
          </label>
        </div>
        <p className="info-text" style={{ marginTop: 0, marginBottom: 12 }}>
          Shorter cooldowns and snappier SFX triggering for live streams. Leave off for calmer content.
        </p>
      </section>

      <section className="audio-controls-panel">
        <h3 className="audio-controls-title">Audio Controls</h3>
        <div className="audio-controls-grid">
          <div className="audio-control-row">
            <label className="audio-control-label">Sound Effects</label>
            <label className="toggle-switch">
              <input type="checkbox" className="sfx-toggle-mirror" defaultChecked />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="audio-control-row">
            <label className="audio-control-label">Music</label>
            <label className="toggle-switch">
              <input type="checkbox" className="music-toggle-mirror" defaultChecked />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="audio-control-row">
            <label className="audio-control-label">Ambience</label>
            <label className="toggle-switch">
              <input type="checkbox" className="ambience-toggle-mirror" defaultChecked />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </section>

      <section className="session-recording-panel">
        <h3>Session Recording</h3>
        <p className="info-text">Record your session audio for post-production or review.</p>
        <div className="session-rec-controls">
          <button type="button" className="btn-primary section-rec-start">Record Session</button>
          <button type="button" className="btn-stop hidden section-rec-stop">Stop Recording</button>
        </div>
      </section>

      <section className="sounds-section">
        <h3>Currently Playing</h3>
        <div className="sounds-list section-current-sounds">
          <div className="sound-item inactive">No sounds playing</div>
        </div>
      </section>

      <section className="transcript-section">
        <h3>What I&apos;m Hearing</h3>
        <div className="transcript-box section-transcript">Waiting for audio input...</div>
      </section>
    </div>
  );
}
