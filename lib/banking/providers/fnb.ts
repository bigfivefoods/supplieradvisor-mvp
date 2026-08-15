/**
 * FNB / FirstRand Integration Channel — statements API.
 *
 * Env (never commit secrets):
 *   FNB_CLIENT_ID
 *   FNB_CLIENT_SECRET
 *   FNB_API_BASE          default https://api.fnb.co.za
 *   FNB_TOKEN_URL         default https://api.fnb.co.za/apigateway/oauth2/token/v2
 *   FNB_ACCOUNT_NUMBER    operating account for statement pulls
 *   FNB_STATEMENT_PATH    Transaction History URL or path from the subscribe pack
 *   FNB_SCOPE             optional OAuth scope
 *
 * Auth: OAuth2 client credentials (form + Basic), then JWT client-assertion.
 * Statements: POST RetrieveRealtimeStatement / ISO 20022 camt.053 JSON.
 */
import { createHmac, randomUUID } from 'crypto';
import type { CanonicalTxn } from '../types';
import { providerTxnId } from '../ingest';

const DEFAULT_BASE = 'https://api.fnb.co.za';
const DEFAULT_TOKEN_URL =
  'https://api.fnb.co.za/apigateway/oauth2/token/v2';

export function fnbConfig() {
  const clientId = (process.env.FNB_CLIENT_ID || '').trim();
  const clientSecret = (process.env.FNB_CLIENT_SECRET || '').trim();
  const base = (process.env.FNB_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const tokenUrl = (process.env.FNB_TOKEN_URL || DEFAULT_TOKEN_URL).trim();
  const accountNumber = (process.env.FNB_ACCOUNT_NUMBER || '').trim();
  const statementPath = (process.env.FNB_STATEMENT_PATH || '').trim();
  const scope = (process.env.FNB_SCOPE || '').trim();
  return {
    clientId,
    clientSecret,
    base,
    tokenUrl,
    accountNumber,
    statementPath,
    scope,
    configured: Boolean(clientId && clientSecret),
  };
}

export function maskAccountNumber(raw?: string | null): string | null {
  const digits = String(raw || '').replace(/\s+/g, '');
  if (!digits) return null;
  return `…${digits.slice(-4)}`;
}

type TokenOk = {
  ok: true;
  accessToken: string;
  tokenUrl: string;
  expiresIn?: number;
};
type TokenFail = { ok: false; error: string; tried: string[] };

let cachedToken: { token: string; exp: number; url: string } | null = null;

function candidateTokenUrls(cfg: ReturnType<typeof fnbConfig>): string[] {
  if (cfg.tokenUrl) return [cfg.tokenUrl];
  const hosts = [
    cfg.base,
    'https://api.fnb.co.za',
    'https://openapi.fnb.co.za',
    'https://identity.fnb.co.za',
    'https://sso.fnb.co.za',
    'https://openapi.firstrand.co.za',
  ];
  const paths = [
    '/oauth/token',
    '/oauth2/token',
    '/oauth2/v1/token',
    '/auth/realms/fnb/protocol/openid-connect/token',
    '/connect/token',
    '/v1/oauth/token',
    '/token',
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hosts) {
    for (const p of paths) {
      const u = `${h.replace(/\/$/, '')}${p}`;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function clientAssertionJwt(cfg: ReturnType<typeof fnbConfig>, aud: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: cfg.clientId,
      sub: cfg.clientId,
      aud,
      iat: now,
      exp: now + 300,
      jti: randomUUID(),
    })
  ).toString('base64url');
  const data = `${header}.${payload}`;
  const sig = createHmac('sha256', cfg.clientSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function postToken(
  url: string,
  body: URLSearchParams,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...(extraHeaders || {}),
    },
    body,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text.slice(0, 240) };
  }
  return { status: res.status, json, text };
}

export async function getFnbAccessToken(opts?: {
  force?: boolean;
}): Promise<TokenOk | TokenFail> {
  const cfg = fnbConfig();
  if (!cfg.configured) {
    return { ok: false, error: 'FNB_CLIENT_ID / FNB_CLIENT_SECRET not set', tried: [] };
  }
  if (
    !opts?.force &&
    cachedToken &&
    cachedToken.exp > Date.now() + 15_000
  ) {
    return {
      ok: true,
      accessToken: cachedToken.token,
      tokenUrl: cachedToken.url,
    };
  }

  const tried: string[] = [];
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const urls = candidateTokenUrls(cfg);

  for (const url of urls) {
    const variants: Array<{
      label: string;
      body: URLSearchParams;
      headers?: Record<string, string>;
    }> = [
      {
        label: 'form+basic',
        headers: { Authorization: `Basic ${basic}` },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          ...(cfg.scope ? { scope: cfg.scope } : {}),
        }),
      },
      {
        label: 'ibm-client-headers',
        headers: {
          'X-IBM-Client-Id': cfg.clientId,
          'X-IBM-Client-Secret': cfg.clientSecret,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          ...(cfg.scope ? { scope: cfg.scope } : {}),
        }),
      },
      {
        label: 'form-body',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          ...(cfg.scope ? { scope: cfg.scope } : {}),
        }),
      },
      {
        label: 'jwt-assertion',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: cfg.clientId,
          client_assertion_type:
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: clientAssertionJwt(cfg, url),
          ...(cfg.scope ? { scope: cfg.scope } : {}),
        }),
      },
    ];

    for (const v of variants) {
      const tag = `${url} [${v.label}]`;
      try {
        const r = await postToken(url, v.body, v.headers);
        if (r.status === 404 || r.status === 0) {
          tried.push(`${tag} → ${r.status || 'unreachable'}`);
          break;
        }
        const token = String(
          r.json.access_token || r.json.accessToken || r.json.token || ''
        );
        if (r.status >= 200 && r.status < 300 && token) {
          const expiresIn = Number(r.json.expires_in || 3600);
          cachedToken = {
            token,
            url,
            exp: Date.now() + Math.max(60, expiresIn) * 1000,
          };
          return { ok: true, accessToken: token, tokenUrl: url, expiresIn };
        }
        const err =
          String(r.json.error_description || r.json.error || r.json.message || '') ||
          r.text.slice(0, 160) ||
          `HTTP ${r.status}`;
        tried.push(`${tag} → ${r.status} ${err}`);
        // 401/400 on this host: still try other variants; 404 skip host
        if (r.status === 401 || r.status === 403) continue;
      } catch (e) {
        tried.push(
          `${tag} → ${e instanceof Error ? e.message : 'request failed'}`
        );
        break;
      }
    }
  }

  return {
    ok: false,
    error:
      'Could not obtain an FNB access token. Set FNB_TOKEN_URL to the OAuth token endpoint from Integration Channel (subscribe / API pack).',
    tried,
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function pickStr(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return '';
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim()) return String(obj[k]).trim();
  }
  return '';
}

function walkEntries(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) walkEntries(n, out);
    return;
  }
  const o = asRecord(node);
  if (!o) return;
  if (o.Ntry || o.ntry || o.entries || o.transactions || o.Transactions) {
    const list =
      o.Ntry || o.ntry || o.entries || o.transactions || o.Transactions;
    walkEntries(list, out);
    return;
  }
  if (
    o.Amt ||
    o.amount ||
    o.Amount ||
    o.CdtDbtInd ||
    o.bookingDate ||
    o.BookgDt ||
    o.transactionAmount
  ) {
    out.push(o);
    return;
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') walkEntries(v, out);
  }
}

function signedAmount(row: Record<string, unknown>): number {
  const amtObj = asRecord(row.Amt) || asRecord(row.amount) || asRecord(row.Amount);
  const raw = Number(
    amtObj?.value ??
      amtObj?.Amt ??
      row.amount ??
      row.Amount ??
      row.statementAmount ??
      row.txnAmount ??
      0
  );
  if (!Number.isFinite(raw)) return 0;
  const ind = String(
    row.CdtDbtInd || row.creditDebitIndicator || row.direction || ''
  ).toUpperCase();
  if (ind.startsWith('DBIT') || ind === 'D' || ind === 'DEBIT') {
    return -Math.abs(raw);
  }
  if (ind.startsWith('CRDT') || ind === 'C' || ind === 'CREDIT') {
    return Math.abs(raw);
  }
  return raw;
}

function entryDate(row: Record<string, unknown>): string {
  const book = asRecord(row.BookgDt) || asRecord(row.bookingDate);
  const val = asRecord(row.ValDt) || asRecord(row.valueDate);
  const dt =
    pickStr(book, ['Dt', 'date', 'DtTm']) ||
    pickStr(val, ['Dt', 'date', 'DtTm']) ||
    pickStr(row, ['bookingDate', 'valueDate', 'transactionDate', 'date']);
  return (dt || new Date().toISOString()).slice(0, 10);
}

function entryDesc(row: Record<string, unknown>): string {
  const details = asRecord(row.NtryDtls) || asRecord(row.entryDetails);
  const tx = asRecord(details?.TxDtls) || asRecord(row.TxDtls);
  const rmt = asRecord(tx?.RmtInf) || asRecord(row.RmtInf);
  return (
    pickStr(rmt, ['Ustrd', 'ustrd']) ||
    pickStr(tx, ['AddtlTxInf']) ||
    pickStr(row, [
      'description',
      'narrative',
      'additionalInformation',
      'AddtlNtryInf',
    ]) ||
    'FNB transaction'
  );
}

function entryRef(row: Record<string, unknown>): string | null {
  const details = asRecord(row.NtryDtls);
  const tx = asRecord(details?.TxDtls);
  const refs = asRecord(tx?.Refs) || asRecord(row.Refs);
  const v =
    pickStr(refs, ['EndToEndId', 'TxId', 'AcctSvcrRef', 'InstrId']) ||
    pickStr(row, [
      'endToEndId',
      'endToEndReference',
      'reference',
      'entryId',
      'id',
      'NtryRef',
    ]);
  return v || null;
}

export function parseFnbStatementPayload(data: unknown): CanonicalTxn[] {
  const rows: Record<string, unknown>[] = [];
  walkEntries(data, rows);
  const txns: CanonicalTxn[] = [];
  for (const row of rows) {
    const amount = signedAmount(row);
    if (!amount) continue;
    const booked = entryDate(row);
    const description = entryDesc(row);
    const reference = entryRef(row);
    txns.push({
      provider: 'fnb',
      provider_txn_id: providerTxnId('fnb', [
        booked,
        amount,
        reference || '',
        description,
      ]),
      booked_at: booked,
      amount,
      currency: 'ZAR',
      description,
      reference,
      counterparty: null,
      balance_after: null,
      raw: row,
    });
  }
  return txns;
}

async function fnbJson(
  path: string,
  init: RequestInit & { token: string }
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const { token, ...rest } = init;
  const cfg = fnbConfig();
  const url = path.startsWith('http')
    ? path
    : `${cfg.base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(cfg.clientId ? { 'X-IBM-Client-Id': cfg.clientId } : {}),
        ...(rest.headers || {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 400) };
    }
    if (!res.ok) {
      const rec = asRecord(data);
      return {
        ok: false,
        status: res.status,
        data,
        error:
          pickStr(rec, ['error_description', 'error', 'message', 'detail']) ||
          text.slice(0, 200) ||
          res.statusText,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : 'FNB request failed',
    };
  }
}

export async function fetchFnbTransactions(opts?: {
  accountNumber?: string;
  from?: string;
  to?: string;
}): Promise<{
  txns: CanonicalTxn[];
  error?: string;
  tokenUrl?: string;
  tried?: string[];
}> {
  const cfg = fnbConfig();
  const token = await getFnbAccessToken();
  if (!token.ok) {
    return { txns: [], error: token.error, tried: token.tried };
  }

  const to = opts?.to || new Date().toISOString().slice(0, 10);
  const from =
    opts?.from ||
    new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const account = String(opts?.accountNumber || cfg.accountNumber || '').replace(
    /\s+/g,
    ''
  );
  const compact = { accountNumber: account, fromDate: from, toDate: to };
  const pascal = { AccountNumber: account, FromDate: from, ToDate: to };

  const paths: string[] = [];
  if (cfg.statementPath) paths.push(cfg.statementPath);
  paths.push(
    '/apigateway/transactionhistory/v1/getTransactionHistory',
    '/apigateway/transaction-history/v1/getTransactionHistory',
    '/apigateway/i_can_tran_hist/v1/getTransactionHistory',
    '/apigateway/accounts/v1/transactionhistory',
    '/apigateway/statements/v1/RetrieveRealtimeStatement',
    '/RetrieveRealtimeStatement',
    '/statements/realtime',
    '/v1/statements/realtime',
    '/camt053/retrieve'
  );

  const tried: string[] = [];
  if (!account) {
    return {
      txns: [],
      error:
        'FNB token is valid, but no operating account number was sent. Enter the FNB account on Connect bank, or set FNB_ACCOUNT_NUMBER.',
      tokenUrl: token.tokenUrl,
      tried,
    };
  }

  for (const path of paths) {
    const body = path.includes('camt053')
      ? { acct: { id: account }, frDt: from, toDt: to }
      : compact;
    const variants = path.includes('camt053') ? [body] : [compact, pascal];
    for (const payload of variants) {
      const res = await fnbJson(path, {
        token: token.accessToken,
        method: 'POST',
        body: JSON.stringify(payload),
      });
      tried.push(
        `${path} → ${res.status}${res.error ? ` ${res.error}` : ''}`
      );
      if (res.ok) {
        const txns = parseFnbStatementPayload(res.data);
        return { txns, tokenUrl: token.tokenUrl, tried };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          txns: [],
          error: res.error || 'FNB rejected the access token',
          tokenUrl: token.tokenUrl,
          tried,
        };
      }
      // 404 on this path — try next path, skip extra body shape
      if (res.status === 404) break;
    }
  }

  return {
    txns: [],
    error: account
      ? `FNB accepted the token (transaction-history scope) for account ${maskAccountNumber(account)}, but every statement URL returned 404. Paste the Transaction History resource URL from the Integration Channel subscribe pack as FNB_STATEMENT_PATH.`
      : 'Authenticated, but no statement endpoint accepted the request.',
    tokenUrl: token.tokenUrl,
    tried,
  };
}

export async function probeFnbIntegration(opts?: {
  accountNumber?: string;
}): Promise<{
  configured: boolean;
  clientIdMasked: string | null;
  accountMasked: string | null;
  statementPath: string | null;
  token: TokenOk | TokenFail;
  statement?: Awaited<ReturnType<typeof fetchFnbTransactions>>;
}> {
  const cfg = fnbConfig();
  const clientIdMasked = cfg.clientId
    ? `${cfg.clientId.slice(0, 2)}…${cfg.clientId.slice(-2)}`
    : null;
  const accountNumber = String(
    opts?.accountNumber || cfg.accountNumber || ''
  ).replace(/\s+/g, '');
  const token = await getFnbAccessToken({ force: true });
  let statement: Awaited<ReturnType<typeof fetchFnbTransactions>> | undefined;
  if (token.ok && accountNumber) {
    statement = await fetchFnbTransactions({ accountNumber });
  }
  return {
    configured: cfg.configured,
    accountMasked: maskAccountNumber(accountNumber),
    statementPath: cfg.statementPath || null,
    clientIdMasked,
    token,
    statement,
  };
}
