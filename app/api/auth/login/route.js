import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders } from '../../../../lib/rate-limit.js';
import { publicUser, setTesterAuthCookie, testerUser } from '../../../../lib/auth.js';

export async function POST(request) {
  const rate = checkRateLimit(request, {
    namespace: 'account-login',
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again shortly.' },
      { status: 429, headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const response = NextResponse.json({ user: publicUser(testerUser()) });
    setTesterAuthCookie(response.cookies);
    return response;
  } catch (error) {
    console.error('[/api/auth/login]', error);
    return NextResponse.json({ error: 'Login failed. Try again shortly.' }, { status: 500 });
  }
}
