/**
 * SA Member pays a till session (Paystack init / verify).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { initializePaystackTransaction } from '@/lib/billing/paystack-plans';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';
import {
  advisorPaystackSplitFromMeta,
  advisorSplitMetadata,
  previewAdvisorPayoutSplit,
} from '@/lib/billing/advisor-payout';
import {
  expireSession,
  findSession,
  parseTillToken,
  readTillSessions,
  tillPayPath,
  upsertSession,
  writeTillSessions,
} from '@/lib/till/sessions';
import { confirmMemberAccountPayment } from '@/lib/b2c/member-account-pay';
import {
  openChargesByIds,
  readMemberAccountStore,
  writeMemberAccountStore,
} from '@/lib/b2c/member-account';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import { getAppUrl } from '@/lib/resend';
import {
  ensureRetailPublicToken,
  newRetailId,
  readRetailgraphFromMetadata,
  writeRetailgraphToMetadata,
} from '@/lib/retail/retailgraph';
import type { TillSession } from '@/lib/till/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadMeta(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { supabase, meta };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const profile = await loadB2cProfile(userId);
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token || '');
    const parsed = parseTillToken(token);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    const { supabase, meta } = await loadMeta(parsed.companyId);
    let sessions = readTillSessions(meta).map((s) => expireSession(s));
    const session = findSession(sessions, token);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status === 'paid') {
      return NextResponse.json({ success: true, session, already: true });
    }
    if (session.status !== 'open' && session.status !== 'pending') {
      return NextResponse.json({ error: 'Session is closed' }, { status: 400 });
    }

    const action = String(body.action || 'start');
    const email =
      profile?.email ||
      String(body.email || '').trim() ||
      `${userId.replace(/[^\w]/g, '')}@members.supplieradvisor.com`;

    if (action === 'start') {
      if (session.kind === 'wallet') {
        return NextResponse.json({
          success: true,
          redirect: '/me?pay=open',
        });
      }
      const amountCents = Math.round(session.amount_zar * 100);
      if (amountCents <= 0) {
        return NextResponse.json({ error: 'Nothing to pay' }, { status: 400 });
      }
      const split = advisorPaystackSplitFromMeta(meta, 'member');
      if (!split.ok) {
        return NextResponse.json({ error: split.error }, { status: 400 });
      }
      const splitPreview = previewAdvisorPayoutSplit(session.amount_zar);
      const reference = `till_${session.token}_${Date.now().toString(36)}`;
      const init = await initializePaystackTransaction({
        email,
        amountCents,
        reference,
        callbackUrl: `${getAppUrl()}${tillPayPath(session.token)}?ref=${encodeURIComponent(reference)}`,
        subaccount: split.subaccount,
        bearer: split.bearer,
        metadata: {
          till_token: session.token,
          company_id: session.company_id,
          kind: session.kind,
          user_id: userId,
          product: session.kind === 'bill' ? 'member_account' : 'advisor_till',
          ...advisorSplitMetadata(split),
          platform_fee_zar: splitPreview.platform_fee_zar,
        },
      });
      if (!init.ok) {
        return NextResponse.json({ error: init.error }, { status: 400 });
      }
      const pending: TillSession = { ...session, status: 'pending' };
      sessions = upsertSession(sessions, pending);
      await supabase
        .from('profiles')
        .update({ metadata: writeTillSessions(meta, sessions) })
        .eq('id', parsed.companyId);
      return NextResponse.json({
        success: true,
        authorization_url: init.authorizationUrl,
        reference: init.reference,
      });
    }

    if (action === 'verify') {
      const reference = String(body.reference || session.paystack_ref || '');
      if (!reference) {
        return NextResponse.json({ error: 'Reference required' }, { status: 400 });
      }
      const verified = await verifyPaystackTransaction(reference);
      if (!verified.ok || verified.status !== 'success') {
        return NextResponse.json(
          { error: verified.ok ? 'Payment not complete' : verified.error },
          { status: 400 }
        );
      }
      const paid: TillSession = {
        ...session,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_via: 'paystack',
        paystack_ref: reference,
        paid_by_user_id: userId,
      };
      sessions = upsertSession(sessions, paid);
      let nextMeta = writeTillSessions(meta, sessions);

      if (session.kind === 'bill' && session.charge_ids?.length) {
        const company = await loadWalletCompany(session.company_id);
        if (company) {
          const store = readMemberAccountStore(company.meta);
          const charges = openChargesByIds(store, session.charge_ids);
          if (charges.length) {
            const result = await confirmMemberAccountPayment({
              companyId: session.company_id,
              store,
              charges,
              method: 'paystack',
              amountZar: session.amount_zar,
              paystackRef: reference,
              actorUserId: userId,
              memberUserId: userId,
              memberEmail: profile?.email,
              memberName: profile?.full_name,
            });
            await saveWalletCompanyMeta(
              session.company_id,
              writeMemberAccountStore(company.meta, result.store)
            );
          }
        }
      }

      if (session.kind === 'sale') {
        const retail = ensureRetailPublicToken(
          readRetailgraphFromMetadata(nextMeta)
        );
        retail.sales = [
          {
            id: newRetailId('sal'),
            created_at: new Date().toISOString(),
            lines: (session.lines || []).map((l) => ({
              name: l.name,
              qty: l.qty,
              unit_zar: l.unit_zar,
            })),
            total_zar: session.amount_zar,
            status: 'paid' as const,
            paid_via: 'paystack' as const,
            till_token: session.token,
          },
          ...retail.sales,
        ].slice(0, 200);
        nextMeta = writeRetailgraphToMetadata(nextMeta, retail);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ metadata: nextMeta })
        .eq('id', parsed.companyId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, session: paid });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pay failed' },
      { status: 500 }
    );
  }
}
