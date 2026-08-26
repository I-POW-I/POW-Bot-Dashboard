import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifies the `Authorization: Bearer <BOT_API_TOKEN>` header used by the bot
 * on /api/bot/* routes. Uses a constant-time comparison instead of `===` —
 * a plain string compare short-circuits on the first mismatched character,
 * which leaks timing information an attacker can use to guess the token
 * byte-by-byte. This endpoint is unauthenticated Discord-user-wise (no
 * session cookie), so the bearer token is the only thing standing between
 * it and anyone on the internet — worth doing properly.
 *
 * Returns null if authorized, or a NextResponse to return immediately if not.
 */
export function requireBotToken(req: NextRequest): NextResponse | null {
  const expected = process.env.BOT_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'BOT_API_TOKEN not configured' }, { status: 500 });
  }

  const provided = req.headers.get('authorization') || '';
  const expectedHeader = `Bearer ${expected}`;

  const a = Buffer.from(provided);
  const b = Buffer.from(expectedHeader);

  // timingSafeEqual throws on length mismatch, so guard first — that early
  // return is fine because the lengths themselves aren't secret.
  const authorized = a.length === b.length && timingSafeEqual(a, b);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
