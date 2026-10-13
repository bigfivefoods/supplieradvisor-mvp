import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { syncAllCalendars } from '@/lib/sales/calendar-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  try {
    const count = await syncAllCalendars();
    return NextResponse.json({ ok: true, users: count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calendar sync failed' },
      { status: 500 }
    );
  }
}
