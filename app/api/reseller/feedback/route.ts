import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import {
  clampStar,
  computeOverall,
  FEEDBACK_STAR_DIMENSIONS,
  rollupFeedback,
  type FeedbackRatings,
} from '@/lib/containers/reseller-feedback';

async function resolveReseller(
  request: NextRequest,
  body: Record<string, unknown>
) {
  const auth = await requireVerifiedUser(request, {
    legacyPrivyUserId: body.privyUserId as string | undefined,
  });
  if (!auth.ok) return { error: auth.response as NextResponse };

  const userId = getCanonicalUserId(auth.userId || (body.privyUserId as string));
  const email = body.email
    ? String(body.email).toLowerCase().trim()
    : null;
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'privyUserId required' },
        { status: 400 }
      ),
    };
  }

  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);
  let { data: byUser } = await supabase
    .from('container_resellers')
    .select('*')
    .in('user_id', variants);

  let resellers = (byUser || []).filter(
    (r) => r.portal_status !== 'suspended' && r.status !== 'suspended'
  );

  if ((!resellers || !resellers.length) && email) {
    const { data: byEmail } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('email', email)
      .neq('portal_status', 'suspended');
    resellers = byEmail || [];
  }

  if (!resellers.length) {
    return {
      error: NextResponse.json(
        { error: 'Not linked as a reseller' },
        { status: 403 }
      ),
    };
  }

  const wantId = body.resellerId != null ? Number(body.resellerId) : null;
  const reseller =
    wantId && Number.isFinite(wantId)
      ? resellers.find((r) => Number(r.id) === wantId) || resellers[0]
      : resellers[0];

  return { supabase, userId, reseller, resellers };
}

async function listForReseller(
  supabase: ReturnType<typeof getSupabaseServer>,
  resellerId: number
) {
  const { data, error } = await supabase
    .from('reseller_customer_feedback')
    .select('*')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissing(error.message)) {
      return NextResponse.json({
        success: true,
        feedback: [],
        summary: rollupFeedback([]),
        migration_required: true,
        warning:
          'Run supabase/migrations/20260714_reseller_customer_feedback.sql',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];
  return NextResponse.json({
    success: true,
    feedback: rows,
    summary: rollupFeedback(rows),
  });
}

/**
 * GET — list own feedback (query: privyUserId, email, resellerId)
 * POST — capture customer feedback, or { list: true } to list
 */
export async function GET(request: NextRequest) {
  try {
    const body = {
      privyUserId: request.nextUrl.searchParams.get('privyUserId'),
      email: request.nextUrl.searchParams.get('email'),
      resellerId: request.nextUrl.searchParams.get('resellerId'),
    };
    const resolved = await resolveReseller(request, body as Record<string, unknown>);
    if ('error' in resolved && resolved.error instanceof NextResponse) {
      return resolved.error;
    }
    const { supabase, reseller } = resolved as {
      supabase: ReturnType<typeof getSupabaseServer>;
      reseller: { id: number };
    };
    return listForReseller(supabase, Number(reseller.id));
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveReseller(request, body);
    if ('error' in resolved && resolved.error instanceof NextResponse) {
      return resolved.error;
    }
    const { supabase, userId, reseller } = resolved as {
      supabase: ReturnType<typeof getSupabaseServer>;
      userId: string;
      reseller: {
        id: number;
        profile_id: number;
        primary_container_id?: number | null;
      };
    };

    // List via POST (same auth body as session)
    if (body.list === true || body.action === 'list') {
      return listForReseller(supabase, Number(reseller.id));
    }

    const product_name = String(
      body.product_name || body.productName || ''
    ).trim();
    if (!product_name) {
      return NextResponse.json(
        { error: 'product_name is required' },
        { status: 400 }
      );
    }

    const ratings: FeedbackRatings = {};
    for (const d of FEEDBACK_STAR_DIMENSIONS) {
      ratings[d.key] = clampStar(body[d.key] ?? body[d.key.replace('rating_', '')]);
    }

    // Accept short keys: product, price, brand, value, packaging
    if (ratings.rating_product == null) ratings.rating_product = clampStar(body.product);
    if (ratings.rating_price == null) ratings.rating_price = clampStar(body.price);
    if (ratings.rating_brand == null) ratings.rating_brand = clampStar(body.brand);
    if (ratings.rating_value == null) ratings.rating_value = clampStar(body.value);
    if (ratings.rating_packaging == null)
      ratings.rating_packaging = clampStar(body.packaging);

    const hasAnyStar = FEEDBACK_STAR_DIMENSIONS.some(
      (d) => ratings[d.key] != null
    );
    const free_text = body.free_text != null
      ? String(body.free_text).trim().slice(0, 4000)
      : body.notes != null
        ? String(body.notes).trim().slice(0, 4000)
        : '';

    if (!hasAnyStar && !free_text) {
      return NextResponse.json(
        {
          error:
            'Provide at least one star rating (product, price, brand, value, packaging) or free text notes',
        },
        { status: 400 }
      );
    }

    const overall =
      clampStar(body.rating_overall ?? body.overall) ?? computeOverall(ratings);

    const insert = {
      profile_id: Number(reseller.profile_id),
      reseller_id: Number(reseller.id),
      container_id:
        body.container_id != null
          ? Number(body.container_id)
          : reseller.primary_container_id != null
            ? Number(reseller.primary_container_id)
            : null,
      sale_id: body.sale_id != null ? Number(body.sale_id) : null,
      product_id:
        body.product_id != null && Number.isFinite(Number(body.product_id))
          ? Number(body.product_id)
          : null,
      product_name,
      sku: body.sku != null ? String(body.sku).slice(0, 120) : null,
      rating_product: ratings.rating_product,
      rating_price: ratings.rating_price,
      rating_brand: ratings.rating_brand,
      rating_value: ratings.rating_value,
      rating_packaging: ratings.rating_packaging,
      rating_overall: overall,
      free_text: free_text || null,
      customer_name: body.customer_name
        ? String(body.customer_name).trim().slice(0, 200)
        : null,
      customer_phone: body.customer_phone
        ? String(body.customer_phone).trim().slice(0, 60)
        : null,
      customer_location: body.customer_location
        ? String(body.customer_location).trim().slice(0, 200)
        : null,
      source: 'reseller_portal',
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reseller_customer_feedback')
      .insert(insert)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json(
          {
            error:
              'Feedback table missing. Run supabase/migrations/20260714_reseller_customer_feedback.sql',
            migration_required: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      feedback: data,
      message: 'Customer feedback captured — thank you',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function isMissing(msg?: string) {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache')
  );
}
