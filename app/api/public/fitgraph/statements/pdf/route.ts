import { NextRequest, NextResponse } from 'next/server';
import { memberStatementsForToken } from '@/lib/fitness/netcash/server/member-access';
import { renderMonthStatementPdf } from '@/lib/fitness/netcash/pdf';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const limited = rateLimit({ key: `gym-statement-pdf:${clientIp(request)}`, limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const token = request.nextUrl.searchParams.get('token') || '';
  const month = request.nextUrl.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Choose a statement month.' }, { status: 400 });
  }
  const result = await memberStatementsForToken(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const statement = result.statements.find((item) => item.month === month);
  if (!statement) return NextResponse.json({ error: 'That statement is not on your account.' }, { status: 404 });
  const pdf = await renderMonthStatementPdf({
    gymName: result.gymName,
    memberName: result.memberName,
    statement,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="GymAdvisor-statement-${month}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
