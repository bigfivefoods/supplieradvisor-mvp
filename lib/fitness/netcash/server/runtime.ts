import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  companyIdFromQuery,
  legacyPrivyFrom,
  requireCompanyRoles,
} from '@/lib/auth/api-auth';
import { accountAad, encryptionKey, openSecret, sealSecret, serviceKeyAad } from '@/lib/fitness/netcash/crypto';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import type { ServiceDeps } from '@/lib/fitness/netcash/service';
import { supabaseInvoices } from '@/lib/fitness/netcash/server/books';
import { supabaseNetcashRepo } from '@/lib/fitness/netcash/server/persist';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { getResend, getResendFrom } from '@/lib/resend';

export function readCompanyId(request: NextRequest, body?: Record<string, unknown>): number {
  const fromBody = Number(body?.companyId || 0);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  return companyIdFromQuery(request);
}

export async function requireNetcashAdmin(request: NextRequest, companyId: number) {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false as const, response: NextResponse.json({ error: 'A company is required.', code: 'BAD_COMPANY' }, { status: 400 }) };
  }
  const auth = await requireCompanyRoles(request, companyId, ['owner', 'admin'], {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const limited = rateLimit({ key: `gym-netcash:${auth.userId}:${companyId}`, limit: 40, windowMs: 60_000 });
  if (!limited.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Too many requests. Wait a moment and try again.', code: 'RATE_LIMIT' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      ),
    };
  }
  const allowed = companyAllowed(companyId);
  if (!allowed.ok) {
    return { ok: false as const, response: NextResponse.json({ error: allowed.error, code: 'COMPANY_LOCKED' }, { status: 403 }) };
  }
  return { ok: true as const, auth, ip: clientIp(request) };
}

export function netcashDeps(gymName?: string): ServiceDeps {
  const key = encryptionKey();
  return {
    repo: supabaseNetcashRepo(),
    invoices: supabaseInvoices(),
    gymName,
    sealServiceKey(companyId, value) {
      if (!key) return null;
      return sealSecret(value, key, serviceKeyAad(companyId));
    },
    sealAccount(companyId, mandateId, account) {
      if (!key) return null;
      return sealSecret(account, key, accountAad(companyId, mandateId));
    },
    openAccount(companyId, mandate) {
      if (!key || !mandate.accountNumberEnc) return null;
      return openSecret(mandate.accountNumberEnc, key, accountAad(companyId, mandate.id));
    },
    sealFile(companyId, body) {
      if (!key) return null;
      return sealSecret(body, key, `gym-netcash-file:${companyId}`);
    },
    async mailer(input) {
      try {
        const resend = getResend();
        await resend.emails.send({
          from: getResendFrom(),
          to: input.to,
          subject: input.subject,
          text: input.text,
          tags: [{ name: 'company_id', value: String(input.companyId) }],
        });
        return { ok: true };
      } catch {
        return { ok: false, skipped: true };
      }
    },
  };
}

export async function loadBillable(companyId: number) {
  const { loadFitgraphMerged } = await import('@/lib/fitness/fitgraph-io');
  const { billableFromGym } = await import('@/lib/fitness/netcash/members');
  const loaded = await loadFitgraphMerged(companyId);
  const gymName = String(loaded.store.settings?.brand_name || 'GymAdvisor®');
  return {
    gymName,
    members: billableFromGym({
      clients: loaded.store.clients || [],
      plans: loaded.store.membership_plans || [],
      subscriptions: loaded.store.subscriptions || [],
    }),
  };
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const status = /not found/i.test(message) ? 404 : /locked|cannot|before|required|invalid|select|enter|consent/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
