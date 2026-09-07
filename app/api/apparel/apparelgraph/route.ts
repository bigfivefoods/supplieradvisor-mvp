import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import {
  apparelgraphSeedStore,
  emptyApparelgraphStore,
  mergeApparelgraphStore,
  readApparelgraphFromMetadata,
  summariseApparelgraph,
  writeApparelgraphToMetadata,
  type ApparelgraphStore,
} from '@/lib/apparel/apparelgraph';

export const runtime = 'nodejs';

type Payload = {
  companyId?: number;
  action?: 'seed_demo' | 'merge' | 'replace';
  store?: Partial<ApparelgraphStore>;
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
    const store = readApparelgraphFromMetadata(metadata);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseApparelgraph(store),
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
    const prevStore = readApparelgraphFromMetadata(prevMeta);

    let nextStore: ApparelgraphStore;
    const action = String(body.action || 'merge');

    if (action === 'seed_demo') {
      nextStore = apparelgraphSeedStore();
    } else if (action === 'replace') {
      nextStore = mergeApparelgraphStore(
        emptyApparelgraphStore(),
        asObject(body.store) as Partial<ApparelgraphStore>
      );
    } else {
      nextStore = mergeApparelgraphStore(
        prevStore,
        asObject(body.store) as Partial<ApparelgraphStore>
      );
    }

    const nextMeta = writeApparelgraphToMetadata(prevMeta, nextStore);

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      store: nextStore,
      summary: summariseApparelgraph(nextStore),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
