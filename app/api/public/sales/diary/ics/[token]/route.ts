import { NextRequest, NextResponse } from 'next/server';
import { loadCompanyDiary } from '@/lib/sales/diary-load';
import { parseDiaryFeedToken } from '@/lib/sales/diary-feed';
import { salesDiaryIcs } from '@/lib/sales/diary-ics';
import { taskScheduleEvent } from '@/lib/sales/crm-tasks';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';
import { publicReadLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/sales/diary/ics/:token.ics
 * Google, Apple, and Outlook poll this URL. The signed token is the only gate:
 * it names one company, and a bad token is a 404.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const rl = publicReadLimit(request, 'sales-diary-ics', 60);
  if (!rl.ok) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const { token: raw } = await ctx.params;
  const token = decodeURIComponent(raw || '').replace(/\.ics$/i, '');
  let companyId: number | null = null;
  try {
    companyId = parseDiaryFeedToken(token);
  } catch {
    return new NextResponse('Calendar feed is not configured', { status: 503 });
  }
  if (!companyId) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const loaded = await loadCompanyDiary(companyId);
    if (!loaded.ok) {
      return new NextResponse(loaded.missingTable ? 'Diary is not ready' : 'Diary unavailable', {
        status: loaded.missingTable ? 503 : 500,
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const tasks = loaded.tasks.map((task) => {
      const event = taskScheduleEvent(task, today);
      if (task.notes) event.subtitle = [event.subtitle, task.notes].filter(Boolean).join(' · ');
      return event;
    });
    const ics = salesDiaryIcs([...tasks, ...loaded.horizon], {
      calName: `${loaded.tradingName} sales diary`,
      pageUrl: `${appBaseUrl()}/sales/tasks`,
      cancelDone: true,
    });
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="sales-diary.ics"',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e: unknown) {
    console.error('sales diary ics', e instanceof Error ? e.message : 'error');
    return new NextResponse('Diary unavailable', { status: 500 });
  }
}
