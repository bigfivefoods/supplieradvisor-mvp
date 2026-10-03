/**
 * Brief 69 — supplier documents authz regression test
 * Run: npx --yes tsx lib/suppliers/brief69-documents-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/suppliers/documents/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in suppliers/documents/route.ts`);
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
const flatPatch = patchFn.replace(/\s+/g, ' ');

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must keep returning _gate.response on !ok');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('getSupabaseServer'),
  'GET must call requireCompanyAccess before getSupabaseServer'
);
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('getSupabaseServer'),
  'PATCH must call requireCompanyAccess before getSupabaseServer'
);
assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(
  patchFn,
  /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0\s*\|\|\s*!Number\.isFinite\(docId\)\s*\|\|\s*docId\s*<=\s*0/
);
assert.ok(
  patchFn.includes('assertSupplierConnection'),
  'PATCH share path must still reference assertSupplierConnection'
);
assert.match(
  flatPatch,
  /\.update\(updates\)\s*\.eq\('id', docId\)\s*\.eq\('profile_id', companyId\)/
);
assert.doesNotMatch(
  flatPatch,
  /\.update\(updates\)\.eq\('id', docId\)(?!\s*\.eq\('profile_id', companyId\))/
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
  private op: 'select' | 'update' = 'select';
  private readonly filters: Array<(row: Row) => boolean> = [];
  private updates: Row | null = null;
  private singleMode: 'none' | 'maybe' | 'single' = 'none';

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
  }

  select() {
    return this;
  }
  update(value: Row) {
    this.op = 'update';
    this.updates = value;
    return this;
  }
  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }
  single() {
    this.singleMode = 'single';
    return this;
  }

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
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)')
    .replace(/(\w)\?:\s*[\w\s|<>[\]]+(?=[,)])/g, '$1');
}

function makeRequest(url: string, body?: Record<string, unknown>) {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
    json: async () => body || {},
  };
}

function loadRoute(opts: { allowCompanyId?: number | null; denyStatus?: number; rows?: Row[] } = {}) {
  const store: Record<string, Row[]> = {
    supplier_documents: [...(opts.rows || [])],
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
    'return { GET, PATCH };',
  ].join('\n\n');

  const runner = new Function(
    'NextResponse',
    'getSupabaseServer',
    'assertSupplierConnection',
    'logActivity',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    bundle
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      async () => ({ ok: true }),
      async () => undefined,
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] })
    ) as {
      GET: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
      PATCH: (request: ReturnType<typeof makeRequest>) => Promise<FakeResponse>;
    },
    gateCalls,
    events,
    get supabaseCalls() {
      return supabaseCalls;
    },
    store,
  };
}

async function readBody(response: FakeResponse) {
  return response.json();
}

async function main() {
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(
      makeRequest('https://example.test/api/suppliers/documents?companyId=0')
    );
    assert.equal(response.status, 400, 'GET with non-positive companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/documents', { id: 1, companyId: 0 })
    );
    assert.equal(response.status, 400, 'PATCH with non-positive companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/documents', { id: 0, companyId: 110 })
    );
    assert.equal(response.status, 400, 'PATCH with non-positive id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const getResponse = await env.handlers.GET(
      makeRequest('https://example.test/api/suppliers/documents?companyId=102')
    );
    const patchResponse = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/documents', { id: 1, companyId: 102 })
    );
    assert.equal(getResponse.status, 403, 'member of 110 must not read company 102 docs');
    assert.equal(patchResponse.status, 403, 'member of 110 must not update company 102 docs');
    assert.equal(env.supabaseCalls, 0, 'wrong-company requests must stop before Supabase');
    assert.ok(env.events.every((e) => e.startsWith('gate:')), 'wrong-company path should only gate');
  }

  {
    const env = loadRoute({
      allowCompanyId: 110,
      rows: [
        { id: 1, profile_id: 110, title: 'Own', visibility: 'private' },
        { id: 2, profile_id: 102, title: 'Other', visibility: 'private' },
      ],
    });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/documents', { id: 2, companyId: 110, title: 'X' })
    );
    assert.equal(response.status, 404, 'PATCH must not update cross-company docs');
    assert.equal(env.store.supplier_documents.find((row) => row.id === 2)?.title, 'Other');
  }

  {
    const env = loadRoute({
      allowCompanyId: 110,
      rows: [{ id: 1, profile_id: 110, title: 'Own', visibility: 'private' }],
    });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/documents', { id: 1, companyId: 110, title: 'Updated' })
    );
    const body = await readBody(response);
    assert.equal(response.status, 200, 'PATCH should update same-company doc');
    assert.equal(body.success, true);
    assert.equal(env.store.supplier_documents.find((row) => row.id === 1)?.title, 'Updated');
    assert.ok(env.events[0]?.startsWith('gate:'), 'PATCH must gate first');
  }

  console.log('✓ Brief 69 supplier documents authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
