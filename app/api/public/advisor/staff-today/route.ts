/**
 * Public staff PWA API — token-scoped today board for coaches/clinicians.
 * GET ?module=fitgraph&token=...
 * POST mark attendance { module, token, booking_id, status }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import { applyAttendanceToPersonStats } from '@/lib/services/advisor-booking';
import {
  consumePackSession,
  fitPtPackToLedger,
  ledgerToFitPtPack,
} from '@/lib/services/advisor-pack-ledger';
import { appendAdvisorEvent } from '@/lib/services/advisor-events';
import { issueFeedbackPrompt, buildPublicFeedbackPath } from '@/lib/services/booking-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const module = String(req.nextUrl.searchParams.get('module') || 'fitgraph');
  const token = String(req.nextUrl.searchParams.get('token') || '');
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  // Find company by scanning recent profiles for matching portal token
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, metadata, company_name, name')
    .order('updated_at', { ascending: false })
    .limit(300);

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    if (module === 'fitgraph' && meta.fitgraph) {
      const store = readFitgraphFromMetadata(meta);
      const coach = store.coaches.find(
        (c) => c.portal_token === token && c.active !== false
      );
      if (!coach) continue;
      const day = todayIso();
      const sessions = store.sessions.filter(
        (s) =>
          s.date === day &&
          s.status !== 'cancelled' &&
          (s.coach_id === coach.id || !s.coach_id)
      );
      const rowsOut = [];
      for (const s of sessions) {
        const ct = store.class_types.find((t) => t.id === s.class_type_id);
        const books = store.bookings.filter(
          (b) => b.session_id === s.id && b.status !== 'cancelled'
        );
        for (const b of books) {
          const client = store.clients.find((c) => c.id === b.client_id);
          rowsOut.push({
            booking_id: b.id,
            time: s.start_time,
            title: ct?.name || 'Class',
            attendee: b.family_member_name || client?.name || 'Member',
            status: b.status,
            location: s.location,
            session_id: s.id,
          });
        }
        if (!books.length) {
          rowsOut.push({
            booking_id: null,
            time: s.start_time,
            title: ct?.name || 'Class',
            attendee: null,
            status: 'open',
            location: s.location,
            session_id: s.id,
          });
        }
      }
      rowsOut.sort((a, b) => String(a.time).localeCompare(String(b.time)));
      return NextResponse.json({
        success: true,
        module: 'fitgraph',
        companyId: row.id,
        brand:
          store.settings?.brand_name ||
          row.company_name ||
          row.name ||
          'FitAdvisor',
        staff: { id: coach.id, name: coach.name, role: 'coach' },
        date: day,
        rows: rowsOut,
      });
    }
  }

  return NextResponse.json({ error: 'Staff portal not found' }, { status: 404 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const module = String(body.module || 'fitgraph');
    const token = String(body.token || '');
    const bookingId = String(body.booking_id || '');
    const status = String(body.status || 'attended');
    if (!token || !bookingId) {
      return NextResponse.json(
        { error: 'token and booking_id required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, metadata')
      .order('updated_at', { ascending: false })
      .limit(300);

    for (const row of rows || []) {
      const meta0 =
        row.metadata && typeof row.metadata === 'object'
          ? { ...(row.metadata as Record<string, unknown>) }
          : {};
      if (module !== 'fitgraph' || !meta0.fitgraph) continue;
      const store = readFitgraphFromMetadata(meta0);
      const coach = store.coaches.find((c) => c.portal_token === token);
      if (!coach) continue;

      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const now = new Date().toISOString();
      const prev = booking.status;
      booking.status = status as typeof booking.status;

      if (
        (status === 'attended' || status === 'no_show') &&
        prev !== status
      ) {
        const ci = store.clients.findIndex((c) => c.id === booking.client_id);
        if (ci >= 0) {
          Object.assign(
            store.clients[ci],
            applyAttendanceToPersonStats(
              store.clients[ci],
              status as 'attended' | 'no_show',
              now
            )
          );
        }
      }

      let packRemaining = null as number | null;
      if (status === 'attended' && prev !== 'attended') {
        const session = store.sessions.find((s) => s.id === booking.session_id);
        const ledgers = (store.pt_packs || []).map(fitPtPackToLedger);
        const { packs, remaining } = consumePackSession(ledgers, {
          personId: booking.client_id,
          bookingId: booking.id,
          providerId: session?.coach_id || coach.id,
          now,
        });
        store.pt_packs = packs.map(ledgerToFitPtPack);
        packRemaining = remaining;
        const prompted = issueFeedbackPrompt(booking, now);
        booking.feedback_token = prompted.feedback_token;
        booking.feedback_requested_at = prompted.feedback_requested_at;
      }

      let meta = writeFitgraphToMetadata(meta0, store);
      const ev = appendAdvisorEvent(meta, {
        module: 'fitgraph',
        company_id: Number(row.id),
        type: 'attendance.marked',
        person_id: booking.client_id,
        booking_id: booking.id,
        meta: { status, source: 'staff_pwa', staff_id: coach.id },
      });
      meta = ev.metadata;

      await supabase
        .from('profiles')
        .update({ metadata: meta, updated_at: now })
        .eq('id', row.id);

      return NextResponse.json({
        success: true,
        booking: { id: booking.id, status: booking.status },
        pack_remaining: packRemaining,
        feedback_path:
          booking.feedback_token
            ? buildPublicFeedbackPath(
                'fitgraph',
                Number(row.id),
                booking.feedback_token
              )
            : null,
      });
    }

    return NextResponse.json({ error: 'Staff portal not found' }, { status: 404 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
