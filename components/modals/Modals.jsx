'use client';

/**
 * Collection of all overlay and modal components.
 * Grouped in one file to keep imports clean in AppShell.
 * Each modal is rendered in the DOM so the engine can show or hide them.
 */

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
          Learn the main modes, sound tools, recording workflow, and setup choices in one place.
        </p>

        <nav className="tutorial-topic-nav" aria-label="Tutorial topics">
          <a href="#tutorial-start">Start Here</a>
          <a href="#tutorial-modes">Modes</a>
          <a href="#tutorial-library">Sound Library</a>
          <a href="#tutorial-board">Control Board</a>
          <a href="#tutorial-recorder">Voice Recorder</a>
          <a href="#tutorial-studio">Creator Studio</a>
          <a href="#tutorial-obs">OBS</a>
          <a href="#tutorial-settings">Settings</a>
          <a href="#tutorial-fixes">Trouble Shooting</a>
        </nav>

        <div className="tutorial-section" id="tutorial-start">
          <h3>Start Here</h3>
          <p><strong>What it is:</strong> SuiteRhythm is a live audio workstation for story scenes, tabletop games, streams, podcasts, and creator sessions.</p>
          <p><strong>Fast path:</strong> Open the app, choose a mode, enable your microphone if needed, then let the engine add music, ambience, and effects around your scene.</p>
          <p><strong>Best first test:</strong> Try Auto Detect, say a short scene out loud, then open Sound Library to preview and disable anything you do not want used.</p>
        </div>

        <div className="tutorial-section" id="tutorial-modes">
          <h3>Modes</h3>
          <div className="tutorial-mode-grid">
            <article><h4>Auto Detect</h4><p>Listens to natural speech and chooses sounds based on action, place, tone, and mood.</p></article>
            <article><h4>Table Top RPG</h4><p>Use campaign ready controls for encounters, locations, creature sounds, and dramatic cues.</p></article>
            <article><h4>Story Teller</h4><p>Read or perform scenes while the app supports pacing with music, ambience, and effects.</p></article>
            <article><h4>Creator Studio</h4><p>Work with media, transcripts, cue maps, preview mixes, and rendered exports.</p></article>
            <article><h4>Control Board</h4><p>Build manual sound buttons for music loops, ambience beds, one shot effects, and custom recordings.</p></article>
            <article><h4>Sing Backing</h4><p>Use vocal energy and tempo aware tools for backing tracks and performance support.</p></article>
          </div>
        </div>

        <div className="tutorial-section" id="tutorial-library">
          <h3>Sound Library</h3>
          <p><strong>Catalog:</strong> The library has 999 entries across music, SFX, and ambience.</p>
          <p><strong>Search:</strong> Type a name, mood, genre, object, action, or tag to narrow the list.</p>
          <p><strong>Filters:</strong> Use type filters, recently added, tag filters, custom sounds, and review status to find the right asset quickly.</p>
          <p><strong>Review tools:</strong> Mark sounds as approved, needs review, or rejected. Review state is local to your browser for now.</p>
          <p><strong>Disable sounds:</strong> Turn off any catalog item you do not want Auto Detect or matching logic to use.</p>
        </div>

        <div className="tutorial-section" id="tutorial-board">
          <h3>Control Board</h3>
          <p><strong>Use it for:</strong> Buttons you want to trigger by hand during a session.</p>
          <p><strong>Button types:</strong> Music and ambience loop until stopped. SFX play once.</p>
          <p><strong>Custom audio:</strong> Recordings saved from the Voice Recorder show up in board search and can be assigned to buttons.</p>
          <p><strong>Scene tabs:</strong> Organize buttons by scene, encounter, location, or show segment.</p>
        </div>

        <div className="tutorial-section" id="tutorial-recorder">
          <h3>Voice Recorder</h3>
          <p><strong>Open it from:</strong> Sound Library, Custom Sounds, Record Sound.</p>
          <p><strong>Save as:</strong> Choose SFX, music, or ambience. Music and ambience can loop on the board.</p>
          <p><strong>Voice effects:</strong> Clean, warm, bright, radio, monster, and whisper change the captured signal before saving.</p>
          <p><strong>Mixer controls:</strong> Input gain boosts or lowers the mic. Noise gate removes quiet room noise. Monitor lets you hear the processed sound while recording.</p>
          <p><strong>Tags and notes:</strong> Add tags so search can find the recording later, and add notes for your own review.</p>
          <p><strong>Storage:</strong> Custom recordings are saved in the browser on this device. Cloud sync can be added later.</p>
        </div>

        <div className="tutorial-section" id="tutorial-studio">
          <h3>Creator Studio</h3>
          <p><strong>Live mode:</strong> Use the creator view for active narration, live cues, and performance control.</p>
          <p><strong>Studio mode:</strong> Upload media, build cue maps, preview the mix, and render audio or video exports.</p>
          <p><strong>Preview Mix:</strong> Plays your media and fires cue sounds at their planned times so you can check pacing before rendering.</p>
          <p><strong>Transcription:</strong> Use transcript tools to help place cues against spoken content.</p>
        </div>

        <div className="tutorial-section" id="tutorial-settings">
          <h3>Settings and Audio Behavior</h3>
          <p><strong>Music level:</strong> Controls backing music volume.</p>
          <p><strong>SFX level:</strong> Controls effects volume.</p>
          <p><strong>Mood bias:</strong> Pushes the engine toward calmer or more intense choices.</p>
          <p><strong>Music ducking:</strong> Music lowers while effects play, then returns smoothly.</p>
          <p><strong>Low latency:</strong> Preloads more instant trigger sounds for quicker response on stronger devices and networks.</p>
          <p><strong>Color themes:</strong> Change the visual palette without changing sound behavior.</p>
        </div>

        <div className="tutorial-section" id="tutorial-obs">
          <h3>OBS and External Control</h3>
          <p><strong>OBS route:</strong> Use the OBS page as a browser source when you want a stream friendly view.</p>
          <p><strong>External commands:</strong> Browser integrations can call the SuiteRhythm command surface to trigger sounds, stop audio, change scenes, or read status.</p>
          <p><strong>Twitch chat:</strong> The anonymous chat bridge can listen for simple sound commands without needing OAuth.</p>
        </div>

        <div className="tutorial-section" id="tutorial-fixes">
          <h3>Trouble Shooting</h3>
          <ul>
            <li>If microphone features do not start, check browser microphone permission.</li>
            <li>If old screens keep appearing, unregister the service worker once and hard refresh.</li>
            <li>If sounds do not play, interact with the page once so the browser allows audio.</li>
            <li>If a custom recording is missing, check that browser storage was not cleared.</li>
            <li>If AI or TTS fails, check provider keys and quota in Vercel.</li>
          </ul>
        </div>

        <div className="tutorial-section">
          <h3>Recommended Learning Path</h3>
          <ol>
            <li>Start with Auto Detect and say a short scene.</li>
            <li>Open Sound Library and preview sounds by type.</li>
            <li>Create a Control Board tab for one scene.</li>
            <li>Record a custom voice cue and add it to the board.</li>
            <li>Try Creator Studio when you want timeline style work.</li>
            <li>Open Sound Audit when you want to review the catalog.</li>
          </ol>
        </div>

        <button id="closeTutorialBtn" className="btn-primary" style={{ marginTop: 20 }}>
          Start Using SuiteRhythm
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
