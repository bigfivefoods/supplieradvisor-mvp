import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST /api/onboarding/register-business
 * Self-serve business registration after Privy authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      privyUserId,
      trading_name,
      legal_name,
      registration_number,
      industry,
      business_type,
      country,
      city,
      website,
      contact_name,
      contact_email,
      contact_phone,
      short_description,
    } = body;

    const userId = getCanonicalUserId(privyUserId);
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to register a business.' }, { status: 401 });
    }

    if (!trading_name || !String(trading_name).trim()) {
      return NextResponse.json({ error: 'Trading name is required.' }, { status: 400 });
    }

    if (!contact_email || !String(contact_email).trim()) {
      return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const email = String(contact_email).toLowerCase().trim();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        trading_name: String(trading_name).trim(),
        legal_name: legal_name ? String(legal_name).trim() : String(trading_name).trim(),
        registration_number: registration_number || null,
        industry: industry || null,
        business_type: business_type || 'business',
        country: country || 'South Africa',
        city: city || null,
        website: website || null,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        email,
        short_description: short_description || null,
        supplier_status: 'active',
        relationship_type: business_type === 'supplier' ? 'supplier' : 'business',
        is_discoverable: true,
        user_id: userId,
        created_at: now,
        claimed_at: now,
      })
      .select('id, trading_name')
      .single();

    if (profileError || !profile) {
      console.error('Register business profile error:', profileError);
      return NextResponse.json(
        {
          error: 'Failed to create company profile.',
          details: profileError?.message,
        },
        { status: 500 }
      );
    }

    const { error: membershipError } = await supabase.from('business_users').insert({
      user_id: userId,
      profile_id: profile.id,
      role: 'owner',
      status: 'active',
      name: contact_name || null,
      email,
      joined_at: now,
      created_at: now,
    });

    if (membershipError) {
      console.error('Register business membership error:', membershipError);
      return NextResponse.json(
        {
          error: 'Company created but ownership link failed.',
          details: membershipError.message,
          profileId: profile.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      tradingName: profile.trading_name,
      message: 'Business registered successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    console.error('Register business error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
