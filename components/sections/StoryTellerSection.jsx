'use client';

import SectionBackButton from '../SectionBackButton';

/** Story Teller section — dedicated screen for story-driven modes (Horror, Bedtime, Fairytale, Christmas, Halloween). */
export default function StoryTellerSection() {
  return (
    <div id="storyTellerSection" className="app-section hidden">
      <div className="section-header">
        <SectionBackButton />
        <h2>Story Teller</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">
          Pick a genre and start telling your story. SuiteRhythm will listen and play sounds, music, and ambience that match the mood.
        </p>

        {/* Genre Mode Selector */}
        <div className="mode-selector">
          <h3>Genre</h3>
          <div className="mode-buttons">
            {[
              { mode: 'horror', label: 'Horror' },
              { mode: 'bedtime', label: 'Bedtime' },
              { mode: 'fairytale', label: 'Fairytale' },
              { mode: 'christmas', label: 'Christmas' },
              { mode: 'halloween', label: 'Halloween' },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                className={`mode-btn${mode === 'horror' ? ' active' : ''}`}
                data-mode={mode}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scene Presets Bar */}
        <div className="scene-presets-bar" id="storyTellerPresetsBar" />

        {/* Context Input */}
        <div className="context-input-area">
          <label htmlFor="storyTellerContextInput">Story Context (Optional)</label>
          <textarea
            id="storyTellerContextInput"
            className="context-input-mirror"
            rows="3"
            placeholder="Example: 'A spooky haunted house on a stormy night' or 'A cozy bedtime story about a friendly dragon'"
          />
          <p className="info-text">
            Describe the setting or mood to help SuiteRhythm choose better sounds.
          </p>
        </div>

        {/* Audio Visualizer */}
        <section className="visualizer-section" id="storyTellerVisualizerSection">
          <canvas id="storyTellerVisualizer" className="visualizer-mirror" />
          <div className="status-row">
            <span className="mic-indicator" id="storyTellerMicIndicator" />
            <div id="storyTellerStatusText" className="status-text">Ready to listen...</div>
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

        {/* Bedtime auto fade out */}
        <section className="bedtime-timer-panel" style={{ margin: '12px 0' }}>
          <label htmlFor="storyTellerBedtimeTimer" style={{ marginRight: 8 }}>Bedtime fade out:</label>
          <select id="storyTellerBedtimeTimer" className="bedtime-timer-mirror" defaultValue="0">
            <option value="0">Off</option>
            <option value="5">5 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </select>
          <span className="info-text" style={{ marginLeft: 8 }}>
            Master fades over the final 60s, then stops all audio.
          </span>
        </section>

        {/* Audio Controls */}
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

        {/* Session Recording */}
        <section className="session-recording-panel">
          <h3>Session Recording</h3>
          <p className="info-text">Record your story session for playback or sharing.</p>
          <div className="session-rec-controls">
            <button className="btn-primary section-rec-start">Record Session</button>
            <button className="btn-stop hidden section-rec-stop">Stop Recording</button>
          </div>
        </section>

        {/* Currently Playing */}
        <section className="sounds-section">
          <h3>Currently Playing</h3>
          <div className="sounds-list section-current-sounds">
            <div className="sound-item inactive">No sounds playing</div>
          </div>
        </section>

        {/* Live Transcript */}
        <section className="transcript-section">
          <h3>What I&apos;m Hearing</h3>
          <div className="transcript-box section-transcript">Waiting for audio input...</div>
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
