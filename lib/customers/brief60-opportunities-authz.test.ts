/**
 * Brief 60 — opportunities route authz regression test
 * Run: npx --yes tsx lib/customers/brief60-opportunities-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve('app/api/customers/opportunities/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in opportunities/route.ts`);
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
const flatDelete = deleteFn.replace(/\s+/g, ' ');

// --- Static assertions ---

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(getFn.includes('_gate.response'), 'GET must return _gate.response on !ok');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must keep requireCompanyAccess');
assert.ok(postFn.includes('_gate.response'), 'POST must keep returning _gate.response on !ok');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.ok(deleteFn.includes('requireCompanyAccess'), 'DELETE must call requireCompanyAccess');
assert.ok(deleteFn.includes('_gate.response'), 'DELETE must return _gate.response on !ok');

// GET gate runs before .from('opportunities') and before loadHoldingSubtree
assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf(".from('opportunities')"),
  'GET must call requireCompanyAccess before .from(opportunities)'
);
assert.ok(
  getFn.indexOf('requireCompanyAccess') < getFn.indexOf('loadHoldingSubtree'),
  'GET must call requireCompanyAccess before loadHoldingSubtree'
);

// Positive companyId required on GET/PATCH/DELETE
assert.match(getFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(patchFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/);
assert.match(deleteFn, /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0/);
assert.ok(deleteFn.includes("searchParams.get('companyId')"), 'DELETE must read companyId from search params');

// PATCH/DELETE must use .in('profile_id', tree.ids)
assert.ok(patchFn.includes(".in('profile_id', tree.ids)"), 'PATCH must scope update with .in(profile_id, tree.ids)');
assert.ok(deleteFn.includes(".in('profile_id', tree.ids)"), 'DELETE must scope delete with .in(profile_id, tree.ids)');

// DELETE must not bare-delete by id alone (no profile_id scope)
assert.doesNotMatch(
  flatDelete,
  /\.delete\(\)\.eq\('id', id\)(?!\s*\.in\('profile_id')/
);

// --- Runtime assertions ---

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
  private maxRows: number | null = null;
  private updates: Row | null = null;

  constructor(store: Record<string, Row[]>, table: string) {
    this.store = store;
    this.table = table;
  }

  select() { return this; }
  delete() { this.op = 'delete'; return this; }
  update(value: Row) { this.op = 'update'; this.updates = value; return this; }
  insert() { this.op = 'insert'; return this; }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => (values as unknown[]).includes(row[field]));
    return this;
  }

  or() { return this; }
  order() { return this; }
  limit(v: number) { this.maxRows = v; return this; }
  maybeSingle() { return this; }
  single() { return this; }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    let rows = [...(this.store[this.table] || [])];
    for (const filter of this.filters) rows = rows.filter(filter);
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);
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
      return { data: updated[0] || null, error: null };
    }
    return { data: rows, error: null };
  }
}

type LoadOptions = {
  allowCompanyId?: number | null;
  denyStatus?: number;
  opportunities?: Row[];
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
    opportunities: [...(opts.opportunities || [])],
    crm_activities: [],
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

  const loadHoldingSubtree = async (cid: number) => ({
    ids: [cid],
    names: { [cid]: `Company ${cid}` },
    isSubsidiary: false,
  });

  const annotateGroupOpportunity = (o: Row) => o;
  const summarizeGroupPipeline = () => ({});

  const holdingPipeline = { loadHoldingSubtree, annotateGroupOpportunity };
  const groupPipelineView = { summarizeGroupPipeline };

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
    'holdingPipelineModule',
    'groupPipelineViewModule',
    bundle.replace(
      /await import\('@\/lib\/business\/holding-pipeline'\)/g,
      'holdingPipelineModule'
    ).replace(
      /await import\('@\/lib\/business\/group-pipeline-view'\)/g,
      'groupPipelineViewModule'
    )
  );

  return {
    handlers: runner(
      { json: jsonResponse },
      getSupabaseServer,
      requireCompanyAccess,
      () => null,
      async () => ({ ok: true, userId: 'u-1', verified: true, emails: [] }),
      holdingPipeline,
      groupPipelineView
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
    .replace(/\(([^()]+?)\s+as\s+[^)]+\)/g, '($1)')
    .replace(/as Record<string, unknown>/g, '');
}

async function readBody(response: FakeResponse) {
  return response.json();
}

async function main() {
  // 1. unauth GET
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/customers/opportunities?companyId=102'));
    assert.equal(response.status, 401, 'unauth GET should be denied');
    assert.equal(env.supabaseCalls, 0, 'unauth GET must not query opportunities');
    assert.deepEqual(env.gateCalls, [102]);
    assert.ok(env.events[0]?.startsWith('gate:'), 'GET must gate before touching Supabase');
  }

  // 2. GET missing companyId
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(makeRequest('https://example.test/api/customers/opportunities'));
    assert.equal(response.status, 400, 'GET without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
  }

  // 3. PATCH without companyId
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/opportunities', { id: 1, stage: 'won' })
    );
    const body = await readBody(response);
    assert.equal(response.status, 400, 'PATCH without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
    assert.notEqual(body.success, true);
  }

  // 4. PATCH with non-positive id
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/opportunities', { id: -1, companyId: 110 })
    );
    assert.equal(response.status, 400, 'PATCH with non-positive id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // 5. DELETE without companyId
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=1')
    );
    assert.equal(response.status, 400, 'DELETE without companyId should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // 6. DELETE with non-positive id
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=-1&companyId=110')
    );
    assert.equal(response.status, 400, 'DELETE with non-positive id should 400');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, []);
  }

  // 7. wrong-company member gets 403 on all mutating verbs
  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const getResponse = await env.handlers.GET(
      makeRequest('https://example.test/api/customers/opportunities?companyId=102')
    );
    const patchResponse = await env.handlers.PATCH(
      makeRequest('https://example.test/api/customers/opportunities', { id: 1, companyId: 102 })
    );
    const deleteResponse = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=1&companyId=102')
    );
    assert.equal(getResponse.status, 403);
    assert.equal(patchResponse.status, 403);
    assert.equal(deleteResponse.status, 403);
    assert.equal(env.supabaseCalls, 0, 'wrong-company requests must stop before Supabase');
  }

  // 8. unauth DELETE
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=1&companyId=110')
    );
    assert.equal(response.status, 401, 'unauth DELETE should be denied');
    assert.equal(env.supabaseCalls, 0);
    assert.deepEqual(env.gateCalls, [110]);
  }

  // 9. POST still gated
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.POST(
      makeRequest('https://example.test/api/customers/opportunities', { companyId: 110, name: 'Test' })
    );
    assert.equal(response.status, 401, 'POST must remain gated');
    assert.deepEqual(env.gateCalls, [110]);
    assert.equal(env.supabaseCalls, 0);
  }

  // 10. authorized DELETE only removes matching profile_id
  {
    const env = loadRoute({
      allowCompanyId: 110,
      opportunities: [
        { id: 1, profile_id: 110 },
        { id: 2, profile_id: 102 },
      ],
    });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=2&companyId=110')
    );
    const body = await readBody(response);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    // id=2 belongs to profile 102, not in tree for companyId=110 → not deleted
    assert.equal(env.store.opportunities.length, 2, 'DELETE must not remove row from different profile');
  }

  // 11. authorized DELETE removes own row
  {
    const env = loadRoute({
      allowCompanyId: 110,
      opportunities: [
        { id: 1, profile_id: 110 },
        { id: 2, profile_id: 102 },
      ],
    });
    const response = await env.handlers.DELETE(
      makeRequest('https://example.test/api/customers/opportunities?id=1&companyId=110')
    );
    const body = await readBody(response);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(env.store.opportunities.length, 1, 'DELETE should remove matching row');
    assert.equal(env.store.opportunities[0].id, 2);
  }

  console.log('✓ Brief 60 opportunities authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
