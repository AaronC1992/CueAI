const SPECIAL_URL_RE = /^(?:blob:|data:)/i;
const HTTP_URL_RE = /^https?:\/\//i;
const URL_BASE = 'https://suiterhythm.local';
export const DEFAULT_R2_AUDIO_BASE = '/r2-audio';

function decodePathSegment(segment) {
    let current = String(segment || '');
    for (let i = 0; i < 3; i += 1) {
        try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) break;
            current = decoded;
        } catch (_) {
            break;
        }
    }
    return current;
}

export function encodeAudioPath(path) {
    return String(path || '')
        .split('/')
        .map((segment) => encodeURIComponent(decodePathSegment(segment)))
        .join('/');
}

function migrateLegacySoundPrefix(path) {
    return String(path || '').replace(/^\/?Saved%20sounds\//i, (match) => match.startsWith('/') ? '/sounds/' : 'sounds/');
}

export function normalizeAudioUrl(input) {
    const value = String(input || '').trim();
    if (!value || SPECIAL_URL_RE.test(value)) return value;

    if (HTTP_URL_RE.test(value)) {
        try {
            const url = new URL(value);
            url.pathname = migrateLegacySoundPrefix(encodeAudioPath(url.pathname));
            return url.toString();
        } catch (_) {
            return migrateLegacySoundPrefix(encodeAudioPath(value));
        }
    }

    try {
        const hadLeadingSlash = value.startsWith('/');
        const url = new URL(value, URL_BASE);
        const encodedPath = migrateLegacySoundPrefix(encodeAudioPath(url.pathname));
        const path = hadLeadingSlash ? encodedPath : encodedPath.replace(/^\//, '');
        return `${path}${url.search}${url.hash}`;
    } catch (_) {
        return migrateLegacySoundPrefix(encodeAudioPath(value));
    }
}

/**
 * Base URL for catalog audio. Defaults to the same-origin Next.js proxy.
 * Set NEXT_PUBLIC_R2_CDN_URL to a custom domain with CORS enabled to skip the
 * proxy hop and let the browser hit Cloudflare directly.
 */
export function getConfiguredAudioBase() {
    const configured = String(process.env.NEXT_PUBLIC_R2_CDN_URL || '').trim().replace(/\/+$/, '');
    return configured || DEFAULT_R2_AUDIO_BASE;
}

export function getR2AudioBase() {
    const runtimeOverride = typeof window !== 'undefined' ? window.__R2_PUBLIC_URL : '';
    return String(runtimeOverride || '').trim() || getConfiguredAudioBase();
}

export function stripR2AudioPrefix(source) {
    return String(source || '').replace(/^\/+/, '').replace(/^r2-audio\//i, '');
}

export function isSavedSoundsPath(source) {
    return /^(?:sounds|Saved%20sounds)\//i.test(stripR2AudioPrefix(normalizeAudioUrl(source)));
}

export function joinAudioUrlBase(base, source) {
    const cleanedBase = String(base || '').trim().replace(/\/+$/, '');
    const cleanedSource = stripR2AudioPrefix(normalizeAudioUrl(source));
    return cleanedBase ? `${cleanedBase}/${cleanedSource}` : cleanedSource;
}
