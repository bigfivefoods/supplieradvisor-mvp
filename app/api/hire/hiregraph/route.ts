import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  HIRE_CATEGORIES,
  HIRE_REQUIREMENT_LABELS,
  deleteEntity,
  readHiregraphFromMetadata,
  summariseHiregraph,
  upsertEntity,
  writeHiregraphToMetadata,
  type HireEntity,
  type HiregraphStore,
} from '@/lib/hire/hiregraph';
import {
  HIRE_COMMERCIAL_COPY,
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_PLATFORM_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

export const runtime = 'nodejs';

const ENTITIES: HireEntity[] = [
  'suppliers',
  'customers',
  'items',
  'bookings',
  'handovers',
];

function isEntity(v: unknown): v is HireEntity {
  return typeof v === 'string' && (ENTITIES as string[]).includes(v);
}

async function loadStore(companyId: number) {
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
  return { meta, store: readHiregraphFromMetadata(meta) };
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: HiregraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeHiregraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
  return nextMeta;
}

export async function GET(req: NextRequest) {
  try {
    const companyId = Number(req.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req),
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { store } = await loadStore(companyId);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseHiregraph(store),
      categories: HIRE_CATEGORIES,
      requirementLabels: HIRE_REQUIREMENT_LABELS,
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
        platform_commission_pct: HIRE_PLATFORM_COMMISSION_PCT,
        copy: HIRE_COMMERCIAL_COPY,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const access = await requireCompanyAccess(req, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(req, body),
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const action = String(body.action || 'upsert');
    const entity = body.entity;
    if (!isEntity(entity)) {
      return NextResponse.json(
        { error: `entity must be one of: ${ENTITIES.join(', ')}` },
        { status: 400 }
      );
    }

    const { meta, store } = await loadStore(companyId);
    let next: HiregraphStore = store;

    if (action === 'delete') {
      const id = String(body.id || body.record?.id || '');
      if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }
      next = deleteEntity(store, entity, id);
    } else {
      const record =
        body.record && typeof body.record === 'object'
          ? (body.record as Record<string, unknown>)
          : body;
      const { companyId: _c, entity: _e, action: _a, ...rest } = record;
      next = upsertEntity(store, entity, rest);
    }

    await saveStore(companyId, meta, next);
    return NextResponse.json({
      success: true,
      store: next,
      summary: summariseHiregraph(next),
      commercial: {
        supplier_commission_pct: HIRE_SUPPLIER_COMMISSION_PCT,
        customer_commission_pct: HIRE_CUSTOMER_COMMISSION_PCT,
        platform_commission_pct: HIRE_PLATFORM_COMMISSION_PCT,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
