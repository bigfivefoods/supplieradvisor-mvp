/**
 * Email owners when golden-path trades are stuck (receive / settle / escrow).
 * Soft-fail — never blocks primary flows. Dedupes via activity_log metadata.
 */
import { loadGoldenPath } from '@/lib/business/golden-path';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom } from '@/lib/resend';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';

function appBase() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

export type StuckAlertResult = {
  companyId: number;
  sent: boolean;
  skipped?: string;
  stuckTotal?: number;
  error?: string;
};

/**
 * Scan one company; email if stuck counts exceed thresholds and no alert in 24h.
 */
export async function maybeSendStuckStageAlert(
  companyId: number,
  opts?: { force?: boolean; minStuck?: number }
): Promise<StuckAlertResult> {
  const minStuck = opts?.minStuck ?? 1;
  try {
    const path = await loadGoldenPath(companyId, 40);
    const s = path.summary;
    const stuckTotal =
      s.stuck_receive +
      s.stuck_settle +
      s.escrow_awaiting_ship +
      s.escrow_awaiting_release +
      s.claims_pending;

    if (stuckTotal < minStuck) {
      return { companyId, sent: false, skipped: 'below_threshold', stuckTotal };
    }

    const supabase = getSupabaseServer();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (!opts?.force) {
      const { data: recent } = await supabase
        .from('activity_log')
        .select('id')
        .eq('profile_id', companyId)
        .eq('action', 'alert.stuck_stages')
        .gte('created_at', since)
        .limit(1)
        .maybeSingle();
      if (recent?.id) {
        return { companyId, sent: false, skipped: 'deduped_24h', stuckTotal };
      }
    }

    const { emails } = await resolveCompanyEmails(companyId, {
      roleAllowlist: ['owner', 'admin', 'finance', 'operations', 'ops'],
      limit: 8,
    });
    if (!emails.length) {
      return { companyId, sent: false, skipped: 'no_recipients', stuckTotal };
    }
    if (!process.env.RESEND_API_KEY) {
      return { companyId, sent: false, skipped: 'no_resend', stuckTotal };
    }

    const name =
      (path as { companyName?: string }).companyName || `Company #${companyId}`;
    const actions = (path.next_actions || []).slice(0, 5);
    const actionHtml = actions
      .map(
        (a) =>
          `<li style="margin:6px 0"><strong>${escapeHtml(a.title)}</strong> — ${escapeHtml(a.body)} <a href="${appBase()}${a.href}">${escapeHtml(a.cta)}</a></li>`
      )
      .join('');

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="color:#0077b6">Golden path needs attention</h2>
        <p>${escapeHtml(String(name))} has <strong>${stuckTotal}</strong> stuck trade stage(s).</p>
        <ul>
          <li>Receive stuck: <strong>${s.stuck_receive}</strong></li>
          <li>Settle stuck: <strong>${s.stuck_settle}</strong></li>
          <li>Escrow awaiting ship: <strong>${s.escrow_awaiting_ship}</strong></li>
          <li>Escrow awaiting release: <strong>${s.escrow_awaiting_release}</strong></li>
          <li>Claims pending: <strong>${s.claims_pending}</strong></li>
        </ul>
        ${actionHtml ? `<h3>Next actions</h3><ul>${actionHtml}</ul>` : ''}
        <p style="margin-top:20px">
          <a href="${appBase()}/dashboard/settle" style="background:#00b4d8;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Open settle cockpit</a>
        </p>
        <p style="color:#64748b;font-size:12px;margin-top:24px">SupplierAdvisor® operational alert — not a formal financial notice.</p>
      </div>`;

    const resend = getResend();
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to: emails.slice(0, 8),
      subject: `[SupplierAdvisor] ${stuckTotal} stuck trade stage${stuckTotal === 1 ? '' : 's'} — act today`,
      html,
    });
    if (error) {
      return {
        companyId,
        sent: false,
        stuckTotal,
        error: String(error),
      };
    }

    try {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        actor_user_id: 'system:stuck-alert',
        action: 'alert.stuck_stages',
        entity_type: 'golden_path',
        entity_id: String(companyId),
        metadata: {
          stuckTotal,
          stuck_receive: s.stuck_receive,
          stuck_settle: s.stuck_settle,
          escrow_awaiting_ship: s.escrow_awaiting_ship,
          escrow_awaiting_release: s.escrow_awaiting_release,
          claims_pending: s.claims_pending,
        },
      });
    } catch {
      /* soft */
    }

    return { companyId, sent: true, stuckTotal };
  } catch (e) {
    return {
      companyId,
      sent: false,
      error: e instanceof Error ? e.message : 'alert failed',
    };
  }
}

/**
 * Scan recently active companies (open POs) and alert.
 */
export async function runStuckStageAlertSweep(opts?: {
  limit?: number;
  force?: boolean;
}): Promise<{ scanned: number; sent: number; results: StuckAlertResult[] }> {
  const limit = Math.min(80, Math.max(5, opts?.limit ?? 40));
  const supabase = getSupabaseServer();
  const results: StuckAlertResult[] = [];

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('buyer_profile_id, supplier_profile_id')
    .in('status', ['sent', 'accepted', 'funded', 'invoiced', 'delivered', 'shipped'])
    .order('updated_at', { ascending: false })
    .limit(200);

  const ids = new Set<number>();
  for (const row of pos || []) {
    const b = Number(row.buyer_profile_id);
    const s = Number(row.supplier_profile_id);
    if (Number.isFinite(b) && b > 0) ids.add(b);
    if (Number.isFinite(s) && s > 0) ids.add(s);
    if (ids.size >= limit) break;
  }

  let sent = 0;
  for (const id of ids) {
    const r = await maybeSendStuckStageAlert(id, { force: opts?.force });
    results.push(r);
    if (r.sent) sent += 1;
  }

  return { scanned: ids.size, sent, results };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
