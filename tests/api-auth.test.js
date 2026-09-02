import { afterEach, describe, expect, it } from 'vitest';
import { generateToken, requireAuth, validateToken } from '../lib/api-auth.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalApiAuthSecret = process.env.API_AUTH_SECRET;
const originalPublicBetaAccess = process.env.PUBLIC_BETA_ACCESS;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalApiAuthSecret === undefined) delete process.env.API_AUTH_SECRET;
  else process.env.API_AUTH_SECRET = originalApiAuthSecret;
  if (originalPublicBetaAccess === undefined) delete process.env.PUBLIC_BETA_ACCESS;
  else process.env.PUBLIC_BETA_ACCESS = originalPublicBetaAccess;
});

describe('API authentication', () => {
  it('allows anonymous API access during the public beta', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_AUTH_SECRET;
    delete process.env.PUBLIC_BETA_ACCESS;

    const token = generateToken();

    expect(token).toBe('public-beta-access');
    expect(validateToken(token)).toEqual({ valid: true });
    expect(requireAuth(new Request('https://example.test/api'))).toBeNull();
  });

  it('can still fail closed when public beta access is disabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_AUTH_SECRET;
    process.env.PUBLIC_BETA_ACCESS = 'false';

    expect(() => generateToken()).toThrow('API_AUTH_SECRET not configured');
    expect(validateToken('123.invalid')).toEqual({ valid: false, error: 'API auth is not configured' });
    expect(requireAuth(new Request('https://example.test/api'))?.status).toBe(503);
  });

  it('signs and validates tokens when API_AUTH_SECRET is configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_SECRET = 'test-secret-that-is-not-a-production-secret';
    process.env.PUBLIC_BETA_ACCESS = 'false';

    const token = generateToken();
    expect(validateToken(token)).toEqual({ valid: true });
  });
});