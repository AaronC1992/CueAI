'use client';

import SectionBackButton from '../SectionBackButton';

/** Story Editor section — write, save, and play stories with real-time sound cues. */
export default function StoryEditorSection() {
  return (
    <div id="dndCreateCampaign" className="app-section hidden">
      <div className="section-header">
        <SectionBackButton />
        <h2 id="createSectionTitle">Story Editor</h2>
      </div>
      <div className="section-body">
        <p className="section-intro" id="createSectionIntro">
          Write your stories and play them with SuiteRhythm&apos;s real time sound engine.
        </p>

        <div className="wyo-controls">
          <div className="wyo-editor-col">
            <div className="wyo-toolbar">
              <input
                type="text"
                id="scTitleInput"
                placeholder="Story Title..."
                className="wyo-title-input"
              />
              <div className="wyo-toolbar-btns">
                <button id="scSaveBtn" className="btn-primary">Save</button>
                <button id="scLoadBtn" className="btn-secondary">Load Saved</button>
              </div>
            </div>

            <textarea
              id="scTextArea"
              rows="14"
              placeholder={"Write your story here...\n\nThe rain tapped against the window as she opened the old letter..."}
            />
            <div className="wyo-word-count" id="scWordCount">0 words</div>
          </div>

          <div className="wyo-sidebar-col">
            {/* Keyword-to-Sound Mapping */}
            <div className="wyo-cues-panel">
              <div className="wyo-cues-header">
                <h3>Sound Cues</h3>
                <p className="wyo-cues-hint">
                  Assign sounds to keywords. When a keyword is spoken, your chosen sound plays.
                </p>
              </div>
              <div id="scCuesList" className="wyo-cues-list" />
              <div className="wyo-cue-btn-row">
                <button id="scAddCueBtn" className="btn-secondary wyo-add-cue-btn">+ Add Cue</button>
                <button id="scSuggestCuesBtn" className="btn-secondary wyo-add-cue-btn">Suggest Cues</button>
                <button id="scTestRunBtn" className="btn-secondary wyo-add-cue-btn">Test Run</button>
              </div>
            </div>

            <div className="wyo-actions">
              <button id="scPlayBtn" className="btn-start">Play Story</button>
              <p className="info-text" style={{ marginTop: 4 }}>
                Opens the story reader and listens on your mic, so sounds fire as you read aloud.
              </p>
              <button id="scAutoReadStoryBtn" className="btn-primary" style={{ marginTop: 8 }}>
                Auto Read Story
              </button>
              <p className="info-text" style={{ marginTop: 4 }}>
                Narrates the story for you with the words highlighted and your sound cues firing in time. No mic needed.
              </p>
              <button id="scReadAloudBtn" className="btn-read-aloud" style={{ marginTop: 8 }}>
                Read Aloud (AI Voice)
              </button>
              <button id="scSoundscapeBtn" className="btn-secondary" style={{ marginTop: 8 }}>
                Generate Soundscape
              </button>
              <p className="info-text" style={{ marginTop: 4 }}>
                Build a full sound timeline from the script without needing a mic. Play or export the result.
              </p>
            </div>
          </div>
        </div>

        <div id="scSavedList" className="wyo-saved-list hidden">
          <h3>Saved Stories</h3>
          <div id="scSavedItems" />
          <button id="scSavedClose" className="btn-secondary" style={{ marginTop: 12 }}>
            Close
          </button>
        </div>

        <div className="stories-list-area" style={{ marginTop: 32 }}>
          <h3 id="createSectionSavedTitle">Your Stories</h3>
          <div id="storiesListContainer" className="stories-card-list">
            <p className="info-text">No saved stories yet. Write one above!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
