'use client';

/** Sound Library section — browse, preview, disable sounds; record custom sounds. */
export default function SoundLibrarySection() {
  return (
    <>
      <div id="soundLibrarySection" className="app-section hidden">
        <div className="section-header">
          <h2>Sound Library</h2>
        </div>
        <div className="section-body">
          <p className="section-intro">
            Browse, preview, and manage all available sounds. Disable any sound you don&apos;t want
            SuiteRhythm to use.
          </p>

          {/* Search & Filters */}
          <div className="sound-lib-controls">
            <input
              type="text"
              id="soundLibSearch"
              className="sound-lib-search"
              placeholder="Search sounds by name or tag..."
            />
            <div className="sound-lib-advanced-controls">
              <label>
                Sort
                <select id="soundLibSort" className="record-input">
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                  <option value="review">Review</option>
                </select>
              </label>
              <label>
                Mood or tag
                <select id="soundLibTagFilter" className="record-input">
                  <option value="">Any tag</option>
                </select>
              </label>
              <label className="sound-lib-check">
                <input id="soundLibNewOnly" type="checkbox" />
                Recently added
              </label>
            </div>
            <div className="sound-lib-filters">
              <button className="sound-lib-filter active" data-filter="all">All</button>
              <button className="sound-lib-filter" data-filter="music">Music</button>
              <button className="sound-lib-filter" data-filter="sfx">SFX</button>
              <button className="sound-lib-filter" data-filter="ambience">Ambience</button>
              <button className="sound-lib-filter" data-filter="custom">Custom</button>
              <button className="sound-lib-filter" data-filter="needs-review">Needs Review</button>
              <button className="sound-lib-filter" data-filter="approved">Approved</button>
              <button className="sound-lib-filter" data-filter="rejected">Rejected</button>
              <button className="sound-lib-filter" data-filter="disabled">Disabled</button>
            </div>
            <div className="sound-lib-stats">
              <span id="soundLibCount">0 sounds</span>
              <span id="soundLibDisabledCount">0 disabled</span>
              <span id="soundLibReviewCount">0 reviewed</span>
            </div>
          </div>

          <div id="soundDiscoveryPanel" className="sound-discovery-panel" />

          <div className="sound-lib-admin-grid">
            <section className="sound-audit-panel">
              <h3>Sound Audit</h3>
              <div id="soundAuditPanel" className="sound-audit-grid" />
            </section>
            <section className="sound-audit-panel">
              <h3>Review Queue</h3>
              <div id="soundReviewPanel" className="sound-review-panel" />
            </section>
          </div>

          {/* Sound List — populated by engine */}
          <div id="soundLibList" className="sound-lib-list" />

          {/* Custom Sounds */}
          <div className="sound-lib-custom">
            <h3>Custom Sounds</h3>
            <p className="info-text">
              Record or upload your own sounds, music, and ambience for the sound board.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button id="recordSoundBtn" className="btn-primary">Record Sound</button>
              <button id="uploadSoundBtn" className="btn-secondary">Upload Sound</button>
              <input
                type="file"
                id="uploadSoundInput"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg,.webm"
                style={{ display: 'none' }}
              />
            </div>
            <div id="customSoundsList" className="sound-lib-list" />
          </div>
        </div>
      </div>

      {/* Record Sound Modal (lives alongside this section in the original HTML) */}
      <div
        id="recordSoundModal"
        className="modal-overlay hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recordSoundModalTitle"
      >
        <div className="modal-content record-modal">
          <button className="modal-close" id="closeRecordModal">&times;</button>
          <h2 id="recordSoundModalTitle">Voice Recorder</h2>
          <div className="record-controls">
            <div className="record-visualizer">
              <canvas id="recordVisualizer" width="300" height="60" />
            </div>
            <div className="record-timer" id="recordTimer">0:00</div>
            <div className="record-mixer-grid">
              <label>
                Save as
                <select id="recordType" className="record-input">
                  <option value="sfx">Sound Effect</option>
                  <option value="music">Music</option>
                  <option value="ambience">Ambience</option>
                </select>
              </label>
              <label>
                Voice effect
                <select id="recordVoiceEffect" className="record-input">
                  <option value="clean">Clean</option>
                  <option value="warm">Warm</option>
                  <option value="bright">Bright</option>
                  <option value="radio">Radio</option>
                  <option value="monster">Monster</option>
                  <option value="whisper">Whisper</option>
                </select>
              </label>
              <label>
                Input gain
                <input id="recordGain" type="range" min="0.4" max="2" step="0.1" defaultValue="1" />
              </label>
              <label>
                Noise gate
                <input id="recordGate" type="range" min="0" max="0.08" step="0.005" defaultValue="0.015" />
              </label>
            </div>
            <div className="record-btns">
              <button id="recordStartBtn" className="btn-record">Record</button>
              <button id="recordStopBtn" className="btn-record-stop hidden">Stop</button>
              <button id="recordPreviewEffectBtn" className="btn-secondary" type="button">Monitor</button>
            </div>
            <div id="recordPlayback" className="record-playback hidden">
              <audio id="recordAudio" controls />
            </div>
          </div>
          <div className="record-form">
            <input
              type="text"
              id="recordName"
              placeholder="Sound name (e.g. Dragon Roar)"
              className="record-input"
            />
            <input
              type="text"
              id="recordTags"
              placeholder="Tags, comma separated (e.g. dragon, roar, creature)"
              className="record-input"
            />
            <textarea
              id="recordNotes"
              placeholder="Review notes or sound board use"
              className="record-input record-notes"
              rows="3"
            />
            <button id="recordSaveBtn" className="btn-primary" disabled>Save Sound</button>
          </div>
        </div>
      </div>

      {/* Upload Sound Modal */}
      <div
        id="uploadSoundModal"
        className="modal-overlay hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uploadSoundModalTitle"
      >
        <div className="modal-content record-modal">
          <button className="modal-close" id="closeUploadModal">&times;</button>
          <h2 id="uploadSoundModalTitle">Upload a Sound</h2>
          <div id="uploadPreview" className="record-playback hidden" style={{ marginBottom: 12 }}>
            <audio id="uploadAudio" controls style={{ width: '100%' }} />
          </div>
          <p id="uploadFileName" className="info-text" style={{ marginBottom: 8 }} />
          <div className="record-form">
            <input
              type="text"
              id="uploadName"
              placeholder="Sound name (e.g. Dragon Roar)"
              className="record-input"
            />
            <input
              type="text"
              id="uploadTags"
              placeholder="Tags, comma separated (e.g. dragon, roar, creature)"
              className="record-input"
            />
            <button id="uploadSaveBtn" className="btn-primary" disabled>Save Sound</button>
          </div>
        </div>
      </div>
    </>
  );
}
