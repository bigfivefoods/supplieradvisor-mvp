/**
 * Brief 47 — purchase-orders PATCH authz regression test
 * Run: npx --yes tsx lib/suppliers/brief47-po-patch-authz.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const routePath = resolve('app/api/suppliers/purchase-orders/route.ts');
const src = readFileSync(routePath, 'utf8');

function extractFn(name: string): string {
  const marker = `export async function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `Could not find ${name} in suppliers/purchase-orders/route.ts`);
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

assert.ok(getFn.includes('requireCompanyAccess'), 'GET must call requireCompanyAccess');
assert.ok(postFn.includes('requireCompanyAccess'), 'POST must call requireCompanyAccess');
assert.ok(patchFn.includes('requireCompanyAccess'), 'PATCH must call requireCompanyAccess');
assert.ok(patchFn.includes('_gate.response'), 'PATCH must return _gate.response on !ok');
assert.match(
  patchFn,
  /!Number\.isFinite\(companyId\)\s*\|\|\s*companyId\s*<=\s*0\s*\|\|\s*!Number\.isFinite\(id\)\s*\|\|\s*id\s*<=\s*0/
);
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf(".from('purchase_orders')"),
  'PATCH must call requireCompanyAccess before loading purchase_orders'
);
assert.ok(
  patchFn.indexOf('requireCompanyAccess') < patchFn.indexOf('receivePurchaseOrderToInventory'),
  'PATCH must call requireCompanyAccess before receivePurchaseOrderToInventory'
);
assert.ok(
  patchFn.includes('assertCompanyMember(_gate.userId, companyId)'),
  'PATCH membership check must use _gate.userId'
);
assert.ok(
  !patchFn.includes('assertCompanyMember(privyUserId, companyId)'),
  'PATCH must not use body privyUserId as membership authority'
);
assert.ok(
  !/if\s*\(\s*privyUserId\s*\)[\s\S]*requireCompanyAccess/.test(patchFn),
  'PATCH must not hide requireCompanyAccess under if (privyUserId)'
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
  private readonly rows: Row[];
  private readonly filters: Array<(row: Row) => boolean> = [];
  constructor(rows: Row[]) {
    this.rows = rows;
  }
  select() {
    return this;
  }
  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }
  maybeSingle() {
    return this;
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
  private async execute() {
    let out = [...this.rows];
    for (const filter of this.filters) out = out.filter(filter);
    return { data: out[0] ?? null, error: null };
  }
}

type LoadOptions = {
  allowCompanyId?: number | null;
  denyStatus?: 401 | 403;
  purchaseOrders?: Row[];
};

function makeRequest(url: string, body?: Record<string, unknown>) {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
    json: async () => body || {},
  };
}

function loadRoute(opts: LoadOptions = {}) {
  const gateCalls: number[] = [];
  const memberCalls: Array<{ userId: unknown; companyId: number }> = [];
  const fromTables: string[] = [];

  const requireCompanyAccess = async (_request: unknown, companyId: number) => {
    gateCalls.push(companyId);
    if (opts.allowCompanyId != null && companyId === opts.allowCompanyId) {
      return { ok: true, userId: `member-${companyId}`, verified: true, emails: [], member: true };
    }
    return {
      ok: false,
      response: jsonResponse(
        { error: opts.denyStatus === 403 ? 'Forbidden' : 'Unauthorized' },
        { status: opts.denyStatus ?? 401 }
      ),
    };
  };

  const assertCompanyMember = async (userId: unknown, companyId: number) => {
    memberCalls.push({ userId, companyId });
    return { ok: true, userId: String(userId ?? '') };
  };

  const getSupabaseServer = () => ({
    from: (table: string) => {
      fromTables.push(table);
      if (table === 'purchase_orders') return new QueryMock(opts.purchaseOrders || []);
      return new QueryMock([]);
    },
  });

  const tsBundle = [
    getFn,
    postFn,
    patchFn,
    'module.exports = { GET, POST, PATCH };',
  ].join('\n\n');

  const compiled = ts.transpileModule(tsBundle, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const factory = new Function(
    'module',
    'exports',
    'NextResponse',
    'getSupabaseServer',
    'assertCompanyMember',
    'logActivity',
    'BUYER_PO_CANCEL_STATUSES',
    'isSrmBuyerTransitionAllowed',
    'normalizePoItems',
    'requireCompanyAccess',
    'legacyPrivyFrom',
    'requireVerifiedUser',
    'promptAfterPoDelivered',
    'allocatePurchaseOrderCost',
    'hasCostObject',
    'normalizePoCostFields',
    'docNumber',
    'isLegacyPoNumber',
    'isRealPoNumber',
    compiled
  );

  const moduleObj = { exports: {} as { GET: Function; POST: Function; PATCH: Function } };
  factory(
    moduleObj,
    moduleObj.exports,
    { json: jsonResponse },
    getSupabaseServer,
    assertCompanyMember,
    async () => undefined,
    ['cancelled'],
    () => true,
    (items: unknown) => ({ items: Array.isArray(items) ? items : [] }),
    requireCompanyAccess,
    () => null,
    async () => ({ ok: true, userId: 'verified' }),
    async () => undefined,
    async () => ({ ok: true }),
    () => false,
    () => ({ fields: {} }),
    () => 'PO-1',
    () => false,
    () => true
  );

  return {
    handlers: moduleObj.exports,
    gateCalls,
    memberCalls,
    fromTables,
  };
}

async function bodyOf(response: FakeResponse) {
  return response.json();
}

async function main() {
  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 102,
        id: 1,
        action: 'receive_inventory',
      })
    );
    const body = await bodyOf(response);
    assert.equal(response.status, 401, 'PATCH without session must be 401');
    assert.equal(body.success, undefined, 'PATCH without session must never return success');
    assert.deepEqual(env.gateCalls, [102], 'PATCH should gate with companyId');
    assert.deepEqual(env.fromTables, [], 'PATCH without session must not load purchase_orders');
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 102,
        id: 1,
        privyUserId: 'spoofed-privy-id',
        action: 'receive_inventory',
      })
    );
    assert.equal(response.status, 401, 'spoofed body privyUserId must still be 401');
    assert.deepEqual(env.gateCalls, [102], 'spoofed body id must not bypass company gate');
    assert.deepEqual(env.fromTables, [], 'spoofed body id must not reach PO load');
  }

  {
    const env = loadRoute({ allowCompanyId: 110, denyStatus: 403 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 102,
        id: 1,
        action: 'post_accept_books',
      })
    );
    assert.equal(response.status, 403, 'member of 110 must not PATCH 102');
    assert.deepEqual(env.gateCalls, [102], 'wrong-company PATCH should gate requested company');
    assert.deepEqual(env.fromTables, [], 'wrong-company PATCH must stop before purchase_orders');
  }

  {
    const env = loadRoute({ allowCompanyId: 102, denyStatus: 403 });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 110,
        id: 1,
        action: 'allocate_cost',
      })
    );
    assert.equal(response.status, 403, 'member of 102 must not PATCH 110');
    assert.deepEqual(env.gateCalls, [110], 'inverse wrong-company PATCH should gate requested company');
    assert.deepEqual(env.fromTables, [], 'inverse wrong-company PATCH must stop before purchase_orders');
  }

  {
    const env = loadRoute({ allowCompanyId: 110, purchaseOrders: [] });
    const response = await env.handlers.PATCH(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 110,
        id: 9999,
      })
    );
    assert.equal(response.status, 404, 'happy-path member can proceed to PO load');
    assert.deepEqual(env.gateCalls, [110], 'happy-path PATCH must gate company 110');
    assert.equal(env.fromTables[0], 'purchase_orders', 'happy-path PATCH must load purchase_orders');
    assert.deepEqual(
      env.memberCalls,
      [{ userId: 'member-110', companyId: 110 }],
      'membership check should use gate user id'
    );
  }

  {
    const env = loadRoute({ denyStatus: 401 });
    const response = await env.handlers.GET(
      makeRequest('https://example.test/api/suppliers/purchase-orders?companyId=102')
    );
    assert.equal(response.status, 401, 'GET should remain gated');
    assert.deepEqual(env.gateCalls, [102], 'GET should gate requested company');
    assert.deepEqual(env.fromTables, [], 'unauth GET must stop before Supabase');
  }

  {
    const env = loadRoute({ denyStatus: 403, allowCompanyId: 110 });
    const response = await env.handlers.POST(
      makeRequest('https://example.test/api/suppliers/purchase-orders', {
        companyId: 102,
      })
    );
    assert.equal(response.status, 403, 'POST should remain company-gated');
    assert.deepEqual(env.gateCalls, [102], 'POST should gate requested company');
    assert.deepEqual(env.fromTables, [], 'denied POST must stop before Supabase');
  }

  console.log('✓ Brief 47 purchase-orders PATCH authz assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
