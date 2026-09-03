'use client';

import SectionBackButton from '../SectionBackButton';

/** Control Board section — drag-and-drop soundboard with scene tabs. */
export default function ControlBoardSection() {
  return (
    <div id="dndControlBoard" className="app-section hidden">
      <div className="section-header">
        <SectionBackButton />
        <h2>Control Board</h2>
        <div className="cb-header-actions">
          <button id="cbListenToggle" className="btn-secondary cb-btn-sm" title="Toggle live speech detection">
            Listen
          </button>
          <button id="cbAddBtn" className="btn-primary cb-btn-sm">Add Sound</button>
          <button id="cbSaveBtn" className="btn-secondary cb-btn-sm">Save Board</button>
          <button id="cbLoadBtn" className="btn-secondary cb-btn-sm">Load Board</button>
          <button id="cbUndoBtn" className="btn-secondary cb-btn-sm">Undo</button>
          <button id="cbStopAllBtn" className="btn-secondary cb-btn-sm cb-btn-danger">Stop All</button>
        </div>
      </div>
      <div className="section-body cb-body">
        <p className="section-intro">
          Build your custom soundboard. Tabs = scenes. Drag to move, resize handles to scale.
          Music loops until toggled off, SFX plays once.
        </p>
        {/* Scene Tabs — populated by engine */}
        <div className="cb-tabs-bar" id="cbTabsBar" />
        {/* Listen Mode Status */}
        <div className="cb-listen-status hidden" id="cbListenStatus">
          <span className="cb-listen-dot" />
          <span id="cbListenText">Listening for keywords...</span>
        </div>
        <div id="cbCanvas" className="cb-canvas">
          <div className="cb-empty-state">
            <p>No sounds added yet. Click &quot;Add Sound&quot; to build your board.</p>
          </div>
        </div>
      </div>

      {/* Add Sound Modal */}
      <div id="cbAddModal" className="modal hidden">
        <div className="modal-content cb-add-modal">
          <div className="cb-add-header">
            <h2>Add a Sound Button</h2>
            <p className="cb-add-subtitle">Pick a sound from your library, then name the button.</p>
          </div>

          <div className="cb-add-form">
            <div className="cb-add-step">
              <div className="cb-step-heading">
                <span className="cb-step-num">1</span>
                <span className="cb-step-title">Choose a sound</span>
              </div>

              <div className="cb-search-row">
                <div className="cb-search-field">
                  <svg className="cb-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    id="cbSoundSearch"
                    className="cb-search-input"
                    placeholder="Search by name or keyword, try thunder or tavern"
                    autoComplete="off"
                  />
                </div>
                <select id="cbSoundCategoryFilter" className="mode-dropdown cb-search-filter" aria-label="Filter by sound type">
                  <option value="">All types</option>
                  <option value="music">Music</option>
                  <option value="ambience">Ambience</option>
                  <option value="sfx">SFX</option>
                </select>
              </div>

              <div id="cbSoundResults" className="cb-sound-results" role="listbox" aria-label="Sound search results" />

              <div id="cbSelectedSound" className="cb-selected-sound is-empty">
                <span className="cb-selected-label">No sound selected yet</span>
              </div>
              <input type="hidden" id="cbSoundFile" />
            </div>

            <div className="cb-add-step">
              <div className="cb-step-heading">
                <span className="cb-step-num">2</span>
                <span className="cb-step-title">Set up the button</span>
              </div>

              <label className="cb-field">
                <span className="cb-field-label">Button label</span>
                <input type="text" id="cbSoundLabel" placeholder="Battle Theme" autoComplete="off" />
              </label>

              <div className="cb-field-row">
                <label className="cb-field">
                  <span className="cb-field-label">Playback</span>
                  <select id="cbSoundType" className="mode-dropdown">
                    <option value="music">Music, loops until toggled off</option>
                    <option value="ambience">Ambience, loops until toggled off</option>
                    <option value="sfx">Sound effect, plays once</option>
                  </select>
                </label>

                <label className="cb-field">
                  <span className="cb-field-label">Group</span>
                  <select id="cbSoundGroup" className="mode-dropdown">
                    <option value="">No group</option>
                    <option value="combat">Combat</option>
                    <option value="ambience">Ambience</option>
                    <option value="music">Music</option>
                    <option value="npc">NPC / Dialogue</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="cb-add-actions">
            <button id="cbAddCancel" className="btn-secondary">Cancel</button>
            <button id="cbAddConfirm" className="btn-primary">Add to Board</button>
          </div>
        </div>
      </div>

      {/* Load Board Modal */}
      <div id="cbLoadModal" className="modal hidden">
        <div className="modal-content">
          <h2>Load Soundboard</h2>
          <div id="cbSavedBoards" className="cb-saved-boards" />
          <button id="cbLoadCancel" className="btn-secondary" style={{ marginTop: 16 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
