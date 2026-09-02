'use client';

/**
 * AppShell — the main "use client" component for SuiteRhythm.
 *
 * ARCHITECTURE DECISION:
 * The SuiteRhythm audio engine (engine/SuiteRhythm.js) is a 7,000+ line class
 * that orchestrates audio playback, speech recognition, and UI state through
 * direct DOM manipulation (getElementById, addEventListener, classList).
 * A full conversion to React state/hooks would be a multi-month rewrite with
 * high regression risk. Instead, this component:
 *   1. Renders the full DOM scaffold as JSX (all sections are always in the DOM,
 *      hidden via CSS, exactly as the original HTML — so SuiteRhythm can find
 *      elements by ID at any time).
 *   2. Dynamically imports and instantiates SuiteRhythm in useEffect after mount,
 *      exactly replicating the original DOMContentLoaded init sequence.
 *   3. Cleans up on unmount.
 *
 * Future path: individual sections can be progressively converted to manage their
 * own state via React as the engine is refactored incrementally.
 */

import { useEffect } from 'react';
import { getConfiguredAudioBase } from '../lib/modules/audio-url';
import ErrorBoundary from './ErrorBoundary';
import { EngineProvider } from '../lib/engine-bridge';
import Sidebar from './Sidebar';
import NowPlayingStrip from './NowPlayingStrip';
import CalibrationChecklist from './CalibrationChecklist';
import DashboardSection from './sections/DashboardSection';
import AutoDetectSection from './sections/AutoDetectSection';
import StoryEditorSection from './sections/StoryEditorSection';
import ControlBoardSection from './sections/ControlBoardSection';
import SoundLibrarySection from './sections/SoundLibrarySection';
import SettingsSection from './sections/SettingsSection';
import CreatorSection from './sections/CreatorSection';
import TableTopSection from './sections/TableTopSection';
import StoryTellerSection from './sections/StoryTellerSection';
import SingSection from './sections/SingSection';
import {
  FeedbackModal,
  LoadingOverlay,
  StoryContextModal,
  StoryOverlay,
  DemoSelectorOverlay,
} from './modals/Modals';

export default function AppShell({ user }) {
  useEffect(() => {
    // Strip any legacy ?sr-sw=... query param from older SW versions that used to
    // force-navigate clients on activation.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('sr-sw')) {
        url.searchParams.delete('sr-sw');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}` || '/');
      }
    } catch (_) { /* ignore */ }

    if (!('serviceWorker' in navigator)) return undefined;

    let banner = null;
    let pendingReload = false;
    const showUpdateBanner = () => {
      if (pendingReload || banner) return;
      // If the tab isn't visible, just reload silently — no in-flight UX to lose.
      if (typeof document !== 'undefined' && document.hidden) {
        pendingReload = true;
        window.location.reload();
        return;
      }
      try {
        banner = document.createElement('div');
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#1f6feb;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);font:14px/1.4 system-ui,sans-serif;display:flex;gap:10px;align-items:center;';
        const text = document.createElement('span');
        text.textContent = 'A new version is available.';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Reload';
        btn.style.cssText = 'background:#fff;color:#1f6feb;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;';
        btn.addEventListener('click', () => { pendingReload = true; window.location.reload(); });
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.setAttribute('aria-label', 'Dismiss update notice');
        dismiss.textContent = '\u00d7';
        dismiss.style.cssText = 'background:transparent;color:#fff;border:none;font-size:18px;cursor:pointer;line-height:1;';
        dismiss.addEventListener('click', () => { try { banner?.remove(); } catch (_) {} banner = null; });
        banner.append(text, btn, dismiss);
        document.body.appendChild(banner);
      } catch (_) { /* DOM not ready */ }
    };

    const handleSwMessage = (event) => {
      if (event?.data?.type === 'SR_SW_UPDATE_AVAILABLE') showUpdateBanner();
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      registration.update().catch(() => {});
    }).catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      try { banner?.remove(); } catch (_) {}
    };
  }, []);
  useEffect(() => {
    let engineInstance = null;
    let initialized = false;
    let cancelled = false;
    let destroyEnhancements = null;

    async function initApp() {
      if (initialized) return;
      initialized = true;

      // Set backend URL before anything else (mirrors the inline script in old index.html)
      if (typeof window !== 'undefined') {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        if (backendUrl) {
          window.SuiteRhythm_BACKEND_URL = backendUrl;
        }
        window.__R2_PUBLIC_URL = getConfiguredAudioBase();
      }

      try {
        // 1. Initialize enhancement modules (performance, memory, accessibility, offline detection)
        const { initEnhancements } = await import('../lib/integration');
        if (cancelled) return;
        destroyEnhancements = initEnhancements();
      } catch (e) {
        console.warn('[AppShell] Integration module init failed:', e);
      }

      try {
        // 2. Prime the API module so it sets window.fetchSounds / window.analyzeTranscript globals
        //    that the engine still uses during the transition period.
        await import('../lib/api');
      } catch (e) {
        console.warn('[AppShell] API module init failed:', e);
      }

      try {
        // 3. Import and instantiate the SuiteRhythm engine. Dynamic import keeps it
        //    out of the server bundle entirely (ssr:false on the dashboard page gives
        //    a second layer of protection, but being explicit here is safer).
        const { default: SuiteRhythm, initializeMenuToggles } = await import('../engine/SuiteRhythm');
        const instance = new SuiteRhythm();
        if (cancelled) {
          instance.destroy?.();
          return;
        }
        engineInstance = instance;
        window.gameInstance = instance;

        // 4. Wire up settings accordion toggles (was a standalone function in game.js)
        initializeMenuToggles();
      } catch (e) {
        console.error('[AppShell] SuiteRhythm engine failed to start:', e);
        // Show user-visible error if the engine fails to initialize
        const app = document.getElementById('appContainer');
        if (app) {
          const banner = document.createElement('div');
          banner.className = 'no-key-banner';
          banner.style.cssText = 'background:rgba(255,60,60,0.12);border-color:#ff4444;margin:12px;border-radius:8px;padding:12px 16px;';
          const title = document.createElement('strong');
          title.textContent = 'Engine failed to start.';
          banner.append(title, document.createTextNode(' Try reloading the page. If the problem persists, clear your browser cache.'));
          app.prepend(banner);
        }
      }

      // 5. Safety net: if the app container ended up hidden for any reason, force it visible
      if (cancelled) return;

      const app = document.getElementById('appContainer');
      if (app && app.classList.contains('hidden')) {
        console.warn('[AppShell] appContainer hidden after init — forcing visible');
        app.classList.remove('hidden');
        app.style.display = 'block';
      }
    }

    initApp();

    // Cleanup on unmount (navigating away from /dashboard)
    return () => {
      cancelled = true;
      try {
        engineInstance?.destroy?.();
      } catch (_) {}
      try {
        destroyEnhancements?.();
      } catch (_) {}
      window.gameInstance = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <EngineProvider>
      {/* Skip link for accessibility */}
      <a className="skip-link" href="#appContainer">
        Skip to main content
      </a>

      {/* ===== MAIN APPLICATION ===== */}
      <div id="appContainer" role="main">
        <div id="platformShell">
          {/* Left sidebar navigation */}
          <Sidebar user={user} />

          {/* Mobile top bar */}
          <header id="mobileTopbar" className="mobile-topbar">
            <button
              id="sidebarToggle"
              className="sidebar-toggle-btn"
              aria-label="Toggle navigation menu"
              aria-expanded="false"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="mobile-brand">SuiteRhythm</span>
            <span id="mobileSectionName" className="mobile-section-name" aria-live="polite"></span>
            <span id="noKeyBannerMobile" className="mobile-no-key hidden">Sound Studio</span>
          </header>

          {/* Mobile sidebar overlay */}
          <div id="sidebarBackdrop" className="sidebar-backdrop hidden" />

          {/* ===== MAIN CONTENT ===== */}
          <main id="platformMain">
            {/* Live engine status bar — reactive via useEngine() */}
            <NowPlayingStrip />
            <CalibrationChecklist />

            {/* Firefox compatibility warning — shown only in Firefox by the engine */}
            <div
              id="firefoxWarning"
              className="no-key-banner hidden"
              style={{
                background: 'rgba(255,140,0,0.12)',
                borderColor: 'darkorange',
                margin: 12,
                borderRadius: 8,
              }}
            >
              <span>
                Auto Detect and Story modes require Chrome or Edge for microphone access. Firefox
                does not support the Web Speech API used by SuiteRhythm.
              </span>
              <button
                onClick={(e) => e.currentTarget.closest('#firefoxWarning')?.classList.add('hidden')}
              >
                Dismiss
              </button>
            </div>

            {/* All app sections — always rendered, shown/hidden by engine via CSS class */}
            <DashboardSection />
            <StoryEditorSection />
            <SoundLibrarySection />
            <SettingsSection />
            <AutoDetectSection />
            <CreatorSection />
            <TableTopSection />
            <StoryTellerSection />
            <SingSection />
            <ControlBoardSection />
          </main>
        </div>
      </div>

      {/* Body level modals and overlays */}
      <FeedbackModal />
      <LoadingOverlay />
      <StoryContextModal />
      <StoryOverlay />
      <DemoSelectorOverlay />
      </EngineProvider>
    </ErrorBoundary>
  );
}
