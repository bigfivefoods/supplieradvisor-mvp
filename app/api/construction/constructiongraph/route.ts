import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import {
  constructiongraphSeedStore,
  emptyConstructiongraphStore,
  mergeConstructiongraphStore,
  readConstructiongraphFromMetadata,
  summariseConstructiongraph,
  writeConstructiongraphToMetadata,
  type ConstructiongraphStore,
} from '@/lib/construction/constructiongraph';

export const runtime = 'nodejs';

type Payload = {
  companyId?: number;
  action?: 'seed_demo' | 'merge' | 'replace';
  store?: Partial<ConstructiongraphStore>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const metadata = asObject(profile?.metadata);
    const store = readConstructiongraphFromMetadata(metadata);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseConstructiongraph(store),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const prevMeta = asObject(profile?.metadata);
    const prevStore = readConstructiongraphFromMetadata(prevMeta);

    let nextStore: ConstructiongraphStore;
    const action = String(body.action || 'merge');

    if (action === 'seed_demo') {
      nextStore = constructiongraphSeedStore();
    } else if (action === 'replace') {
      nextStore = mergeConstructiongraphStore(
        emptyConstructiongraphStore(),
        asObject(body.store) as Partial<ConstructiongraphStore>
      );
    } else {
      nextStore = mergeConstructiongraphStore(
        prevStore,
        asObject(body.store) as Partial<ConstructiongraphStore>
      );
    }

    const nextMeta = writeConstructiongraphToMetadata(prevMeta, nextStore);

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      store: nextStore,
      summary: summariseConstructiongraph(nextStore),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
