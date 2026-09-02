'use client';

import EngineStatusDot from './EngineStatusDot';

/**
 * Sidebar navigation for the sound application.
 * Section switching is wired by the engine event listeners via data-section attributes.
 */
export default function Sidebar({ user: _user }) {
  return (
    <aside id="platformSidebar" aria-label="Platform navigation">
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-identity">
            <span className="sidebar-brand-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M2 10v4" />
                <path d="M6 6v12" />
                <path d="M10 3v18" />
                <path d="M14 7v10" />
                <path d="M18 5v14" />
                <path d="M22 11v2" />
              </svg>
            </span>
            <span className="sidebar-logo-text">SuiteRhythm</span>
          </div>
          <EngineStatusDot />
        </div>
        <span className="sidebar-tagline">Reactive Sound Studio</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-nav-group-label">Studio Modes</div>

        <button className="sidebar-nav-item active" data-section="dashboardPanel" aria-label="Home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Studio Home
        </button>

        <button className="sidebar-nav-item" data-section="dndAutoDetect" aria-label="Auto Detect">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Auto Detect
        </button>

        <button className="sidebar-nav-item" data-section="tableTopSection" aria-label="Table Top Games">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          Table Top RPG
        </button>

        <button className="sidebar-nav-item" data-section="storyTellerSection" aria-label="Story Teller">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Story Teller
        </button>

        <button className="sidebar-nav-item" data-section="creatorSection" aria-label="Creator">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Creator Studio
        </button>

        <button className="sidebar-nav-item" data-section="singSection" aria-label="Sing">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Sing Backing
        </button>

        <div className="sidebar-nav-group-label">Creative Tools</div>

        <button className="sidebar-nav-item" data-section="dndCreateCampaign" aria-label="Story Editor">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Story Editor
        </button>

        <button className="sidebar-nav-item" data-section="dndControlBoard" aria-label="Control Board">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Control Board
        </button>

        <button className="sidebar-nav-item" data-section="soundLibrarySection" aria-label="Sound Library">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Sound Library
        </button>

        <div className="sidebar-nav-group-label">Preferences</div>

        <button className="sidebar-nav-item" data-section="settingsSection" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-engine-pill">
          <span className="sidebar-engine-indicator" aria-hidden="true" />
          <span className="sidebar-engine-text">Sound Engine Ready</span>
        </div>
        <div className="sidebar-footer-actions">
          <button id="tutorialBtn" className="sidebar-action-btn" type="button">Quick Guide</button>
          <button id="feedbackBtn" className="sidebar-action-btn" type="button">Feedback</button>
          <a href="/admin/sounds" className="sidebar-action-btn">Audit</a>
        </div>
        <div className="sidebar-version-badge">
          <span>SuiteRhythm v3.6.4</span>
        </div>
      </div>
    </aside>
  );
}
