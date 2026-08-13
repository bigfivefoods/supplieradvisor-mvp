/**
 * GET ?q= — search companies a member can link to their wallet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import {
  walletModulesForCompany,
  moduleLabels,
  hasConsumerDesk,
  isConsumerMembershipKind,
} from '@/lib/b2c/company-modules';
import {
  loadBusinessWorkspaceSummary,
  operatorCompanyIds,
} from '@/lib/b2c/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeQuery(raw: string): string {
  return String(raw || '')
    .replace(/[%_,()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = sanitizeQuery(request.nextUrl.searchParams.get('q') || '');
    if (q.length < 2) {
      return NextResponse.json({ success: true, brands: [] });
    }

    const supabase = getSupabaseServer();
    const like = `%${q}%`;
    let rows: Array<Record<string, unknown>> = [];

    const full = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, city, industry, metadata')
      .or(`trading_name.ilike."${like}",legal_name.ilike."${like}"`)
      .limit(16);

    if (full.error) {
      const retry = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, city, industry, metadata')
        .ilike('trading_name', like)
        .limit(16);
      rows = (retry.data || []) as Array<Record<string, unknown>>;
    } else {
      rows = (full.data || []) as Array<Record<string, unknown>>;
    }

    const profile = await loadB2cProfile(userId);
    const linked = new Set(
      (profile?.memberships || [])
        .filter((m) => m.active !== false)
        .map((m) => m.company_id)
    );
    const workspace = await loadBusinessWorkspaceSummary(userId).catch(
      () => null
    );
    const owned = new Set(operatorCompanyIds(workspace || undefined));

    const brands = rows
      .map((row) => {
        const id = Number(row.id);
        const name = String(row.trading_name || row.legal_name || '').trim();
        if (!Number.isFinite(id) || id <= 0 || name.length < 2) return null;
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const modules = walletModulesForCompany(meta);
        const theyOwn = owned.has(id);
        const canMember = hasConsumerDesk(meta);
        return {
          company_id: id,
          name,
          city: row.city ? String(row.city) : null,
          industry: row.industry ? String(row.industry) : null,
          modules,
          modules_label: theyOwn
            ? canMember
              ? `Your company · ${moduleLabels(modules.filter(isConsumerMembershipKind))}`
              : 'Your company'
            : moduleLabels(modules),
          already: linked.has(id),
          owned: theyOwn,
          can_member: canMember,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, brands });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    );
  }
}
