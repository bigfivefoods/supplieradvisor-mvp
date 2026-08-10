/**
 * GET /api/public/advisor/ics
 * ?module=fitgraph&date=YYYY-MM-DD&start=HH:mm&title=...&duration=45&location=
 * Returns a downloadable .ics for "Add to calendar".
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildBookingIcs } from '@/lib/services/advisor-booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const title = String(sp.get('title') || 'Booking');
  const date = String(sp.get('date') || '');
  const start = String(sp.get('start') || sp.get('start_time') || '09:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  }
  const duration = Number(sp.get('duration') || sp.get('duration_min') || 45);
  const location = sp.get('location') || undefined;
  const description = sp.get('description') || undefined;
  const uid = String(
    sp.get('uid') ||
      `${sp.get('module') || 'advisor'}-${date}-${start}-${Math.random().toString(36).slice(2, 8)}`
  );
  const ics = buildBookingIcs({
    uid,
    title,
    description,
    location: location || undefined,
    date,
    start_time: start,
    duration_min: duration,
  });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${date}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
