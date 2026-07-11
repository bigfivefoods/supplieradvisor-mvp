import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';

/**
 * POST /api/me/companies
 * Reliable company membership lookup for Privy-authenticated clients.
 * Uses service role so RLS never hides rows when there is no Supabase session
 * (auth is Privy-only). Also matches by email for legacy / cross-device rows.
 *
 * Body: { privyUserId: string, email?: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const _auth = await requireVerifiedUser(request, { legacyPrivyUserId: body.privyUserId });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;

    if (!userId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const variants = userIdMatchVariants(userId);

    // 1) Memberships by user_id variants
    const { data: byUser, error: byUserError } = await supabase
      .from('business_users')
      .select('id, role, profile_id, status, user_id, email, invited_email, name')
      .in('user_id', variants)
      .eq('status', 'active');

    if (byUserError) {
      console.error('me/companies by user error:', byUserError);
      return NextResponse.json(
        { error: 'Failed to load memberships', details: byUserError.message },
        { status: 500 }
      );
    }

    let memberships = byUser || [];

    // 2) Also match active memberships by email (covers legacy rows / id format drift)
    if (email) {
      const { data: allActive, error: emailError } = await supabase
        .from('business_users')
        .select('id, role, profile_id, status, user_id, email, invited_email, name')
        .eq('status', 'active');

      if (!emailError && allActive) {
        const emailMatches = allActive.filter((row) => {
          const e1 = (row.email || '').toLowerCase();
          const e2 = (row.invited_email || '').toLowerCase();
          return e1 === email || e2 === email;
        });

        const seen = new Set(memberships.map((m) => m.id));
        for (const row of emailMatches) {
          if (!seen.has(row.id)) {
            memberships.push(row);
            seen.add(row.id);
          }
        }

        // Heal user_id on email-matched rows so future lookups are fast/consistent
        for (const row of emailMatches) {
          if (row.user_id !== userId) {
            await supabase
              .from('business_users')
              .update({ user_id: userId, email: email })
              .eq('id', row.id);
          }
        }
      }
    }

    if (memberships.length === 0) {
      return NextResponse.json({
        success: true,
        companies: [],
        userId,
        email,
        debug: { matchedByUser: (byUser || []).length, variants },
      });
    }

    const profileIds = [...new Set(memberships.map((m) => m.profile_id).filter(Boolean))];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, supplier_status, verification_status')
      .in('id', profileIds);

    if (profilesError) {
      console.error('me/companies profiles error:', profilesError);
      return NextResponse.json(
        { error: 'Failed to load company profiles', details: profilesError.message },
        { status: 500 }
      );
    }

    const companies = (profiles || []).map((profile) => {
      const bu = memberships.find((b) => String(b.profile_id) === String(profile.id));
      return {
        id: String(profile.id),
        trading_name: profile.trading_name,
        legal_name: profile.legal_name,
        supplier_status: profile.supplier_status,
        verification_status: profile.verification_status,
        role: bu?.role || 'member',
      };
    });

    return NextResponse.json({
      success: true,
      companies,
      userId,
      email,
      count: companies.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('me/companies error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
