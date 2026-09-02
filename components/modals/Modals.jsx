'use client';

/**
 * Collection of all overlay and modal components.
 * Grouped in one file to keep imports clean in AppShell.
 * Each modal is rendered in the DOM so the engine can show or hide them.
 */

export function SubscribeModal() {
  return (
    <div
      id="subscribeModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribeModalTitle"
    >
      <div className="modal-content">
        <h2 id="subscribeModalTitle">SuiteRhythm Studio Access</h2>
        <p><strong>Reactive Sound Design for Storytellers and Creators</strong></p>
        <p className="info-text">
          Full sound library and local engine active. Configure optional access tokens below.
        </p>

        <div className="provider-info" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-2)', margin: '14px 0' }}>
            Sound Workstation Ready
          </p>
          <button
            id="subscribeBtn"
            className="btn-primary"
            style={{ width: '100%', padding: 14, fontSize: '1.05rem' }}
          >
            Continue to Studio
          </button>
          <button
            id="enterTokenBtn"
            className="btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
          >
            Configure Access Token
          </button>
        </div>

        <div id="enterTokenForm" className="hidden" style={{ marginTop: 12 }}>
          <input
            type="password"
            id="accessTokenInput"
            placeholder="Paste your access token..."
            autoComplete="off"
            style={{ marginTop: 6 }}
          />
          <button
            id="saveTokenBtn"
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
          >
            Activate Token
          </button>
        </div>

        <button
          id="skipApiKey"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 8 }}
        >
          Use Standard Mode
        </button>

        <p className="info-text" style={{ marginTop: 14, fontSize: '0.8rem', textAlign: 'center' }}>
          <a href="/terms" target="_blank">Terms of Service</a>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <a href="/privacy" target="_blank">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}

export function TutorialModal() {
  return (
    <div
      id="tutorialModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorialModalTitle"
    >
      <div className="modal-content tutorial-content">
        <button id="closeTutorial" className="close-btn">&times;</button>
        <h2 id="tutorialModalTitle">SuiteRhythm User Guide</h2>
        <p className="tutorial-intro">
          Welcome to SuiteRhythm! Here is everything you need to know to get started.
        </p>

        <div className="tutorial-section">
          <h3>Volume Controls</h3>
          <p><strong>Min/Max Volume:</strong> Set the range for automatic volume adjustments.</p>
          <p><strong>Music Level:</strong> Control background music volume independently (0 to 100%).</p>
          <p><strong>Sound Effects Level:</strong> Control SFX volume independently (0 to 100%).</p>
          <p>
            <strong>Mood and Intensity:</strong> Bias audio choices from calm (0%) to intense (100%).
            Higher values equal louder music, deeper ducking, and more dramatic effects.
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Performance</h3>
          <p>
            <strong>Low Latency Mode:</strong> When enabled, SuiteRhythm preloads more sounds in
            parallel and responds faster. Best on strong networks and modern devices.
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Playback Options</h3>
          <p><strong>Music Toggle:</strong> Turn background music on or off.</p>
          <p><strong>SFX Toggle:</strong> Turn sound effects on or off.</p>
          <p>
            <strong>Auto Scene Detection:</strong> When enabled, SuiteRhythm analyzes spoken words and
            plays matching music or SFX automatically.
          </p>
          <p className="info-text">Tip: Turn one off to play only music or only SFX.</p>
        </div>

        <div className="tutorial-section">
          <h3>Voice Commands</h3>
          <p>Control SuiteRhythm hands free while listening:</p>
          <ul>
            <li><strong>&quot;Skip track&quot;</strong> or <strong>&quot;Next song&quot;</strong>, Change the music</li>
            <li><strong>&quot;Quieter music&quot;</strong> or <strong>&quot;Louder music&quot;</strong>, Adjust music volume by 10%</li>
            <li><strong>&quot;Mute music&quot;</strong> or <strong>&quot;Unmute music&quot;</strong>, Toggle music on or off</li>
            <li><strong>&quot;Mute sound effects&quot;</strong> or <strong>&quot;Unmute SFX&quot;</strong>, Toggle SFX on or off</li>
          </ul>
        </div>

        <div className="tutorial-section">
          <h3>Audio Features</h3>
          <p><strong>Music Ducking:</strong> Music automatically lowers when sound effects play, then returns smoothly.</p>
          <p><strong>Spatial Audio:</strong> SFX are positioned in stereo for immersive depth.</p>
          <p><strong>Loudness Normalization:</strong> All sounds are balanced to consistent volume.</p>
          <p><strong>Crossfades:</strong> Music transitions smoothly without abrupt cuts.</p>
          <p>
            <strong>Stingers:</strong> Periodic ambient sounds play every 20 to 45 seconds for variety
            when Auto Scene Detection is enabled.
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Tips</h3>
          <ul>
            <li>Speak clearly and close to your microphone for best results</li>
            <li>Instant triggers: Words like &quot;bang&quot;, &quot;crash&quot;, &quot;knock&quot;, &quot;bark&quot; play sounds immediately</li>
            <li>Use the Mood slider to match the story intensity</li>
            <li>Enable Low Latency Mode for fast reactions</li>
            <li>The engine learns context over time, keep talking for better sound matching</li>
          </ul>
        </div>

        <button id="closeTutorialBtn" className="btn-primary" style={{ marginTop: 20 }}>
          Got It!
        </button>
      </div>
    </div>
  );
}

export function FeedbackModal() {
  return (
    <div
      id="feedbackModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedbackModalTitle"
    >
      <div className="modal-content">
        <h2 id="feedbackModalTitle">Feedback or Suggestion</h2>
        <p className="info-text">
          Share suggestions, bugs, or ideas to help make SuiteRhythm even better.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <select id="feedbackType" className="mode-dropdown" style={{ flex: 0.6 }}>
            <option value="Bug Report">Bug Report</option>
            <option value="Suggestion">Suggestion</option>
            <option value="Question">Question</option>
          </select>
          <input type="text" id="feedbackSubject" placeholder="Subject (optional)" style={{ flex: 1 }} />
        </div>

        <textarea
          id="feedbackText"
          rows="6"
          placeholder="Describe the bug, suggestion, or question..."
          style={{ marginTop: 12, width: '100%', resize: 'vertical' }}
        />

        <p className="info-text">
          Recipient: <strong>aaroncue92@gmail.com</strong>
        </p>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 15 }}
        >
          <button id="sendFeedbackBtn" className="btn-primary">Open Email App</button>
          <button id="openGmailBtn" className="btn-secondary">Open in Gmail</button>
          <button id="copyFeedbackBtn" className="btn-secondary">Copy Details</button>
          <button id="cancelFeedback" className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  return (
    <div id="loadingOverlay" className="overlay hidden" aria-live="polite" aria-busy="true">
      <div className="overlay-content">
        <div className="spinner" aria-hidden="true" />
        <div id="loadingMessage">Preparing sounds...</div>
        <div className="preload-progress">
          <div className="preload-bar-track">
            <div id="preloadBarFill" className="preload-bar-fill" style={{ width: '0%' }} />
          </div>
          <div id="preloadText" className="preload-text" />
        </div>
      </div>
    </div>
  );
}

export function StoryContextModal() {
  return (
    <div
      id="storyContextModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyContextModalTitle"
    >
      <div className="modal-content">
        <h2 id="storyContextModalTitle">Set the Scene</h2>
        <p className="info-text">
          Give SuiteRhythm some context about your story to help it choose better sounds and music!
        </p>

        <div className="story-context-body">
          <label htmlFor="storyContextInput" className="story-context-label">
            Story Context (Optional)
          </label>
          <textarea
            id="storyContextInput"
            rows="5"
            className="story-context-input"
            placeholder="Example: 'A dark medieval fantasy adventure in a haunted castle' or 'A cheerful children story in a magical forest'"
          />
          <p className="info-text story-context-tip">
            Tip: Mention the setting, genre, mood, or time period. SuiteRhythm will use this to better
            understand your story and choose appropriate sounds.
          </p>
        </div>

        <div className="story-context-actions">
          <button id="startWithContext" className="btn-primary">Start Listening</button>
          <button id="skipContext" className="btn-secondary">Skip and Start</button>
        </div>
      </div>
    </div>
  );
}

export function StoryOverlay() {
  return (
    <div id="storyOverlay" className="story-overlay hidden">
      <div className="story-header">
        <button id="closeStory" className="close-btn" aria-label="Close story">&times;</button>
        <h2 id="storyTitle" className="story-title" />
      </div>
      <div id="storyContent" className="story-content" tabIndex={0} />
      {/* Demo controls shown inside the story overlay when demo mode is active */}
      <div id="demoControls" className="demo-controls hidden">
        <span id="demoStatusText" className="demo-status-text" />
        <div className="demo-controls-buttons">
          <button id="demoStartListening" className="btn-primary demo-start-btn">Start Listening</button>
          <button id="demoAutoReadBtn" className="btn-secondary">Auto Read</button>
          <button id="demoStopBtn" className="btn-secondary demo-stop-btn hidden">Stop</button>
        </div>
      </div>
    </div>
  );
}

export function DemoSelectorOverlay() {
  return (
    <div id="demoSelectorOverlay" className="overlay hidden">
      <div className="overlay-content" style={{ flexDirection: 'column', maxWidth: 600, width: '90%' }}>
        <button id="demoSelectorClose" className="close-btn" aria-label="Close" style={{ alignSelf: 'flex-end' }}>&times;</button>
        <h2 style={{ margin: 0 }}>Choose a Demo Story</h2>
        <div id="demoStoryList" className="demo-story-list" />
      </div>
    </div>
  );
}
