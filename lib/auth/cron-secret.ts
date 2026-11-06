import { NextResponse } from 'next/server';

export function matchesCronSecret(value: string, secret: string): boolean {
  const left = new TextEncoder().encode((value ?? '').trim());
  const right = new TextEncoder().encode((secret ?? '').trim());
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left[i] ^ right[i];
  }
  return mismatch === 0;
}

export function assertCronSecretEdge(request: {
  headers: Headers | { get(name: string): string | null };
}): {
  ok: true;
  userId: string;
  verified: boolean;
  emails: string[];
} | {
  ok: false;
  response: NextResponse;
  error: string;
  status: number;
} {
  const secret = process.env.CRON_SECRET || process.env.CUSTOMER_INVITE_EXPIRE_SECRET || '';
  if (!secret) {
    const response = NextResponse.json(
      { error: 'CRON_SECRET not configured', code: 'NO_CRON_SECRET' },
      { status: 503 }
    );
    return { ok: false, response, error: 'CRON_SECRET not configured', status: 503 };
  }

  const auth = request.headers.get('authorization') || '';
  const header = (request.headers.get('x-cron-secret') || '').trim();
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const looksLikeJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer);
  const isBearerCronAttempt =
    auth.toLowerCase().startsWith('bearer ') && bearer.length > 0 && !looksLikeJwt;

  const headerMatch = header.length > 0 && matchesCronSecret(header, secret);
  const bearerMatch = isBearerCronAttempt && matchesCronSecret(bearer, secret);

  if (headerMatch || bearerMatch) {
    return { ok: true, userId: 'cron:system', verified: true, emails: [] };
  }

  if (header || isBearerCronAttempt) {
    const response = NextResponse.json(
      { error: 'Invalid cron secret', code: 'CRON_UNAUTHORIZED' },
      { status: 401 }
    );
    return { ok: false, response, error: 'Invalid cron secret', status: 401 };
  }

  const response = NextResponse.json(
    {
      error: 'Authentication required. Send Authorization: ****** access token>.',
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
  return {
    ok: false,
    response,
    error: 'Authentication required. Send Authorization: ****** access token>.',
    status: 401,
  };
}
