'use client';

/**
 * Collection of all overlay and modal components.
 * Grouped in one file to keep imports clean in AppShell.
 * Each modal is rendered in the DOM so the engine can show or hide them.
 */

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
