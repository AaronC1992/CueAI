import { NextResponse } from 'next/server';
import { clearAuthCookies, safeRedirectPath } from '../../../../lib/auth.js';

export async function GET(request) {
  const url = new URL(request.url);
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect'));
  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  clearAuthCookies(response.cookies);
  return response;
}
