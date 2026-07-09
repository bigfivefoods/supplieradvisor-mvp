import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  assertCompanyMember,
  isPoReviewsEnabled,
  logActivity,
} from '@/lib/customers/access';
import {
  isPoReviewable,
  normalizeReviewDimensions,
  PO_REVIEWABLE_STATUSES,
} from '@/lib/procurement/types';

/**
 * GET /api/buyer/reviews?buyerCompanyId=&privyUserId=
 * Pending reviewable POs (no review yet from this buyer) + review history.
 * Suspend does not block; only membership + PO ownership matter.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isPoReviewsEnabled()) {
      return NextResponse.json(
        { error: 'Post-PO reviews are disabled' },
        { status: 503 }
      );
    }

    const buyerCompanyId = Number(request.nextUrl.searchParams.get('buyerCompanyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();

    const [reviewsRes, posRes] = await Promise.all([
      supabase
        .from('po_reviews')
        .select('*')
        .eq('reviewer_profile_id', buyerCompanyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('purchase_orders')
        .select(
          'id, buyer_profile_id, supplier_profile_id, supplier_id, status, total_amount, subtotal, currency, description, created_at, updated_at'
        )
        .eq('buyer_profile_id', buyerCompanyId)
        .in('status', [...PO_REVIEWABLE_STATUSES])
        .order('updated_at', { ascending: false }),
    ]);

    if (reviewsRes.error) {
      console.error('GET buyer reviews:', reviewsRes.error);
      return NextResponse.json(
        {
          error: reviewsRes.error.message,
          hint: 'Run supabase/migrations/20260709_po_reviews.sql',
        },
        { status: 500 }
      );
    }
    if (posRes.error) {
      console.error('GET buyer reviews POs:', posRes.error);
      return NextResponse.json({ error: posRes.error.message }, { status: 500 });
    }

    const reviews = reviewsRes.data || [];
    const reviewedPoIds = new Set(
      reviews.map((r: { purchase_order_id: number }) => Number(r.purchase_order_id))
    );

    const pending = (posRes.data || []).filter(
      (po: { id: number }) => !reviewedPoIds.has(Number(po.id))
    );

    return NextResponse.json({
      success: true,
      reviews,
      pending,
      reviewableStatuses: PO_REVIEWABLE_STATUSES,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/buyer/reviews
 * Buyer leaves a peer review on a paid|completed PO.
 * Body: { buyerCompanyId, privyUserId, purchaseOrderId, rating, title?, body?, dimensions? }
 * Server-derived parties only — client reviewerProfileId / revieweeProfileId ignored.
 * Suspend does not block when PO is reviewable.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPoReviewsEnabled()) {
      return NextResponse.json(
        { error: 'Post-PO reviews are disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const buyerCompanyId = Number(body.buyerCompanyId);
    const purchaseOrderId = Number(body.purchaseOrderId);
    const privyUserId = body.privyUserId;
    const rating = Number(body.rating);

    // Explicitly ignore spoofed party ids
    void body.reviewerProfileId;
    void body.revieweeProfileId;
    void body.reviewer_profile_id;
    void body.reviewee_profile_id;

    if (!Number.isFinite(buyerCompanyId) || buyerCompanyId <= 0) {
      return NextResponse.json({ error: 'buyerCompanyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(purchaseOrderId) || purchaseOrderId <= 0) {
      return NextResponse.json({ error: 'purchaseOrderId is required' }, { status: 400 });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating must be an integer from 1 to 5' },
        { status: 400 }
      );
    }

    const member = await assertCompanyMember(privyUserId, buyerCompanyId);
    if (!member.ok) {
      return NextResponse.json({ error: member.error }, { status: member.status });
    }

    const supabase = getSupabaseServer();
    const { data: po, error: loadErr } = await supabase
      .from('purchase_orders')
      .select(
        'id, buyer_profile_id, supplier_profile_id, supplier_id, status'
      )
      .eq('id', purchaseOrderId)
      .maybeSingle();

    if (loadErr) {
      console.error('POST buyer reviews load PO:', loadErr);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Membership on buyer side of PO
    if (Number(po.buyer_profile_id) !== buyerCompanyId) {
      return NextResponse.json(
        { error: 'You can only review purchase orders owned by your company' },
        { status: 403 }
      );
    }

    if (!isPoReviewable(po.status)) {
      return NextResponse.json(
        {
          error: `PO status "${po.status}" is not reviewable. Only ${PO_REVIEWABLE_STATUSES.join(
            '|'
          )} unlock reviews.`,
        },
        { status: 409 }
      );
    }

    // Server-derived parties from PO — never trust client
    const reviewerProfileId = buyerCompanyId;
    const revieweeProfileId =
      po.supplier_profile_id != null
        ? Number(po.supplier_profile_id)
        : po.supplier_id != null
          ? Number(po.supplier_id)
          : null;

    if (!revieweeProfileId || !Number.isFinite(revieweeProfileId) || revieweeProfileId <= 0) {
      return NextResponse.json(
        { error: 'Purchase order has no supplier profile to review' },
        { status: 422 }
      );
    }

    const title =
      body.title != null && String(body.title).trim()
        ? String(body.title).trim().slice(0, 200)
        : null;
    const reviewBody =
      body.body != null && String(body.body).trim()
        ? String(body.body).trim().slice(0, 5000)
        : null;
    const dimensions = normalizeReviewDimensions(body.dimensions);
    const now = new Date().toISOString();

    const payload = {
      purchase_order_id: purchaseOrderId,
      reviewer_profile_id: reviewerProfileId,
      reviewee_profile_id: revieweeProfileId,
      rating: Math.round(rating),
      title,
      body: reviewBody,
      dimensions,
      status: 'published',
      metadata: {
        source: 'buyer_portal',
        // Record if client tried to spoof parties (audit only)
        client_spoof_attempted:
          body.reviewerProfileId != null ||
          body.revieweeProfileId != null ||
          body.reviewer_profile_id != null ||
          body.reviewee_profile_id != null,
      },
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('po_reviews')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // Unique (purchase_order_id, reviewer_profile_id) → 409
      if (
        error.code === '23505' ||
        /duplicate|unique/i.test(error.message)
      ) {
        return NextResponse.json(
          {
            error:
              'You have already reviewed this purchase order. Only one review per company per PO is allowed.',
          },
          { status: 409 }
        );
      }
      console.error('POST buyer reviews insert:', error);
      return NextResponse.json(
        {
          error: error.message,
          hint: 'Run supabase/migrations/20260709_po_reviews.sql',
        },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: buyerCompanyId,
      actor_user_id: member.userId,
      action: 'po.review.submitted',
      entity_type: 'po_review',
      entity_id: data?.id != null ? String(data.id) : undefined,
      summary: `Buyer reviewed PO #${purchaseOrderId} (${Math.round(rating)}★) for supplier ${revieweeProfileId}`,
      metadata: {
        purchase_order_id: purchaseOrderId,
        reviewer_profile_id: reviewerProfileId,
        reviewee_profile_id: revieweeProfileId,
        rating: Math.round(rating),
      },
    });

    // Also log on seller side for their activity feed
    await logActivity({
      profile_id: revieweeProfileId,
      actor_user_id: member.userId,
      action: 'po.review.submitted',
      entity_type: 'po_review',
      entity_id: data?.id != null ? String(data.id) : undefined,
      summary: `Received peer review on PO #${purchaseOrderId} (${Math.round(rating)}★) from buyer ${buyerCompanyId}`,
      metadata: {
        purchase_order_id: purchaseOrderId,
        reviewer_profile_id: reviewerProfileId,
        reviewee_profile_id: revieweeProfileId,
        rating: Math.round(rating),
      },
    });

    return NextResponse.json({ success: true, review: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
