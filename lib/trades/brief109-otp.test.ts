/**
 * Brief 109 — TradeAdvisor® sign-in codes cannot be guessed, and a blank
 * email cannot open whichever customer matches.
 * Run: npx --yes tsx lib/trades/brief109-otp.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextRequest } from 'next/server';
import { GET, POST } from '../../app/api/public/tradegraph/route';
import { hashSecret } from './customer-session';
import {
  customerAuthFailure,
  digestsMatch,
  openCustomerSession,
  OTP_DENIAL_MESSAGE,
  OTP_FAIL_WINDOW_MS,
  OTP_FAILS_PER_BOOK,
  OTP_FAILS_PER_CODE,
  OTP_FAILS_PER_EMAIL,
  OTP_HOURLY_CAP,
  OTP_TOO_MANY_MESSAGE,
  recentInviteCount,
  resetOtpMigrationWarning,
  respondToOtpRequest,
  TRADE_INVITE_GENERIC,
  type CustomerAuthStore,
  type LiveInvite,
} from './customer-auth';

const COMPANY = 7;
const NOW = Date.parse('2026-10-14T12:00:00.000Z');

type StoredInvite = LiveInvite & {
  company_id: number;
  expires_at: string;
  used_at: string | null;
};

function invite(partial: {
  id?: string;
  email: string;
  customerId: string;
  otp?: string;
  magic?: string;
  failed_attempts?: number;
  used_at?: string | null;
  companyId?: number;
}): StoredInvite {
  return {
    id: partial.id || 'ti_one',
    company_id: partial.companyId ?? COMPANY,
    customer_id: partial.customerId,
    email: partial.email,
    otp_hash: partial.otp ? hashSecret(partial.otp) : null,
    magic_hash: partial.magic ? hashSecret(partial.magic) : null,
    created_at: new Date(NOW - 60_000).toISOString(),
    expires_at: new Date(NOW + 7 * 864e5).toISOString(),
    used_at: partial.used_at ?? null,
    failed_attempts: partial.failed_attempts ?? 0,
  };
}

function memoryStore(opts: {
  invites: StoredInvite[];
  attemptsReady?: boolean;
  windowReady?: boolean;
}) {
  const invites = opts.invites.map((row) => ({ ...row }));
  const failures: Array<{ companyId: number; email: string; at: number }> = [];
  const sessions: Array<{ customerId: string; tokenHash: string }> = [];
  const asked: Array<string | undefined> = [];
  const attemptsReady = opts.attemptsReady !== false;
  const windowReady = opts.windowReady !== false;
  const store: CustomerAuthStore = {
    async listLiveInvites(query) {
      asked.push(query.email);
      const rows = invites
        .filter(
          (row) =>
            row.company_id === query.companyId &&
            !row.used_at &&
            Date.parse(row.expires_at) > query.now &&
            (query.email ? row.email === query.email : true)
        )
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          customer_id: row.customer_id,
          email: row.email,
          otp_hash: row.otp_hash,
          magic_hash: row.magic_hash,
          created_at: row.created_at,
          failed_attempts: attemptsReady ? row.failed_attempts : 0,
        }));
      return { invites: rows, attemptsReady };
    },
    async failureWindow(query) {
      if (!windowReady) return { emailCount: 0, bookCount: 0, ready: false };
      const since = query.now - OTP_FAIL_WINDOW_MS;
      const rows = failures.filter(
        (row) => row.companyId === query.companyId && row.at >= since
      );
      return {
        emailCount: rows.filter((row) => row.email === query.email).length,
        bookCount: rows.length,
        ready: true,
      };
    },
    async noteFailure(query) {
      failures.push({ companyId: query.companyId, email: query.email, at: query.now });
      if (!attemptsReady) return;
      for (const row of invites) {
        if (row.company_id !== query.companyId || row.email !== query.email) continue;
        if (row.used_at || Date.parse(row.expires_at) <= query.now) continue;
        row.failed_attempts += 1;
        if (row.failed_attempts >= OTP_FAILS_PER_CODE) {
          row.used_at = new Date(query.now).toISOString();
        }
      }
    },
    async markUsed(id, usedAt) {
      const row = invites.find((item) => item.id === id);
      if (row) row.used_at = usedAt;
    },
    async insertSession(row) {
      sessions.push({ customerId: row.customerId, tokenHash: row.tokenHash });
    },
  };
  return { store, invites, failures, sessions, asked };
}

function post(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    cookies: { get: () => undefined },
    nextUrl: new URL('http://localhost/api/public/tradegraph'),
  } as unknown as NextRequest;
}

function denied(result: { ok: boolean; status?: number }): asserts result is { ok: false; status: 401 | 429 } {
  assert.equal(result.ok, false);
}

async function main() {
  const sameDenial = customerAuthFailure(401);
  assert.deepEqual(sameDenial, { error: OTP_DENIAL_MESSAGE });
  assert.deepEqual(customerAuthFailure(429), { error: OTP_TOO_MANY_MESSAGE });
  assert.equal(digestsMatch(hashSecret('042817'), hashSecret('042817')), true);
  assert.equal(digestsMatch(hashSecret('042817'), hashSecret('042818')), false);
  assert.equal(digestsMatch('', hashSecret('042817')), false);
  assert.equal(digestsMatch('abcd', hashSecret('042817')), false);

  const code = '042817';
  const correct = memoryStore({
    invites: [invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code })],
  });
  const opened = await openCustomerSession({
    companyId: COMPANY,
    email: 'Naledi@Example.com',
    otp: code,
    store: correct.store,
    now: NOW,
  });
  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.customerId, 'tc_naledi');
    assert.ok(opened.token.length >= 20);
    assert.equal(correct.sessions[0]?.tokenHash, hashSecret(opened.token));
  }
  assert.equal(correct.asked[0], 'naledi@example.com');
  assert.equal(correct.failures.length, 0);
  assert.ok(correct.invites[0]?.used_at);
  assert.equal(correct.invites[0]?.failed_attempts, 0);

  const blank = memoryStore({
    invites: [invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code })],
  });
  const blankResult = await openCustomerSession({
    companyId: COMPANY,
    email: '   ',
    otp: code,
    store: blank.store,
    now: NOW,
  });
  denied(blankResult);
  assert.equal(blankResult.status, 401);
  assert.deepEqual(customerAuthFailure(blankResult.status), sameDenial);
  assert.equal(blank.asked.length, 0);
  assert.equal(blank.sessions.length, 0);
  assert.equal(blank.invites[0]?.used_at, null);

  const other = memoryStore({
    invites: [
      invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code }),
      invite({
        id: 'ti_sipho',
        email: 'sipho@example.com',
        customerId: 'tc_sipho',
        otp: '246801',
      }),
    ],
  });
  const otherResult = await openCustomerSession({
    companyId: COMPANY,
    email: 'sipho@example.com',
    otp: code,
    store: other.store,
    now: NOW,
  });
  denied(otherResult);
  assert.equal(otherResult.status, 401);
  assert.deepEqual(customerAuthFailure(otherResult.status), sameDenial);
  assert.deepEqual(other.asked, ['sipho@example.com']);
  assert.equal(other.sessions.length, 0);
  assert.equal(other.invites[0]?.failed_attempts, 0);
  assert.equal(other.invites[1]?.failed_attempts, 1);

  const burned = memoryStore({
    invites: [invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code })],
  });
  for (let attempt = 1; attempt <= OTP_FAILS_PER_CODE; attempt += 1) {
    const wrong = await openCustomerSession({
      companyId: COMPANY,
      email: 'naledi@example.com',
      otp: '000000',
      store: burned.store,
      now: NOW,
    });
    denied(wrong);
    assert.equal(wrong.status, 401, `wrong code ${attempt} should be denied`);
  }
  assert.equal(burned.invites[0]?.failed_attempts, OTP_FAILS_PER_CODE);
  assert.ok(burned.invites[0]?.used_at);
  const sixth = await openCustomerSession({
    companyId: COMPANY,
    email: 'naledi@example.com',
    otp: code,
    store: burned.store,
    now: NOW,
  });
  denied(sixth);
  assert.equal(sixth.status, 401);
  assert.equal(burned.sessions.length, 0);

  const alreadyBurned = memoryStore({
    invites: [
      invite({
        email: 'naledi@example.com',
        customerId: 'tc_naledi',
        otp: code,
        failed_attempts: OTP_FAILS_PER_CODE,
      }),
    ],
  });
  const skipped = await openCustomerSession({
    companyId: COMPANY,
    email: 'naledi@example.com',
    otp: code,
    store: alreadyBurned.store,
    now: NOW,
  });
  denied(skipped);
  assert.equal(skipped.status, 401);
  assert.equal(alreadyBurned.sessions.length, 0);
  assert.ok(alreadyBurned.invites[0]?.used_at);

  const both = memoryStore({
    invites: [
      invite({ id: 'ti_a', email: 'naledi@example.com', customerId: 'tc_naledi', otp: code }),
      invite({ id: 'ti_b', email: 'naledi@example.com', customerId: 'tc_naledi', otp: '111111' }),
    ],
  });
  const counted = await openCustomerSession({
    companyId: COMPANY,
    email: 'naledi@example.com',
    otp: '999999',
    store: both.store,
    now: NOW,
  });
  denied(counted);
  assert.equal(counted.status, 401);
  assert.equal(both.invites[0]?.failed_attempts, 1);
  assert.equal(both.invites[1]?.failed_attempts, 1);

  const emailCap = memoryStore({
    invites: [invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code })],
  });
  for (let attempt = 1; attempt <= OTP_FAILS_PER_EMAIL; attempt += 1) {
    const wrong = await openCustomerSession({
      companyId: COMPANY,
      email: 'naledi@example.com',
      otp: '000000',
      store: emailCap.store,
      now: NOW,
    });
    denied(wrong);
    assert.equal(wrong.status, 401, `email failure ${attempt} is still a denial`);
  }
  const eleventh = await openCustomerSession({
    companyId: COMPANY,
    email: 'naledi@example.com',
    otp: code,
    store: emailCap.store,
    now: NOW,
  });
  denied(eleventh);
  assert.equal(eleventh.status, 429);
  assert.deepEqual(customerAuthFailure(eleventh.status), { error: OTP_TOO_MANY_MESSAGE });
  assert.equal(emailCap.sessions.length, 0);
  const later = await openCustomerSession({
    companyId: COMPANY,
    email: 'naledi@example.com',
    otp: '000000',
    store: emailCap.store,
    now: NOW + OTP_FAIL_WINDOW_MS + 1,
  });
  denied(later);
  assert.equal(later.status, 401);

  const bookCap = memoryStore({ invites: [] });
  for (let attempt = 0; attempt < OTP_FAILS_PER_BOOK; attempt += 1) {
    const wrong = await openCustomerSession({
      companyId: COMPANY,
      email: `guest${attempt}@example.com`,
      otp: '000000',
      store: bookCap.store,
      now: NOW,
    });
    denied(wrong);
    assert.equal(wrong.status, 401, `book failure ${attempt + 1} is still a denial`);
  }
  const fiftyFirst = await openCustomerSession({
    companyId: COMPANY,
    email: 'guest50@example.com',
    otp: '000000',
    store: bookCap.store,
    now: NOW,
  });
  denied(fiftyFirst);
  assert.equal(fiftyFirst.status, 429);
  assert.equal(bookCap.sessions.length, 0);

  let sent = 0;
  const quiet = await respondToOtpRequest({
    companyId: COMPANY,
    email: 'naledi@example.com',
    hasCustomer: true,
    send: async () => {
      sent += 1;
    },
    read: async () => ({ count: null, error: { message: 'connection reset' } }),
  });
  assert.deepEqual(quiet, TRADE_INVITE_GENERIC);
  assert.equal(sent, 0);
  const countedCap = await recentInviteCount(COMPANY, 'naledi@example.com', async () => ({
    count: null,
    error: { message: 'connection reset' },
  }));
  assert.ok(countedCap >= OTP_HOURLY_CAP);
  const thrown = await recentInviteCount(COMPANY, 'naledi@example.com', async () => {
    throw new Error('db down');
  });
  assert.ok(thrown >= OTP_HOURLY_CAP);

  const magicSecret = 'm'.repeat(64);
  const magicBook = memoryStore({
    invites: [
      invite({
        email: 'naledi@example.com',
        customerId: 'tc_naledi',
        otp: code,
        magic: magicSecret,
      }),
    ],
  });
  const magicOpened = await openCustomerSession({
    companyId: COMPANY,
    magic: magicSecret,
    store: magicBook.store,
    now: NOW,
  });
  assert.equal(magicOpened.ok, true);
  if (magicOpened.ok) assert.equal(magicOpened.customerId, 'tc_naledi');
  assert.equal(magicBook.failures.length, 0);
  assert.deepEqual(magicBook.asked, [undefined]);

  resetOtpMigrationWarning();
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    const fallback = memoryStore({
      invites: [invite({ email: 'naledi@example.com', customerId: 'tc_naledi', otp: code, magic: magicSecret })],
      attemptsReady: false,
      windowReady: false,
    });
    const stillOpens = await openCustomerSession({
      companyId: COMPANY,
      email: 'naledi@example.com',
      otp: code,
      store: fallback.store,
      now: NOW,
    });
    assert.equal(stillOpens.ok, true);
    const magicStill = await openCustomerSession({
      companyId: COMPANY,
      magic: magicSecret,
      store: fallback.store,
      now: NOW + 1,
    });
    assert.equal(magicStill.ok, false, 'the code path already marked the invite used');
    const freshMagic = memoryStore({
      invites: [
        invite({
          email: 'naledi@example.com',
          customerId: 'tc_naledi',
          magic: magicSecret,
        }),
      ],
      attemptsReady: false,
      windowReady: false,
    });
    const magicWithoutColumn = await openCustomerSession({
      companyId: COMPANY,
      magic: magicSecret,
      store: freshMagic.store,
      now: NOW,
    });
    assert.equal(magicWithoutColumn.ok, true);
    assert.equal(freshMagic.failures.length, 0);
    assert.ok(warnings.some((line) => line.includes('failed_attempts')));
    assert.ok(warnings.every((line) => !line.includes(code) && !line.includes('naledi@example.com')));
  } finally {
    console.warn = originalWarn;
  }

  const demo = await GET({
    nextUrl: new URL('http://localhost/api/public/tradegraph?token=demo'),
  } as unknown as NextRequest);
  const demoBody = (await demo.json()) as { brand?: string; trade?: string };
  assert.equal(demo.status, 200);
  assert.equal(demoBody.brand, 'Harbour Plumbing');
  assert.equal(demoBody.trade, 'plumber');
  assert.equal(demo.cookies.get('sa_trade_customer'), undefined);

  const blankHttp = await POST(
    post({
      action: 'verify_otp',
      token: 'tg_real_probe_109',
      email: '',
      code: '000000',
    })
  );
  const blankBody = await blankHttp.json();
  assert.equal(blankHttp.status, 401);
  assert.deepEqual(blankBody, sameDenial);
  assert.equal(blankHttp.cookies.get('sa_trade_customer'), undefined);
  assert.equal(
    (blankHttp.headers.get('set-cookie') || '').includes('sa_trade_customer'),
    false
  );

  const missingEmail = await POST(
    post({ action: 'verify_otp', token: 'tg_real_probe_109b', code: code })
  );
  assert.equal(missingEmail.status, 401);
  assert.deepEqual(await missingEmail.json(), sameDenial);
  assert.equal(missingEmail.cookies.get('sa_trade_customer'), undefined);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await POST(
      post({
        action: 'verify_otp',
        token: 'tg_ip_probe_109',
        email: '',
        code: '000000',
      })
    );
    assert.equal(response.status, 401);
    assert.equal(response.cookies.get('sa_trade_customer'), undefined);
  }
  const limited = await POST(
    post({
      action: 'verify_otp',
      token: 'tg_ip_probe_109',
      email: 'naledi@example.com',
      code,
    })
  );
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: OTP_TOO_MANY_MESSAGE });
  assert.equal(limited.cookies.get('sa_trade_customer'), undefined);

  const demoAfter = await GET({
    nextUrl: new URL('http://localhost/api/public/tradegraph?token=demo'),
  } as unknown as NextRequest);
  const demoAfterBody = (await demoAfter.json()) as { brand?: string };
  assert.equal(demoAfter.status, 200);
  assert.equal(demoAfterBody.brand, 'Harbour Plumbing');

  const auth = readFileSync(resolve('lib/trades/customer-auth.ts'), 'utf8');
  assert.match(auth, /timingSafeEqual/);
  assert.doesNotMatch(auth, /otp_hash ===/);
  assert.match(auth, /failed_attempts \+ 1|noteFailure/);
  const route = readFileSync(resolve('app/api/public/tradegraph/route.ts'), 'utf8');
  const gateAt = route.indexOf('respondToOtpRequest');
  const sendAt = route.indexOf('sendTradeEmail');
  assert.ok(gateAt > 0 && gateAt < sendAt);
  assert.ok(route.indexOf('customerAuthFailure(401)') < route.indexOf('workspaceByToken(publicToken)'));
  assert.match(route, /limit: VERIFY_IP_LIMIT/);
  assert.match(route, /token === 'demo'/);

  const migration = readFileSync(
    resolve('supabase/migrations/20261017_trade_otp_failed_attempts.sql'),
    'utf8'
  );
  assert.match(migration, /failed_attempts int not null default 0/i);
  assert.match(migration, /failed_attempts = failed_attempts \+ 1/);
  assert.match(migration, /trade_otp_failures/);
  const previous = readFileSync(resolve('supabase/migrations/20261014_tradegraph.sql'), 'utf8');
  assert.doesNotMatch(previous, /failed_attempts/);
  const ics = readFileSync(resolve('supabase/migrations/20261016_tradegraph_ics_token.sql'), 'utf8');
  assert.doesNotMatch(ics, /failed_attempts/);

  const smoke = readFileSync(resolve('e2e/auth-smoke.spec.ts'), 'utf8');
  assert.match(smoke, /tg_real_probe_109/);
  assert.match(smoke, /sa_trade_customer/);
  assert.match(smoke, /not\.toBe\(200\)/);

  console.log('brief109-otp.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
