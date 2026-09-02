// ===== INTEGRATION HELPER - Patches for existing game.js =====
// This file provides helper functions to integrate new modules without rewriting entire game.js

import { CONFIG } from './config.js';
import { LRUCache, MemoryMonitor, CacheManager } from './modules/memory-manager.js';
import PerformanceMonitor from './modules/performance-monitor.js';
import { CircuitBreaker, RetryHandler, OfflineDetector, setupGlobalErrorHandlers, ErrorClassifier } from './modules/error-handler.js';
import { initAccessibility, announceToScreenReader } from './modules/accessibility.js';

// Global instances
export const globals = {
    performanceMonitor: new PerformanceMonitor(),
    memoryMonitor: new MemoryMonitor(),
    cacheManager: new CacheManager(),
    backendCircuit: new CircuitBreaker('backend', CONFIG.NETWORK?.CIRCUIT_BREAKER_THRESHOLD || 5),
    openaiCircuit: new CircuitBreaker('openai', CONFIG.NETWORK?.CIRCUIT_BREAKER_THRESHOLD || 5),
    retryHandler: new RetryHandler(),
    offlineDetector: null
};

let teardownEnhancements = null;

/**
 * Initialize all enhancement modules
 */
export function initEnhancements() {
    teardownEnhancements?.();
    if (CONFIG.DEBUG_MODE) console.log(`[SuiteRhythm] Initializing enhancements v${CONFIG.VERSION}...`);
    const cleanups = [];
    
    // 1. Setup global error handlers
    cleanups.push(setupGlobalErrorHandlers());
    
    // 2. Start performance monitoring
    if (CONFIG.PERFORMANCE?.ENABLE_METRICS) {
        globals.performanceMonitor.startSession();
        globals.performanceMonitor.startReporting();
        cleanups.push(() => {
            globals.performanceMonitor.stopReporting();
            globals.performanceMonitor.endSession();
        });
    }
    
    // 3. Start memory monitoring
    globals.memoryMonitor.start();
    globals.memoryMonitor.onCritical = (memMB) => {
        console.warn(`Critical memory: ${memMB}MB - triggering emergency cleanup`);
        window.dispatchEvent(new CustomEvent('SuiteRhythm:memory-critical', { detail: { memoryUsageMB: memMB } }));
    };
    
    // 4. Start cache management
    globals.cacheManager.start();
    
    // 5. Initialize accessibility features
    try {
        const a11y = initAccessibility();
        window.SuiteRhythm_Accessibility = a11y;
        cleanups.push(() => a11y.destroy());
        
        // Set up keyboard event listeners
        setupKeyboardEvents();

        // Set up modal focus trapping
        setupModalFocusTrap();
    } catch (e) {
        console.warn('[SuiteRhythm] Accessibility initialization failed:', e);
    }
    
    // 6. Setup offline detection
    globals.offlineDetector = new OfflineDetector(
        () => handleOnlineStatus(true),
        () => handleOnlineStatus(false)
    );
    cleanups.push(() => {
        globals.offlineDetector?.destroy();
        globals.offlineDetector = null;
    });
    
    // 7. Expose globals for debugging
    if (CONFIG.DEBUG_MODE) {
        window.SuiteRhythm_Globals = globals;
        window.SuiteRhythm_PerformanceReport = () => console.table(globals.performanceMonitor.generateReport());
        window.SuiteRhythm_MemoryStats = () => console.table(globals.memoryMonitor.getStats());
        window.SuiteRhythm_CacheStats = () => console.table(globals.cacheManager.getAllStats());
    }
    
    if (CONFIG.DEBUG_MODE) console.log('[SuiteRhythm] ✓ All enhancements initialized');

    // Fallback: ensure main app container becomes visible after backend check
    const visibilityTimer = setTimeout(() => {
        try {
            const app = document.getElementById('appContainer');
            const modal = document.getElementById('subscribeModal');
            // If backend should be available (health check succeeded is logged) and modal is hidden, force show app
            const healthLogFound = (window.performance?.getEntriesByType('resource') || []).some(r => /\/health/.test(r.name));
            if (app && app.classList.contains('hidden') && (!modal || modal.classList.contains('hidden'))) {
                console.warn('[SuiteRhythm] App container still hidden after init; forcing visible');
                app.classList.remove('hidden');
                app.style.display = 'block';
            }
        } catch (e) {
            console.warn('[SuiteRhythm] Fallback visibility check failed:', e);
        }
    }, 2500);
    cleanups.push(() => clearTimeout(visibilityTimer));
    cleanups.push(() => globals.memoryMonitor.stop());
    cleanups.push(() => globals.cacheManager.stop());

    teardownEnhancements = () => {
        for (const cleanup of cleanups.splice(0).reverse()) cleanup?.();
        teardownEnhancements = null;
    };

    return teardownEnhancements;
}

/**
 * Setup keyboard event handlers
 */
const _eventHandlers = [];

function setupKeyboardEvents() {
    // Prevent duplicate listeners on re-init
    cleanupKeyboardEvents();
    
    function on(eventName, handler) {
        window.addEventListener(eventName, handler);
        _eventHandlers.push({ eventName, handler });
    }
    
    // Listen for custom events from keyboard shortcuts
    on('SuiteRhythm:toggle-listening', () => {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn && !startBtn.classList.contains('hidden')) {
            startBtn.click();
        } else if (stopBtn && !stopBtn.classList.contains('hidden')) {
            stopBtn.click();
        }
    });
    
    on('SuiteRhythm:toggle-music', () => {
        const toggleMusic = document.getElementById('toggleMusic');
        if (toggleMusic) {
            toggleMusic.checked = !toggleMusic.checked;
            toggleMusic.dispatchEvent(new Event('change'));
        }
    });
    
    on('SuiteRhythm:toggle-sfx', () => {
        const toggleSfx = document.getElementById('toggleSfx');
        if (toggleSfx) {
            toggleSfx.checked = !toggleSfx.checked;
            toggleSfx.dispatchEvent(new Event('change'));
        }
    });
    
    on('SuiteRhythm:stop-all', () => {
        const stopAudioBtn = document.getElementById('stopAudioBtn');
        if (stopAudioBtn) {
            stopAudioBtn.click();
        }
    });
    
    on('SuiteRhythm:volume-up', () => {
        const musicLevel = document.getElementById('musicLevel');
        if (musicLevel) {
            musicLevel.value = Math.min(100, parseInt(musicLevel.value) + 10);
            musicLevel.dispatchEvent(new Event('input'));
        }
    });
    
    on('SuiteRhythm:volume-down', () => {
        const musicLevel = document.getElementById('musicLevel');
        if (musicLevel) {
            musicLevel.value = Math.max(0, parseInt(musicLevel.value) - 10);
            musicLevel.dispatchEvent(new Event('input'));
        }
    });
    
    on('SuiteRhythm:close-modal', () => {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.close-btn, [id*="close"], [id*="cancel"]');
            if (closeBtn) {
                closeBtn.click();
            }
        });
    });
}

function cleanupKeyboardEvents() {
    for (const { eventName, handler } of _eventHandlers) {
        window.removeEventListener(eventName, handler);
    }
    _eventHandlers.length = 0;
}

/**
 * Focus trap for modals — uses MutationObserver to auto-activate
 * when any .modal has its .hidden class removed.
 */
function setupModalFocusTrap() {
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function trapFocus(modal) {
        const focusable = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (!focusable.length) return null;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        function handler(e) {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }

        modal.addEventListener('keydown', handler);
        first.focus();
        return handler;
    }

    const activeTraps = new Map();

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
            const modal = m.target;
            if (!modal.classList.contains('modal')) continue;

            if (!modal.classList.contains('hidden')) {
                if (!activeTraps.has(modal)) {
                    const handler = trapFocus(modal);
                    if (handler) activeTraps.set(modal, handler);
                }
            } else {
                const handler = activeTraps.get(modal);
                if (handler) {
                    modal.removeEventListener('keydown', handler);
                    activeTraps.delete(modal);
                }
            }
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
}

/**
 * Handle online/offline status changes
 */
function handleOnlineStatus(isOnline) {
    const statusEl = document.getElementById('statusText');
    if (!statusEl) return;
    
    if (isOnline) {
        statusEl.textContent = '✓ Connection restored';
        statusEl.className = 'status-text status-success';
        announceToScreenReader('Network connection restored');
        
        // Clear status after 3 seconds
        setTimeout(() => {
            if (statusEl.textContent.includes('restored')) {
                statusEl.textContent = 'Ready to listen...';
                statusEl.className = 'status-text status-info';
            }
        }, 3000);
    } else {
        statusEl.textContent = '⚠ Offline - some features may be limited';
        statusEl.className = 'status-text status-warning';
        announceToScreenReader('Network connection lost. Some features may be limited.', 'assertive');
    }
}

/**
 * Create enhanced fetch with circuit breaker and retry
 */
export async function enhancedFetch(url, options = {}, circuitBreaker = null) {
    const startTime = performance.now();
    
    try {
        const fetchFn = async () => {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;
        };
        
        let result;
        if (circuitBreaker) {
            result = await circuitBreaker.execute(fetchFn);
        } else {
            result = await globals.retryHandler.execute(fetchFn, {
                shouldRetry: (error) => ErrorClassifier.classify(error).retryable
            });
        }
        
        const duration = performance.now() - startTime;
        globals.performanceMonitor.trackAIResponse(duration, true);
        
        return result;
    } catch (error) {
        const duration = performance.now() - startTime;
        globals.performanceMonitor.trackAIResponse(duration, false);
        globals.performanceMonitor.trackError(error, 'enhancedFetch');
        
        const classified = ErrorClassifier.classify(error);
        console.error(`[Fetch Error] ${classified.type}:`, classified.userMessage);
        
        throw error;
    }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (CONFIG.PERFORMANCE?.ENABLE_METRICS) {
        globals.performanceMonitor.endSession();
        
        if (CONFIG.DEBUG_MODE) {
            const report = globals.performanceMonitor.generateReport();
            console.log('[SuiteRhythm] Final performance report:', report);
        }
    }
    
    globals.memoryMonitor.stop();
    globals.cacheManager.stop();
    
    if (globals.offlineDetector) {
        globals.offlineDetector.destroy();
    }
});

export default {
    globals,
    initEnhancements,
    enhancedFetch
};
