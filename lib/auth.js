import crypto from 'crypto';
import { cookies } from 'next/headers';

export const AUTH_ACCESS_COOKIE = 'suiterhythm_access_token';
export const AUTH_REFRESH_COOKIE = 'suiterhythm_refresh_token';
export const AUTH_TESTER_COOKIE = 'suiterhythm_tester_session';

const TESTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function getTesterUsername() {
  return process.env.BETA_TESTER_USERNAME || 'tester';
}

function getTesterPassword() {
  return process.env.BETA_TESTER_PASSWORD || 'password';
}

function isTesterLoginEnabled() {
  return process.env.BETA_TESTER_ENABLED !== 'false' && Boolean(getTesterUsername() && getTesterPassword());
}

function getAuthSecret() {
  const secret = process.env.BETA_AUTH_SECRET || process.env.API_AUTH_SECRET || '';
  if (secret) return secret;
  return process.env.NODE_ENV === 'production' ? '' : 'dev-only-suiterhythm-tester-auth';
}

export function isAuthConfigured() {
  return true;
}

function constantTimeEqual(actualValue, expectedValue) {
  const actualBuffer = Buffer.from(String(actualValue), 'utf8');
  const expectedBuffer = Buffer.from(String(expectedValue), 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    const maxLength = Math.max(actualBuffer.length, expectedBuffer.length, 1);
    const paddedActual = Buffer.alloc(maxLength);
    const paddedExpected = Buffer.alloc(maxLength);
    actualBuffer.copy(paddedActual);
    expectedBuffer.copy(paddedExpected);
    crypto.timingSafeEqual(paddedActual, paddedExpected);
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function credentialFingerprint() {
  return crypto
    .createHash('sha256')
    .update(`${getTesterUsername().toLowerCase()}:${getTesterPassword()}`)
    .digest('hex');
}

function signPayload(payload) {
  const secret = getAuthSecret();
  if (!secret) throw new Error('BETA_AUTH_SECRET or API_AUTH_SECRET is required for tester login');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(payload) {
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function createTesterSession(username) {
  const payload = encodePayload({
    kind: 'tester',
    username,
    credential: credentialFingerprint(),
    expiresAt: Date.now() + TESTER_COOKIE_MAX_AGE * 1000,
  });
  return `${payload}.${signPayload(payload)}`;
}

function validateTesterSession(token) {
  if (!isAuthConfigured() || !token) return { valid: false, error: 'Missing session' };

  try {
    const separatorIndex = token.lastIndexOf('.');
    if (separatorIndex <= 0) return { valid: false, error: 'Invalid session' };

    const payload = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    const expectedSignature = signPayload(payload);
    if (!constantTimeEqual(signature, expectedSignature)) {
      return { valid: false, error: 'Invalid session' };
    }

    const parsed = decodePayload(payload);
    if (parsed.kind !== 'tester') return { valid: false, error: 'Invalid session' };
    if (parsed.username !== getTesterUsername()) return { valid: false, error: 'Tester login changed' };
    if (parsed.credential !== credentialFingerprint()) return { valid: false, error: 'Tester password changed' };
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      return { valid: false, error: 'Session expired' };
    }

    return { valid: true, username: parsed.username };
  } catch {
    return { valid: false, error: 'Invalid session' };
  }
}

export function authenticateTester(username, password) {
  return true;
}

export function testerUser() {
  return {
    id: `tester:${getTesterUsername()}`,
    username: getTesterUsername(),
    plan: 'free_tester',
    freeAccess: true,
  };
}

export function setTesterAuthCookie(cookieJar) {
  cookieJar.set(AUTH_TESTER_COOKIE, createTesterSession(getTesterUsername()), cookieOptions(TESTER_COOKIE_MAX_AGE));
}

export function clearAuthCookies(cookieJar) {
  cookieJar.set(AUTH_TESTER_COOKIE, '', cookieOptions(0));
  cookieJar.set(AUTH_ACCESS_COOKIE, '', cookieOptions(0));
  cookieJar.set(AUTH_REFRESH_COOKIE, '', cookieOptions(0));
}

export function safeRedirectPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/api/')) return fallback;
  if (value.startsWith('/login')) return fallback;
  return value;
}

export function loginPath(redirectTo = '/') {
  return safeRedirectPath(redirectTo);
}

export async function getAuthState() {
  return { user: testerUser(), needsRefresh: false, error: null };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username || user.email || '',
    email: user.email || '',
    plan: user.plan || '',
    freeAccess: Boolean(user.freeAccess),
  };
}
