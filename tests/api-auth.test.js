import { afterEach, describe, expect, it } from 'vitest';
import { generateToken, requireAuth, validateToken } from '../lib/api-auth.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalApiAuthSecret = process.env.API_AUTH_SECRET;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalApiAuthSecret === undefined) delete process.env.API_AUTH_SECRET;
  else process.env.API_AUTH_SECRET = originalApiAuthSecret;
});

describe('API authentication', () => {
  it('fails closed in production when API_AUTH_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_AUTH_SECRET;

    expect(() => generateToken()).toThrow('API_AUTH_SECRET not configured');
    expect(validateToken('123.invalid')).toEqual({ valid: false, error: 'API auth is not configured' });
    expect(requireAuth(new Request('https://example.test/api'))?.status).toBe(503);
  });

  it('signs and validates tokens when API_AUTH_SECRET is configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_SECRET = 'test-secret-that-is-not-a-production-secret';

    const token = generateToken();
    expect(validateToken(token)).toEqual({ valid: true });
  });
});