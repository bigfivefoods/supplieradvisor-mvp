/**
 * Daily digest of pending rating prompts (Resend).
 * Soft-fail; marks prompts with metadata.digest_sent_at to avoid spam.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

type PromptRow = {
  id: number;
  profile_id: number;
  counterparty_name?: string | null;
  ratee_role?: string | null;
  context_type?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Send digest emails for companies with pending rating prompts
 * that are at least `minAgeHours` old and not yet digested.
 */
export async function sendPendingRatingDigests(opts?: {
  minAgeHours?: number;
  limitCompanies?: number;
}): Promise<{
  ok: boolean;
  companies: number;
  emailsSent: number;
  promptsTouched: number;
  error?: string;
}> {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: true,
      companies: 0,
      emailsSent: 0,
      promptsTouched: 0,
      error: 'RESEND_API_KEY not set — skipped',
    };
  }

  const minAgeHours = opts?.minAgeHours ?? 20;
  const limitCompanies = opts?.limitCompanies ?? 80;
  const cutoff = new Date(
    Date.now() - minAgeHours * 60 * 60 * 1000
  ).toISOString();

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('rating_prompts')
      .select(
        'id, profile_id, counterparty_name, ratee_role, context_type, created_at, metadata'
      )
      .eq('status', 'pending')
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return {
          ok: true,
          companies: 0,
          emailsSent: 0,
          promptsTouched: 0,
          error: error.message,
        };
      }
      return {
        ok: false,
        companies: 0,
        emailsSent: 0,
        promptsTouched: 0,
        error: error.message,
      };
    }

    const rows = (data || []) as PromptRow[];
    // Skip already digested
    const fresh = rows.filter((r) => {
      const meta =
        r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
          ? r.metadata
          : {};
      return !meta.digest_sent_at;
    });

    const byCompany = new Map<number, PromptRow[]>();
    for (const r of fresh) {
      const pid = Number(r.profile_id);
      if (!Number.isFinite(pid)) continue;
      const list = byCompany.get(pid) || [];
      list.push(r);
      byCompany.set(pid, list);
    }

    const companyIds = [...byCompany.keys()].slice(0, limitCompanies);
    let emailsSent = 0;
    let promptsTouched = 0;
    const now = new Date().toISOString();
    const resend = getResend();
    const base = appUrl();

    for (const companyId of companyIds) {
      const prompts = byCompany.get(companyId) || [];
      if (!prompts.length) continue;

      // profiles.contact_email is not a real column — use shared resolver
      const resolved = await resolveCompanyEmails(companyId, { limit: 8 });
      const to = resolved.emails;
      if (!to.length) continue;

      const companyName = resolved.tradingName || `Company ${companyId}`;
      const itemsHtml = prompts
        .slice(0, 8)
        .map((p) => {
          const name = escapeHtml(
            p.counterparty_name || 'Trading partner'
          );
          const role = escapeHtml(p.ratee_role || 'partner');
          const ctx = escapeHtml(p.context_type || 'trade');
          const href =
            role === 'customer'
              ? `${base}/dashboard/customers/ratings`
              : `${base}/dashboard/suppliers/ratings`;
          return `<li style="margin:8px 0;"><strong>${name}</strong> <span style="color:#64748b">(${role} · ${ctx})</span> — <a href="${href}" style="color:#0077b6;">Rate →</a></li>`;
        })
        .join('');

      try {
        await resend.emails.send({
          from: getResendFrom(),
          replyTo: getResendReplyTo(),
          to,
          subject: `You have ${prompts.length} pending rating${prompts.length === 1 ? '' : 's'} on SupplierAdvisor`,
          html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="font-size:12px;font-weight:700;color:#d97706;letter-spacing:0.08em;text-transform:uppercase;">Trust loop</div>
    <h1 style="font-size:20px;margin:12px 0 8px;color:#0f172a;">Pending partner ratings</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">
      Hi ${escapeHtml(companyName)} — you have <strong>${prompts.length}</strong> open rating
      prompt${prompts.length === 1 ? '' : 's'} from recent trade. Peer stars and OTIFEF build trust for the network.
    </p>
    <ul style="padding-left:18px;color:#0f172a;font-size:14px;">${itemsHtml}</ul>
    <p style="margin:24px 0;">
      <a href="${base}/dashboard" style="background:#00b4d8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">
        Open dashboard →
      </a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">SupplierAdvisor® · Continuous supplier↔customer feedback</p>
  </div>
</body></html>`,
        });
        emailsSent += 1;

        // Mark digested
        for (const p of prompts) {
          const meta =
            p.metadata &&
            typeof p.metadata === 'object' &&
            !Array.isArray(p.metadata)
              ? { ...p.metadata }
              : {};
          meta.digest_sent_at = now;
          await supabase
            .from('rating_prompts')
            .update({ metadata: meta, updated_at: now })
            .eq('id', p.id)
            .eq('profile_id', companyId);
          promptsTouched += 1;
        }
      } catch (e) {
        console.warn('rating digest send soft-fail company', companyId, e);
      }
    }

    return {
      ok: true,
      companies: companyIds.length,
      emailsSent,
      promptsTouched,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      companies: 0,
      emailsSent: 0,
      promptsTouched: 0,
      error: e instanceof Error ? e.message : 'digest failed',
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
