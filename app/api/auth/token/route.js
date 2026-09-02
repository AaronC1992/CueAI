/**
 * GET /api/auth/token
 * Issues a short lived HMAC signed token for authenticating API calls.
 */

import { NextResponse } from 'next/server';
import { generateToken } from '../../../../lib/api-auth.js';
import { checkRateLimit, rateLimitHeaders } from '../../../../lib/rate-limit.js';

export async function GET(request) {
  const rate = checkRateLimit(request, {
    namespace: 'auth-token',
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const token = generateToken();
    return NextResponse.json({ token, expiresIn: 3600 });
  } catch {
    return NextResponse.json(
      { token: null, expiresIn: 0 },
      { status: 200 }
    );
  }
}
