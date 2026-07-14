import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  isPoReviewsEnabled,
  logActivity,
} from '@/lib/customers/access';

/**
 * GET /api/customers/reviews?companyId=&privyUserId=&includeHidden=
 * Seller (reviewee) bilateral peer reviews + aggregate avg (published only for avg).
 * Not public — membership on seller company required.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isPoReviewsEnabled()) {
      return NextResponse.json(
        { error: 'Post-PO reviews are disabled' },
        { status: 503 }
      );
    }

    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const includeHidden =
      request.nextUrl.searchParams.get('includeHidden') === '1' ||
      request.nextUrl.searchParams.get('includeHidden') === 'true';

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    let query = supabase
      .from('po_reviews')
      .select('*')
      .eq('reviewee_profile_id', companyId)
      .order('created_at', { ascending: false });

    if (!includeHidden) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET customers reviews:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_po_reviews.sql',
        },
        { status: 500 }
      );
    }

    const reviews = data || [];
    const published = reviews.filter(
      (r: { status?: string | null }) =>
        String(r.status || 'published').toLowerCase() === 'published'
    );
    const sum = published.reduce(
      (acc: number, r: { rating?: number | null }) => acc + (Number(r.rating) || 0),
      0
    );
    const avgPeerRating =
      published.length > 0 ? Math.round((sum / published.length) * 100) / 100 : null;

    return NextResponse.json({
      success: true,
      reviews,
      aggregate: {
        avgPeerRating,
        publishedCount: published.length,
        totalCount: reviews.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/reviews
 * Seller moderation: hide a review where this company is the reviewee.
 * Body: { companyId, privyUserId, id, status: 'hidden' | 'published' }
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!isPoReviewsEnabled()) {
      return NextResponse.json(
        { error: 'Post-PO reviews are disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId;
    const nextStatus = String(body.status || '').toLowerCase().trim();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (nextStatus !== 'hidden' && nextStatus !== 'published') {
      return NextResponse.json(
        { error: 'status must be hidden or published' },
        { status: 400 }
      );
    }

    const member = await assertCompanyMember(privyUserId, companyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: review, error: loadErr } = await supabase
      .from('po_reviews')
      .select('id, reviewee_profile_id, status, purchase_order_id')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      console.error('PATCH customers reviews load:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Seller must be reviewee — not the reviewer
    if (Number(review.reviewee_profile_id) !== companyId) {
      return NextResponse.json(
        { error: 'You can only moderate reviews received by your company' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('po_reviews')
      .update({ status: nextStatus, updated_at: now })
      .eq('id', id)
      .eq('reviewee_profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Review not found or not owned' }, { status: 404 });
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: member.userId,
      action:
        nextStatus === 'hidden' ? 'po.review.hidden' : 'po.review.published',
      entity_type: 'po_review',
      entity_id: String(id),
      summary: `Seller set review #${id} to ${nextStatus}`,
      metadata: {
        purchase_order_id: review.purchase_order_id,
        previous_status: review.status,
        status: nextStatus,
      },
    });

    return NextResponse.json({ success: true, review: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
