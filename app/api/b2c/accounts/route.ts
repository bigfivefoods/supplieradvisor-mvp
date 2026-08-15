/**
 * SA Member — account statements + pay / proof of payment.
 * GET  ?companyId= optional filter
 * POST { action: pay | pop | verify, companyId, charge_ids, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { isWalletVisibleMembership } from '@/lib/b2c/company-modules';
import {
  loadBusinessWorkspaceSummary,
  operatorCompanyIds,
} from '@/lib/b2c/workspace';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import {
  isAdvisorAccountKind,
  type AdvisorAccountKind,
} from '@/lib/b2c/member-account-types';
import type { B2cMembership } from '@/lib/b2c/types';

function isAdvisorMembership(
  m: B2cMembership
): m is B2cMembership & { kind: AdvisorAccountKind } {
  return isAdvisorAccountKind(m.kind);
}
import {
  addPayment,
  chargesForMember,
  markChargesPendingPop,
  newMemberAccountId,
  openChargesByIds,
  paymentsForCharges,
  readMemberAccountStore,
  summarizeCharges,
  writeMemberAccountStore,
} from '@/lib/b2c/member-account';
import { initializePaystackTransaction } from '@/lib/billing/paystack-plans';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';
import { applyMemberAccountPaystack } from '@/lib/b2c/member-account-apply-paystack';
import { notifyAdvisorOfMemberPayment } from '@/lib/b2c/member-account-notify';
import { deskPathForKind } from '@/lib/b2c/member-account-pay';
import { formatZar } from '@/lib/b2c/member-account-types';
import { COMPANY_IMAGE_BUCKETS } from '@/lib/business/documentFields';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getAppUrl } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authUser(request: NextRequest) {
  const auth = await requireVerifiedUser(request, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const userId = getCanonicalUserId(auth.userId);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true as const, userId };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await authUser(request);
    if (!gate.ok) return gate.response;
    const profile = await loadB2cProfile(gate.userId);
    if (!profile) {
      return NextResponse.json({ success: true, accounts: [] });
    }
    let operated = new Set<number>();
    try {
      const workspace = await loadBusinessWorkspaceSummary(gate.userId);
      operated = new Set(operatorCompanyIds(workspace));
    } catch {
      operated = new Set();
    }
    const filterCompany = Number(request.nextUrl.searchParams.get('companyId'));
    const memberships = (profile.memberships || []).filter((m) => {
      if (!isWalletVisibleMembership(m, operated)) return false;
      if (!isAdvisorMembership(m)) return false;
      if (Number.isFinite(filterCompany) && filterCompany > 0) {
        return m.company_id === filterCompany;
      }
      return true;
    }) as Array<B2cMembership & { kind: AdvisorAccountKind }>;

    const accounts = [];
    const seen = new Set<string>();
    for (const m of memberships) {
      const key = `${m.company_id}:${m.kind}:${m.ref_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const company = await loadWalletCompany(m.company_id);
      if (!company) continue;
      const store = readMemberAccountStore(company.meta);
      const charges = chargesForMember(store, {
        kind: m.kind,
        ref_id: m.ref_id,
        email: profile.email,
        userId: profile.user_id,
      });
      const payments = paymentsForCharges(
        store,
        charges.map((c) => c.id)
      );
      accounts.push({
        company_id: m.company_id,
        brand: m.brand || m.company_name || company.name,
        kind: m.kind,
        ref_id: m.ref_id,
        portal_path: m.portal_path,
        summary: summarizeCharges(
          m.company_id,
          String(m.brand || m.company_name || company.name),
          m.kind,
          m.ref_id,
          charges
        ),
        charges,
        payments,
      });
    }

    return NextResponse.json({ success: true, accounts });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await authUser(request);
    if (!gate.ok) return gate.response;
    const profile = await loadB2cProfile(gate.userId);
    if (!profile) {
      return NextResponse.json({ error: 'No member profile' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    let proofFile: File | null = null;
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = {
        action: form.get('action'),
        companyId: form.get('companyId'),
        charge_ids: form.get('charge_ids'),
        reference: form.get('reference'),
        notes: form.get('notes'),
      };
      const f = form.get('file');
      if (f instanceof File) proofFile = f;
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }

    const action = String(body.action || '');
    const companyId = Number(body.companyId);

    if (action === 'verify') {
      const reference = String(body.reference || '').trim();
      if (!reference) {
        return NextResponse.json({ error: 'reference required' }, { status: 400 });
      }
      const v = await verifyPaystackTransaction(reference);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      const applied = await applyMemberAccountPaystack({
        data: {
          reference,
          metadata: {
            ...(v.metadata || {}),
            company_id:
              (v.metadata as { company_id?: number } | null)?.company_id ||
              companyId,
          },
        },
        reference,
        amountCents: v.amount,
      });
      if (!applied.ok) {
        return NextResponse.json({ error: applied.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: 'Payment recorded',
      });
    }

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const memberships = (profile.memberships || []).filter(
      (m): m is B2cMembership & { kind: AdvisorAccountKind } =>
        m.company_id === companyId && isAdvisorMembership(m)
    );
    if (!memberships.length) {
      return NextResponse.json(
        { error: 'This wallet is not linked to that Advisor' },
        { status: 403 }
      );
    }

    const company = await loadWalletCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    let store = readMemberAccountStore(company.meta);

    const rawIds = body.charge_ids;
    const chargeIds = Array.isArray(rawIds)
      ? rawIds.map(String)
      : String(rawIds || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const allowed = new Set<string>();
    for (const m of memberships) {
      for (const c of chargesForMember(store, {
        kind: m.kind,
        ref_id: m.ref_id,
        email: profile.email,
        userId: profile.user_id,
      })) {
        allowed.add(c.id);
      }
    }
    const selected = openChargesByIds(
      store,
      chargeIds.filter((id) => allowed.has(id))
    );
    if (!selected.length) {
      return NextResponse.json(
        { error: 'Select at least one open charge' },
        { status: 400 }
      );
    }
    const amountZar = selected.reduce(
      (n, c) => n + Number(c.amount_zar || 0),
      0
    );

    if (action === 'pay') {
      const email = String(profile.email || '').trim();
      if (!email.includes('@')) {
        return NextResponse.json(
          { error: 'Add an email to your SA Member profile to pay' },
          { status: 400 }
        );
      }
      const paymentId = newMemberAccountId('map');
      const reference = `sa-memacc-${companyId}-${Date.now().toString(36)}`;
      const init = await initializePaystackTransaction({
        email,
        amountCents: Math.round(amountZar * 100),
        currency: 'ZAR',
        reference,
        callbackUrl: `${getAppUrl()}/me?tab=memberships&pay=1&ref=${encodeURIComponent(reference)}&companyId=${companyId}`,
        metadata: {
          product: 'member_account',
          company_id: companyId,
          payment_id: paymentId,
          charge_ids: selected.map((c) => c.id).join(','),
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: 'member_account' },
            { display_name: 'Company', variable_name: 'company_id', value: String(companyId) },
            { display_name: 'Payment', variable_name: 'payment_id', value: paymentId },
            {
              display_name: 'Charges',
              variable_name: 'charge_ids',
              value: selected.map((c) => c.id).join(','),
            },
          ],
        },
      });
      if (!init.ok) {
        return NextResponse.json({ error: init.error }, { status: 502 });
      }
      store = addPayment(store, {
        id: paymentId,
        charge_ids: selected.map((c) => c.id),
        amount_zar: amountZar,
        method: 'paystack',
        status: 'pending',
        reference,
        paystack_ref: reference,
        paid_at: new Date().toISOString(),
        member_name: profile.full_name || selected[0]?.member_name,
        member_email: email,
        member_user_id: profile.user_id,
        kind: selected[0]?.kind,
        ref_id: selected[0]?.ref_id,
      });
      await saveWalletCompanyMeta(
        companyId,
        writeMemberAccountStore(company.meta, store)
      );
      return NextResponse.json({
        success: true,
        authorization_url: init.authorizationUrl,
        access_code: init.accessCode,
        reference: init.reference,
        amount_zar: amountZar,
      });
    }

    if (action === 'pop') {
      let proofUrl: string | null = body.proof_url
        ? String(body.proof_url)
        : null;
      if (proofFile) {
        if (proofFile.size > 8 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Proof file must be under 8MB' },
            { status: 400 }
          );
        }
        const ext =
          proofFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
          'jpg';
        const filePath = `member-pop/${companyId}/${gate.userId.slice(-12)}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await proofFile.arrayBuffer());
        const supabase = getSupabaseServer();
        for (const bucket of COMPANY_IMAGE_BUCKETS) {
          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, buffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: proofFile.type || 'application/octet-stream',
            });
          if (!error) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            proofUrl = data.publicUrl;
            break;
          }
        }
      }
      const reference = String(body.reference || '').trim();
      const paymentId = newMemberAccountId('map');
      store = markChargesPendingPop(
        store,
        selected.map((c) => c.id)
      );
      store = addPayment(store, {
        id: paymentId,
        charge_ids: selected.map((c) => c.id),
        amount_zar: amountZar,
        method: 'pop',
        status: 'pending',
        reference: reference || null,
        proof_url: proofUrl,
        notes: body.notes ? String(body.notes) : null,
        paid_at: new Date().toISOString(),
        member_name: profile.full_name || selected[0]?.member_name,
        member_email: profile.email || selected[0]?.member_email,
        member_user_id: profile.user_id,
        kind: selected[0]?.kind,
        ref_id: selected[0]?.ref_id,
      });
      await saveWalletCompanyMeta(
        companyId,
        writeMemberAccountStore(company.meta, store)
      );
      const name = profile.full_name || selected[0]?.member_name || 'Member';
      await notifyAdvisorOfMemberPayment({
        companyId,
        title: 'Proof of payment received',
        body: `${name} submitted proof of payment for ${formatZar(amountZar)}. Confirm it on Accounts.`,
        amountZar,
        memberName: name,
        method: 'pop',
        reference: reference || paymentId,
        deskPath: deskPathForKind(selected[0]?.kind || 'gym'),
        actorUserId: profile.user_id,
      });
      return NextResponse.json({
        success: true,
        message: 'Proof of payment sent to the Advisor',
        payment_id: paymentId,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
