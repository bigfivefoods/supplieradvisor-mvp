import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  companyIdFromQuery,
  legacyPrivyFrom,
  requireCompanyRoles,
} from '@/lib/auth/api-auth';
import { accountAad, accountServiceKeyAad, encryptionKey, openSecret, sealSecret, serviceKeyAad } from '@/lib/fitness/netcash/crypto';
import { sastStamp } from '@/lib/fitness/netcash/calendar';
import { createNetcashClient } from '@/lib/fitness/netcash/client';
import { createNiwsCaller, createTestModeNiwsCaller, probeDebitOrderServiceKey } from '@/lib/fitness/netcash/niws-http';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import { NETCASH_ADMIN_ROLES } from '@/lib/fitness/netcash/permissions';
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
  const auth = await requireCompanyRoles(request, companyId, [...NETCASH_ADMIN_ROLES], {
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

export function netcashDeps(gymName?: string, companyId?: number): ServiceDeps {
  const key = encryptionKey();
  return {
    repo: supabaseNetcashRepo(),
    invoices: supabaseInvoices(),
    gymName,
    clientFor(mode) {
      if (process.env.GYM_NETCASH_ALLOW_NETWORK === '1' && companyId) {
        const caller = createNiwsCaller({
          mode,
          companyId,
          fetchImpl: async (url, init) => {
            const response = await fetch(url, { ...init, redirect: 'manual' });
            return { status: response.status, body: await response.text() };
          },
        });
        const mock = createNetcashClient(mode);
        return {
          ...mock,
          async validateAccount(input) {
            const { validateWithNetcash } = await import('@/lib/fitness/netcash/niws-http');
            const accountServiceKey = String((input as { accountServiceKey?: string }).accountServiceKey || '');
            if (!accountServiceKey) return mock.validateAccount(input);
            return validateWithNetcash(caller, { ...input, accountServiceKey });
          },
          async uploadMasterfile(input) {
            if (!input.fileBody) return { ok: false, error: 'The masterfile was not built.' };
            const { uploadNiwsFile } = await import('@/lib/fitness/netcash/niws-http');
            const serviceKey = headerKey(input.fileBody);
            const uploaded = await uploadNiwsFile(caller, serviceKey, input.fileBody, headerBatch(input.fileBody));
            return uploaded.ok ? { ok: true, batchId: uploaded.fileToken } : uploaded;
          },
          async submitDebitBatch(input) {
            if (!input.fileBody) return { ok: false, error: 'The debit batch was not built.' };
            const { uploadNiwsFile } = await import('@/lib/fitness/netcash/niws-http');
            const uploaded = await uploadNiwsFile(caller, headerKey(input.fileBody), input.fileBody, headerBatch(input.fileBody));
            return uploaded.ok ? { ok: true, batchId: uploaded.fileToken } : uploaded;
          },
          async fetchResults(input) {
            const { readStatement, resultsFromStatement } = await import('@/lib/fitness/netcash/niws-http');
            const accountServiceKey = input.accountServiceKey || '';
            if (!accountServiceKey) return { ok: false, error: 'Store the Netcash account service key before fetching a statement.' };
            const statement = await readStatement(caller, accountServiceKey, input.actionDate || '');
            if (!statement.ok) return statement;
            return {
              ok: true,
              results: resultsFromStatement(
                statement.body,
                input.rows.map((row) => ({
                  netcashRef: row.netcashRef,
                  memberId: row.memberId || '',
                  invoiceNumber: row.invoiceNumber || '',
                }))
              ),
            };
          },
        };
      }
      return createNetcashClient(mode);
    },
    sealServiceKey(companyId, value) {
      if (!key) return null;
      return sealSecret(value, key, serviceKeyAad(companyId));
    },
    sealAccountKey(companyId, value) {
      if (!key) return null;
      return sealSecret(value, key, accountServiceKeyAad(companyId));
    },
    openServiceKey(companyId, settings) {
      if (!key || !settings.serviceKeyEnc) return null;
      return openSecret(settings.serviceKeyEnc, key, serviceKeyAad(companyId));
    },
    openAccountKey(companyId, settings) {
      if (!key || !settings.accountKeyEnc) return null;
      return openSecret(settings.accountKeyEnc, key, accountServiceKeyAad(companyId));
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
    async probeDebitOrderKey(id, serviceKey) {
      const caller = createTestModeNiwsCaller({
        companyId: id,
        fetchImpl: async (url, init) => {
          try {
            const response = await fetch(url, { ...init, redirect: 'manual' });
            return { status: response.status, body: await response.text() };
          } catch {
            throw new Error('Netcash did not accept the request.');
          }
        },
      });
      return probeDebitOrderServiceKey(caller, serviceKey, sastStamp(new Date()).date);
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

function headerKey(fileBody: string): string {
  return fileBody.split('\t')[1] || '';
}

function headerBatch(fileBody: string): string {
  return fileBody.split('\t')[4] || '';
}

export function netcashActor(auth: { name?: string | null; email?: string | null; userId: string }): string {
  const name = String(auth.name || '').replace(/\s+/g, ' ').trim();
  if (name) return name.slice(0, 80);
  const email = String(auth.email || '').trim();
  if (email && !email.includes(' ')) return email.slice(0, 80);
  return String(auth.userId || '').slice(0, 80);
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const status = /not found/i.test(message) ? 404 : /locked|cannot|before|required|invalid|select|enter|consent/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
