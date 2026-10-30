import { NextRequest, NextResponse } from 'next/server';
import { memberStatementsForToken } from '@/lib/fitness/netcash/server/member-access';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const limited = rateLimit({ key: `gym-statement:${clientIp(request)}`, limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const token = request.nextUrl.searchParams.get('token') || '';
  const result = await memberStatementsForToken(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    memberName: result.memberName,
    gymName: result.gymName,
    statements: result.statements,
  });
}
