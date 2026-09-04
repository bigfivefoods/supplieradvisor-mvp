/**
 * Brief 62 — claims route authz regression test
 * Run: npx --yes tsx lib/customers/brief62-claims-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/customers/claims/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in claims/route.ts`);
  let depth = 0;
  let inside = false;
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
      inside = true;
    } else if (src[i] === '}') {
      depth--;
    }
    if (inside && depth === 0) {
      end = i;
      break;
    }
  }
  return src.slice(start, end + 1);
}

const getFn = extractFn('GET');
const postFn = extractFn('POST');
const patchFn = extractFn('PATCH');
const deleteFn = extractFn('DELETE');
const flatPatch = patchFn.replace(/\s+/g, ' ');
const flatDelete = deleteFn.replace(/\s+/g, ' ');

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must keep returning _gate.response on !ok');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');
assert.ok(deleteFn.includes('_gate.response'), 'DELETE must return _gate.response on !ok');

assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('getSupabaseServer'),
  'PATCH must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  deleteFn.indexOf('requireCompanyAccess') < deleteFn.indexOf('getSupabaseServer'),
  'DELETE must call requireCompanyAccess before getSupabaseServer'
);

assert.match(patchFn, /!Number\.isFinite\(claimId\)\s*\|\|\s*claimId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.ok(deleteFn.includes("searchParams.get('companyId')"), 'DELETE must read companyId from search params');

const patchProfileScopes = patchFn.match(/\.eq\((['"])profile_id\1,\s*companyId\)/g)?.length || 0;
assert.ok(patchProfileScopes >= 2, 'PATCH must scope pre-read and update with profile_id/companyId');
assert.match(flatPatch, /\.update\(updates\)\s*\.eq\('id', claimId\)\s*\.eq\('profile_id', companyId\)/);
assert.match(flatDelete, /\.delete\(\)\s*\.eq\('id', id\)\s*\.eq\('profile_id', companyId\)/);
assert.doesNotMatch(
  flatDelete,
  /\.delete\(\)\.eq\('id', id\)(?!\.eq\('profile_id', companyId\))/
);

type JsonBody = Record<string, unknown>;
type FakeResponse = {
  status: number;
  body: JsonBody;
  json: () => Promise<JsonBody>;
};

function jsonResponse(body: JsonBody, init?: { status?: number }): FakeResponse {
  return {
    status: init?.status ?? 200,
    body,
    json: async () => body,
  };
}

type Row = Record<string, unknown>;

class QueryMock {
  private readonly store: Record<string, Row[]>;
  private readonly table: string;
  private op: 'select' | 'delete' | 'update' | 'insert' = 'select';
  private readonly filters: Array<(row: Row) => boolean> = [];
  private updates: Row | null = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
  }

  select() { return this; }
  delete() { this.op = 'delete'; return this; }
  update(value: Row) { this.op = 'update'; this.updates = value; return this; }
  insert(value: Row) {
    this.op = 'insert';
    const row = { ...value };
    this.store[this.table] = [...(this.store[this.table] || []), row];
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  order() { return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'single'; return this; }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const rows = [...(this.store[this.table] || [])].filter((row) =>
      this.filters.every((filter) => filter(row))
    );

    if (this.op === 'delete') {
      this.store[this.table] = (this.store[this.table] || []).filter(
        (row) => !rows.some((match) => match.id === row.id)
      );
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      const updated = rows.map((row) => ({ ...row, ...(this.updates || {}) }));
      this.store[this.table] = (this.store[this.table] || []).map((row) => {
        const next = updated.find((match) => match.id === row.id);
        return next || row;
      });
      if (this.singleMode === 'single') {
        return updated.length > 0
          ? { data: updated[0], error: null }
          : { data: null, error: { message: 'No rows' } };
      }
      if (this.singleMode === 'maybe') {
        return { data: updated[0] || null, error: null };
      }
      return { data: updated, error: null };
    }

    if (this.singleMode === 'single') {
      return rows.length > 0
        ? { data: rows[0], error: null }
        : { data: null, error: { message: 'No rows' } };
    }
    if (this.singleMode === 'maybe') {
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  }
}

type LoadOptions = {
  allowCompanyId?: number | null;
  denyStatus?: number;
  claims?: Row[];
};

function makeRequest(url: string, body?: Record<string, unknown>) {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
    json: async () => body || {},
  };
}

function loadRoute(opts: LoadOptions = {}) {
  const store: Record<string, Row[]> = {
    customer_claims: [...(opts.claims || [])],
    customers: [{ id: 77, profile_id: opts.allowCompanyId ?? 110 }],
  };
  const events: string[] = [];
  const gateCalls: number[] = [];
  let supabaseCalls = 0;

  const requireCompanyAccess = async (_request: unknown, companyId: number) => {
    gateCalls.push(companyId);
    events.push(`gate:${companyId}`);
    if (opts.allowCompanyId != null && companyId === opts.allowCompanyId) {
      return { ok: true, userId: 'u-1', verified: true, emails: [], member: true };
    }
    return {
      ok: false,
      status: opts.denyStatus ?? 401,
      error: opts.denyStatus === 403 ? 'Forbidden' : 'Unauthorized',
      response: jsonResponse(
        { error: opts.denyStatus === 403 ? 'Forbidden' : 'Unauthorized' },
        { status: opts.denyStatus ?? 401 }
      ),
    };
  };

  const getSupabaseServer = () => {
    events.push('supabase');
    return {
      from: (table: string) => {
        supabaseCalls++;
        return new QueryMock(store, table);
      },
    };
  };

  const bundle = [
    sanitizeFn(getFn),
    sanitizeFn(postFn),
    sanitizeFn(patchFn),
    sanitizeFn(deleteFn),
    'return { GET, POST, PATCH, DELETE };',
  ].join('\n\n');

  const runner = new Function(
    'NextResponse',
    'getSupabaseServer',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    'docNumber',
    bundle
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] }),
      () => 'CLM-1'
    ) as {
      GET: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      POST: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      PATCH: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      DELETE: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
    },
    events,
    gateCalls,
    store,
    get supabaseCalls() { return supabaseCalls; },
  };
}

function sanitizeFn(fn: string): string {
  return fn
    .replace(
      /export async function (\w+)\(([^)]*)\)/,
      (_match, name: string, params: string) =>
        `async function ${name}(${params.replace(/:\s*NextRequest/g, '')})`
    )
    .replace(/catch \(e: unknown\)/g, 'catch (e)')
    .replace(/\b(const|let)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=;]+=/g, '$1 $2 =')
    .replace(/\s+as const/g, '')
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)');
}

async function readBody(response: FakeResponse) {
  return response.json();
}

async function main() {
  // PATCH — unauth denied before Supabase
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: 1, companyId: 110, title: 'x' })
    );
    assert.equal(response.status, 401, 'unauth PATCH should be denied');
    assert.equal(env.supabaseCalls, 0, 'unauth PATCH must not query claims');
    assert.deepEqual(env.gateCalls, [110], 'PATCH should gate on companyId');
    assert.ok(env.events[0]?.startsWith('gate:'), 'PATCH must gate before touching Supabase');
  }

  // PATCH — missing companyId → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: 1, title: 'x' })
    );
    assert.equal(response.status, 400, 'PATCH without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // PATCH — non-positive id → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: -1, companyId: 110, title: 'x' })
    );
    assert.equal(response.status, 400, 'PATCH with non-positive id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // DELETE — missing companyId → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/claims?id=1')
    );
    assert.equal(response.status, 400, 'DELETE without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // DELETE — non-positive id → 400
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/claims?id=-1&companyId=110')
    );
    assert.equal(response.status, 400, 'DELETE with non-positive id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // Wrong company → 403 before Supabase
  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const patchResponse = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: 1, companyId: 102, title: 'x' })
    );
    const deleteResponse = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/claims?id=1&companyId=102')
    );
    assert.equal(patchResponse.status, 403, 'member of 110 must not update company 102 claims');
    assert.equal(deleteResponse.status, 403, 'member of 110 must not delete company 102 claims');
    assert.equal(env.supabaseCalls, 0, 'wrong-company requests must stop before Supabase');
  }

  // PATCH scopes by profile_id — cross-company row returns 404
  {
    const env = loadRoute({
      allowCompanyId: 110,
      claims: [
        { id: 1, profile_id: 110, title: 'Own' },
        { id: 2, profile_id: 102, title: 'Other' },
      ],
    });

    const blockedUpdate = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: 2, companyId: 110, title: 'Nope' })
    );
    assert.equal(blockedUpdate.status, 404, 'PATCH must not update cross-company claim rows');

    const okUpdate = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/claims', { id: 1, companyId: 110, title: 'Updated' })
    );
    const updateBody = await readBody(okUpdate);
    assert.equal(okUpdate.status, 200);
    assert.equal(updateBody.success, true);
    assert.equal(env.store.customer_claims.find((row) => row.id === 1)?.title, 'Updated');
    assert.equal(env.store.customer_claims.find((row) => row.id === 2)?.title, 'Other');
  }

  // DELETE scopes by profile_id — cross-company row not deleted
  {
    const env = loadRoute({
      allowCompanyId: 110,
      claims: [
        { id: 1, profile_id: 110, title: 'Own' },
        { id: 2, profile_id: 102, title: 'Other' },
      ],
    });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/claims?id=2&companyId=110')
    );
    const body = await readBody(response);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(env.store.customer_claims.length, 2, 'DELETE must not remove row from other profile');
  }

  // DELETE removes own row
  {
    const env = loadRoute({
      allowCompanyId: 110,
      claims: [
        { id: 1, profile_id: 110, title: 'Own' },
        { id: 2, profile_id: 102, title: 'Other' },
      ],
    });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/claims?id=1&companyId=110')
    );
    const body = await readBody(response);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(env.store.customer_claims.length, 1, 'DELETE should remove matching row');
    assert.equal(env.store.customer_claims[0].id, 2);
  }

  // GET remains gated
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(
      makeRequest('https://example.test/api/customers/claims?companyId=110')
    );
    assert.equal(response.status, 401, 'GET must remain gated');
    assert.deepEqual(env.gateCalls, [110]);
    assert.equal(env.supabaseCalls, 0);
  }

  // POST remains gated
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.POST(
      makeRequest('https://example.test/api/customers/claims', { companyId: 110, title: 'Still gated' })
    );
    assert.equal(response.status, 401, 'POST must remain gated');
    assert.deepEqual(env.gateCalls, [110]);
    assert.equal(env.supabaseCalls, 0);
  }

  console.log('✓ Brief 62 claims authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
