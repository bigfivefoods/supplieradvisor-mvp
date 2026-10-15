import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { isFleetSchemaMissing, loadFleetBook, loadReminderKeys } from '@/lib/fleet/fleetgraph-db';
import { planReminders } from '@/lib/fleet/reminders';
import { reminderMessage } from '@/lib/fleet/reminders-email';
import { getAppUrl, getResend, getResendFrom } from '@/lib/resend';
import { isWebPushConfigured, pushToUser } from '@/lib/push/web-push';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function countsBody(extra: Record<string, number> = {}) {
  return {
    claimed: extra.claimed || 0,
    sent: extra.sent || 0,
    failed: extra.failed || 0,
    skipped_demo: extra.skipped_demo || 0,
    skipped_email: extra.skipped_email || 0,
    skipped_push: extra.skipped_push || 0,
    companies_failed: extra.companies_failed || 0,
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return runReminders();
}

export async function POST(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  return runReminders();
}

async function workspaceIds(admin: ReturnType<typeof getSupabaseAdmin>): Promise<{ ok: true; ids: number[] } | { ok: false; missing: boolean }> {
  const ids: number[] = [];
  let from = 0;
  for (;;) {
    const listed = await admin.from('fg_workspaces').select('company_id').order('company_id', { ascending: true }).range(from, from + 99);
    if (listed.error) return { ok: false, missing: isFleetSchemaMissing(listed.error) };
    const batch = listed.data || [];
    for (const row of batch) {
      const companyId = Number((row as { company_id?: unknown }).company_id);
      if (Number.isFinite(companyId) && companyId > 0) ids.push(companyId);
    }
    if (batch.length < 100) break;
    from += 100;
  }
  return { ok: true, ids };
}

async function runReminders() {
  const totals = countsBody();
  const admin = getSupabaseAdmin();
  const listed = await workspaceIds(admin);
  if (!listed.ok) {
    if (listed.missing) return NextResponse.json(countsBody(), { headers: NO_STORE });
    console.error('fleetgraph reminders failed');
    return NextResponse.json(countsBody({ companies_failed: 1 }), { headers: NO_STORE });
  }
  for (const companyId of listed.ids) {
    try {
      const loaded = await loadFleetBook(companyId);
      if (!loaded.ready || !loaded.readiness.reminders.ready) continue;
      const book = loaded.book;
      const keys = await loadReminderKeys(companyId);
      if (!keys.ok) {
        if (!keys.missing) totals.companies_failed += 1;
        continue;
      }
      const plan = planReminders({
        items: book.compliance,
        rules: book.reminders,
        vehicles: book.vehicles,
        drivers: book.drivers,
        members: book.members,
        logKeys: keys.keys,
        now: new Date(),
        workspace: book.workspace,
      });
      if (!book.workspace.real_data_enabled) {
        if (plan.due.length === 0) continue;
        totals.skipped_demo += 1;
        await admin.rpc('fg_commit_b', {
          p_company_id: companyId,
          p_diff: {
            company_id: companyId,
            inserts: {
              fg_audit_log: [
                {
                  company_id: companyId,
                  actor_kind: 'system',
                  actor_id: 'cron',
                  action: 'reminders.skipped_demo',
                  target_kind: 'reminder',
                  target_id: '',
                  payload: { count: plan.due.length },
                },
              ],
            },
          },
        });
        continue;
      }
      for (const item of plan.superseded) {
        await admin.rpc('fg_commit_b', {
          p_company_id: companyId,
          p_diff: {
            company_id: companyId,
            inserts: {
              fg_reminder_log: [
                {
                  company_id: companyId,
                  rule_id: item.ruleId,
                  item_id: item.itemId,
                  subject_kind: item.subjectKind,
                  subject_id: item.subjectId,
                  expires_on: item.expiresOn,
                  threshold_days: item.thresholdDays,
                  channel: item.channel,
                  recipient_key: item.recipientKey,
                  status: 'skipped_superseded',
                },
              ],
            },
          },
        });
      }
      for (const due of plan.due) {
        if (due.channel === 'email' && !book.workspace.comms_flags.email) {
          totals.skipped_email += 1;
          continue;
        }
        if (due.channel === 'push' && !isWebPushConfigured()) {
          totals.skipped_push += 1;
          continue;
        }
        const claimed = await admin.rpc('fg_claim_reminder', {
          p_company_id: companyId,
          p_rule_id: due.ruleId,
          p_item_id: due.itemId,
          p_subject_kind: due.subjectKind,
          p_subject_id: due.subjectId,
          p_expires_on: due.expiresOn,
          p_threshold: due.thresholdDays,
          p_channel: due.channel,
          p_recipient_key: due.recipientKey,
        });
        if (claimed.error || claimed.data !== true) continue;
        totals.claimed += 1;
        let errorCode: string | null = null;
        try {
          if (due.channel === 'email') {
            const member = await admin.from('business_users').select('email').eq('id', due.recipientKey).eq('profile_id', companyId).maybeSingle();
            const address = member.data && typeof (member.data as { email?: unknown }).email === 'string' ? String((member.data as { email?: string }).email) : '';
            if (!address) errorCode = 'no_address';
            else {
              const message = reminderMessage({
                kindLabel: due.kindLabel,
                subjectLabel: due.subjectLabel,
                expiresOn: due.expiresOn,
                daysLeft: due.daysLeft,
                appOrigin: getAppUrl(),
              });
              const resend = getResend();
              await resend.emails.send({ from: getResendFrom(), to: address, subject: message.subject, html: message.html, text: message.text });
            }
          } else {
            const member = await admin.from('business_users').select('user_id').eq('id', due.recipientKey).eq('profile_id', companyId).maybeSingle();
            const userId = member.data && typeof (member.data as { user_id?: unknown }).user_id === 'string' ? String((member.data as { user_id?: string }).user_id) : '';
            if (!userId) errorCode = 'no_subscription';
            else {
              const message = reminderMessage({
                kindLabel: due.kindLabel,
                subjectLabel: due.subjectLabel,
                expiresOn: due.expiresOn,
                daysLeft: due.daysLeft,
                appOrigin: getAppUrl(),
              });
              const pushed = await pushToUser(userId, { title: message.subject, body: message.text, url: '/dashboard/fleetgraph/compliance' }, { profileId: companyId });
              if (!pushed.sent) errorCode = 'no_subscription';
            }
          }
        } catch {
          errorCode = due.channel === 'email' ? 'email_failed' : 'push_failed';
        }
        if (errorCode) totals.failed += 1;
        else totals.sent += 1;
        await admin.rpc('fg_commit_b', {
          p_company_id: companyId,
          p_diff: {
            company_id: companyId,
            inserts: {
              fg_reminder_log: [
                {
                  company_id: companyId,
                  rule_id: due.ruleId,
                  item_id: due.itemId,
                  subject_kind: due.subjectKind,
                  subject_id: due.subjectId,
                  expires_on: due.expiresOn,
                  threshold_days: due.thresholdDays,
                  channel: due.channel,
                  recipient_key: due.recipientKey,
                  status: errorCode ? 'failed' : 'sent',
                  error_code: errorCode,
                },
              ],
            },
          },
        });
      }
    } catch {
      totals.companies_failed += 1;
    }
  }
  return NextResponse.json(totals, { headers: NO_STORE });
}
