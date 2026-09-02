// ===== ERROR HANDLER - Centralized error handling with retry logic =====

import { CONFIG } from '../config.js';

/**
 * Circuit breaker states
 */
const CircuitState = {
    CLOSED: 'CLOSED',   // Normal operation
    OPEN: 'OPEN',       // Failing, reject immediately
    HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker implementation for API calls
 */
export class CircuitBreaker {
    constructor(name, threshold = CONFIG.NETWORK.CIRCUIT_BREAKER_THRESHOLD) {
        this.name = name;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.threshold = threshold;
        this.nextRetryTime = 0;
        this.lastFailureTime = 0;
    }
    
    /**
     * Execute function with circuit breaker protection
     * @param {Function} fn - Async function to execute
     * @returns {Promise<*>}
     */
    async execute(fn) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextRetryTime) {
                throw new Error(`Circuit breaker [${this.name}] is OPEN. Retry after ${new Date(this.nextRetryTime).toLocaleTimeString()}`);
            }
            // Try half-open
            this.state = CircuitState.HALF_OPEN;
            console.log(`Circuit breaker [${this.name}] entering HALF_OPEN state`);
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    onSuccess() {
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            console.log(`Circuit breaker [${this.name}] recovered to CLOSED state`);
        }
    }
    
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = CircuitState.OPEN;
            this.nextRetryTime = Date.now() + CONFIG.NETWORK.CIRCUIT_BREAKER_TIMEOUT;
            console.warn(`Circuit breaker [${this.name}] opened after ${this.failureCount} failures`);
        }
    }
    
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.nextRetryTime = 0;
        console.log(`Circuit breaker [${this.name}] manually reset`);
    }
    
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failureCount,
            threshold: this.threshold,
            nextRetry: this.nextRetryTime > Date.now() ? new Date(this.nextRetryTime) : null
        };
    }
}

/**
 * Exponential backoff retry logic
 */
export class RetryHandler {
    constructor(maxRetries = CONFIG.API.MAX_RETRIES, initialDelay = CONFIG.API.RETRY_DELAY) {
        this.maxRetries = maxRetries;
        this.initialDelay = initialDelay;
    }
    
    /**
     * Execute function with exponential backoff retry
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Retry options
     * @returns {Promise<*>}
     */
    async execute(fn, options = {}) {
        const {
            maxRetries = this.maxRetries,
            shouldRetry = () => true,
            onRetry = null
        } = options;
        
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Don't retry on final attempt
                if (attempt === maxRetries) {
                    break;
                }
                
                // Check if we should retry this error
                if (!shouldRetry(error)) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff and jitter
                const delay = this.initialDelay * Math.pow(CONFIG.API.RETRY_MULTIPLIER, attempt);
                const jitter = Math.random() * 0.3 * delay; // ±30% jitter
                const totalDelay = delay + jitter;
                
                console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms:`, error.message);
                
                if (onRetry) {
                    onRetry(attempt + 1, totalDelay, error);
                }
                
                await this.sleep(totalDelay);
            }
        }
        
        throw lastError;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Offline detector
 */
export class OfflineDetector {
    constructor(onOnline, onOffline) {
        this.isOnline = navigator.onLine;
        this.onOnline = onOnline;
        this.onOffline = onOffline;
        this.checkInterval = null;
        
        this.init();
    }
    
    init() {
        this._onlineHandler = () => this.handleOnline();
        this._offlineHandler = () => this.handleOffline();
        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);
        
        // Periodic health check
        this.checkInterval = setInterval(() => this.checkConnectivity(), CONFIG.NETWORK.OFFLINE_CHECK_INTERVAL);
    }
    
    handleOnline() {
        if (!this.isOnline) {
            this.isOnline = true;
            console.log('✓ Network connection restored');
            if (this.onOnline) this.onOnline();
        }
    }
    
    handleOffline() {
        if (this.isOnline) {
            this.isOnline = false;
            console.warn('⚠ Network connection lost');
            if (this.onOffline) this.onOffline();
        }
    }
    
    async checkConnectivity() {
        if (!navigator.onLine) {
            this.handleOffline();
            return;
        }
        
        // Skip connectivity check if no PING_URL configured (local prototype mode)
        if (!CONFIG.NETWORK.PING_URL) {
            this.handleOnline();
            return;
        }
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(CONFIG.NETWORK.PING_URL, {
                method: 'HEAD',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (response.ok) {
                this.handleOnline();
            } else {
                this.handleOffline();
            }
        } catch (error) {
            this.handleOffline();
        }
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this._onlineHandler) {
            window.removeEventListener('online', this._onlineHandler);
            this._onlineHandler = null;
        }
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
            this._offlineHandler = null;
        }
    }
}

/**
 * Error classifier for better error messages
 */
export class ErrorClassifier {
    static classify(error) {
        const message = String(error?.message || error || '').toLowerCase();
        
        if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
            return {
                type: 'NETWORK_ERROR',
                userMessage: 'Network connection issue. Please check your internet connection.',
                retryable: true
            };
        }
        
        if (message.includes('429') || message.includes('rate limit')) {
            return {
                type: 'RATE_LIMIT',
                userMessage: 'Too many requests. Please wait a moment and try again.',
                retryable: true
            };
        }
        
        if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) {
            return {
                type: 'AUTH_ERROR',
                userMessage: 'Invalid API key. Please check your settings.',
                retryable: false
            };
        }
        
        if (message.includes('404')) {
            return {
                type: 'NOT_FOUND',
                userMessage: 'Resource not found. This sound may be unavailable.',
                retryable: false
            };
        }
        
        if (message.includes('500') || message.includes('502') || message.includes('503')) {
            return {
                type: 'SERVER_ERROR',
                userMessage: 'Server error. The service may be temporarily unavailable.',
                retryable: true
            };
        }
        
        if (message.includes('circuit breaker')) {
            return {
                type: 'CIRCUIT_OPEN',
                userMessage: 'Service temporarily unavailable. Retrying automatically...',
                retryable: true
            };
        }
        
        return {
            type: 'UNKNOWN_ERROR',
            userMessage: 'An unexpected error occurred. Please try again.',
            retryable: true
        };
    }
    
    static shouldRetry(error) {
        const classified = this.classify(error);
        return classified.retryable;
    }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandlers() {
    const onUnhandledRejection = (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
        
        const classified = ErrorClassifier.classify(event.reason);
        if (CONFIG.DEBUG_MODE) {
            console.error('Classified as:', classified);
        }
    };
    const onError = (event) => {
        console.error('Global error:', event.error);
        
        const classified = ErrorClassifier.classify(event.error);
        if (CONFIG.DEBUG_MODE) {
            console.error('Classified as:', classified);
        }
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    
    // Catch global errors
    window.addEventListener('error', onError);

    return () => {
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
        window.removeEventListener('error', onError);
    };
}

export default {
    CircuitBreaker,
    RetryHandler,
    OfflineDetector,
    ErrorClassifier,
    setupGlobalErrorHandlers
};
