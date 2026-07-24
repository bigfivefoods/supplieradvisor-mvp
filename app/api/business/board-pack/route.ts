import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
  assertCronSecret,
} from '@/lib/auth/api-auth';
import { loadGoldenPath } from '@/lib/business/golden-path';
import { loadSettleFunnel } from '@/lib/business/settle-funnel';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';

/**
 * GET ?companyId= — board pack v1: golden path + settle + company identity snapshot.
 * JSON export for leadership; not a formal audit opinion.
 * POST { companyId, email?: boolean } — same pack + optional weekly email to owners.
 */

async function buildBoardPack(companyId: number) {
  const supabase = getSupabaseServer();
  const [profileRes, golden, funnel] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, country, city, industry, verification_status, trust_score, primary_currency, leadership_progress'
      )
      .eq('id', companyId)
      .maybeSingle(),
    loadGoldenPath(companyId, 50),
    loadSettleFunnel(companyId),
  ]);

  const lp = profileRes.data?.leadership_progress as {
    totalScore?: number;
    dimensions?: Record<string, number>;
  } | null;

  const pack = {
    schema_version: '1.1',
    generated_at: new Date().toISOString(),
    company: {
      id: profileRes.data?.id ?? companyId,
      trading_name: profileRes.data?.trading_name,
      legal_name: profileRes.data?.legal_name,
      country: profileRes.data?.country,
      city: profileRes.data?.city,
      industry: profileRes.data?.industry,
      verification_status: profileRes.data?.verification_status,
      trust_score: profileRes.data?.trust_score,
      primary_currency: profileRes.data?.primary_currency,
    },
    golden_path: {
      summary: golden.summary,
      funnel: golden.funnel,
      next_actions: golden.next_actions,
      open_trades: golden.trades
        .filter((t) => !t.stages.settled || !t.stages.reviewed)
        .slice(0, 20)
        .map((t) => ({
          id: t.id,
          po_number: t.po_number,
          status: t.status,
          role: t.role,
          next: t.next_label,
          escrow: t.escrow.enabled
            ? {
                complete: t.escrow.complete,
                next: t.escrow.nextLabel,
                mode: t.escrow.mode,
              }
            : null,
        })),
    },
    settle: {
      claims_pending: funnel.claimsPending,
      open_ar: funnel.openAr,
      overdue: funnel.overdueInvoices,
      open_escrows: funnel.openEscrows,
      funded_escrows: funnel.fundedEscrows,
      stages: funnel.stages,
    },
    leadership: lp
      ? {
          totalScore: lp.totalScore ?? null,
          dimensions: lp.dimensions ?? null,
        }
      : null,
    narrative: {
      headline: `${profileRes.data?.trading_name || 'Company'} — board pack`,
      bullets: [
        `Open POs: ${golden.summary.open_pos} · path complete ${golden.summary.pct_complete}%`,
        `Claims pending: ${funnel.claimsPending} · open AR lines: ${funnel.openAr}`,
        `Open escrows: ${golden.summary.open_escrows} (await ship ${golden.summary.escrow_awaiting_ship}, release ${golden.summary.escrow_awaiting_release})`,
        `Stuck receive: ${golden.summary.stuck_receive} · stuck settle: ${golden.summary.stuck_settle}`,
        lp?.totalScore != null
          ? `Super-Cube® combined index: ${lp.totalScore}/60`
          : 'Super-Cube® not assessed yet',
      ],
    },
    disclaimer:
      'Operational board pack from live system data — not a formal audit, legal, or financial statement.',
  };

  return pack;
}

function packHtml(pack: Awaited<ReturnType<typeof buildBoardPack>>) {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
  const bullets = pack.narrative.bullets
    .map((b) => `<li style="margin:4px 0">${b}</li>`)
    .join('');
  const actions = (pack.golden_path.next_actions || [])
    .slice(0, 5)
    .map(
      (a) =>
        `<li style="margin:6px 0"><strong>${a.title}</strong> — ${a.body}</li>`
    )
    .join('');
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
      <h1 style="color:#00b4d8;font-size:22px">${pack.narrative.headline}</h1>
      <p style="color:#64748b;font-size:13px">Weekly board pack · ${pack.generated_at}</p>
      <ul>${bullets}</ul>
      ${actions ? `<h2 style="font-size:16px;margin-top:20px">Next actions</h2><ul>${actions}</ul>` : ''}
      <p style="margin-top:24px">
        <a href="${base}/dashboard/settle" style="background:#00b4d8;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Open settle</a>
        &nbsp;
        <a href="${base}/dashboard/intelligence" style="color:#0077b6;font-weight:600">Intelligence</a>
      </p>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px">${pack.disclaimer}</p>
    </div>`;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const pack = await buildBoardPack(companyId);
    return NextResponse.json({
      success: true,
      pack,
      download_name: `board-pack-${companyId}-${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId);
    const sendEmail = body.email !== false && body.sendEmail !== false;

    // Cron can email a company without user JWT
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
    } else if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const pack = await buildBoardPack(companyId);
    let emailed: { ok: boolean; error?: string; to?: string[] } = {
      ok: false,
      error: 'skipped',
    };

    if (sendEmail) {
      if (!process.env.RESEND_API_KEY) {
        emailed = { ok: false, error: 'RESEND_API_KEY not set' };
      } else {
        const { emails } = await resolveCompanyEmails(companyId, {
          roleAllowlist: ['owner', 'admin', 'finance'],
          limit: 8,
        });
        if (!emails.length) {
          emailed = { ok: false, error: 'no_recipients' };
        } else {
          try {
            const resend = getResend();
            const { error } = await resend.emails.send({
              from: getResendFrom(),
              to: emails.slice(0, 8),
              subject: `[Board pack] ${pack.narrative.headline}`,
              html: packHtml(pack),
            });
            emailed = error
              ? { ok: false, error: String(error), to: emails }
              : { ok: true, to: emails };
          } catch (e) {
            emailed = {
              ok: false,
              error: e instanceof Error ? e.message : 'send failed',
            };
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      pack,
      emailed,
      download_name: `board-pack-${companyId}-${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
