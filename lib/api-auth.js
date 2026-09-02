/**
 * Server-side API authentication via HMAC-signed tokens.
 *
 * Token format: `<timestamp>.<hmac-hex>`
 *   - timestamp = Date.now() when token was issued
 *   - hmac = HMAC-SHA256(API_AUTH_SECRET, timestamp)
 *
 * Requires env var: API_AUTH_SECRET (any strong random string, 32+ chars).
 * Public beta access is currently enabled, so route guards allow anonymous use.
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
function hasPublicBetaAccess() {
  return process.env.PUBLIC_BETA_ACCESS !== 'false';
}

function getSecret() {
  return process.env.API_AUTH_SECRET || '';
}

function canBypassForLocalDev() {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Generate a signed short-lived token.
 * @returns {string} token in `timestamp.hmac` format
 */
export function generateToken() {
  if (hasPublicBetaAccess() && !getSecret()) return 'public-beta-access';
  const secret = getSecret();
  if (!secret) throw new Error('API_AUTH_SECRET not configured');
  const ts = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}.${hmac}`;
}

/**
 * Validate a token string.
 * @param {string} token
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateToken(token) {
  if (hasPublicBetaAccess() && token === 'public-beta-access') return { valid: true };
  const secret = getSecret();
  if (!secret) {
    return hasPublicBetaAccess() || canBypassForLocalDev()
      ? { valid: true }
      : { valid: false, error: 'API auth is not configured' };
  }
  if (!token) return { valid: false, error: 'Missing token' };

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return { valid: false, error: 'Invalid token format' };

  const ts = token.slice(0, dotIdx);
  const hmac = token.slice(dotIdx + 1);

  if (!ts || !hmac) return { valid: false, error: 'Invalid token format' };

  const expected = crypto.createHmac('sha256', secret).update(ts).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (hmac.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return { valid: false, error: 'Invalid token' };
  }

  const age = Date.now() - parseInt(ts, 10);
  if (Number.isNaN(age) || age > TOKEN_TTL_MS || age < 0) {
    return { valid: false, error: 'Token expired' };
  }

  return { valid: true };
}

/**
 * Express-style auth guard for API routes.
 * Returns null if authorized, or a NextResponse 401 error to return immediately.
 *
 * Usage in a route handler:
 *   const denied = requireAuth(request);
 *   if (denied) return denied;
 *
 * @param {Request} request
 * @returns {NextResponse|null}
 */
export function requireAuth(request) {
  if (hasPublicBetaAccess()) return null;

  const secret = getSecret();
  if (!secret) {
    if (canBypassForLocalDev()) {
      console.warn('[auth] API_AUTH_SECRET not set — auth bypassed. Set it in production!');
      return null;
    }
    return NextResponse.json(
      { error: 'API auth is not configured' },
      { status: 503 }
    );
  }

  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const result = validateToken(auth.slice(7));
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error || 'Invalid token' },
      { status: 401 }
    );
  }

  return null; // authorized
}
