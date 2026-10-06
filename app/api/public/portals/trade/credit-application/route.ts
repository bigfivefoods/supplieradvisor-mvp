import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCreditEncryptionReady, encryptField } from '@/lib/credit/crypto';
import {
  firstIp,
  insertCreditEvent,
  loadCreditDocuments,
  loadCreditTimeline,
  mapCreditApplication,
  maskCreditApplication,
  maskPrincipalRow,
  nextCreditReference,
} from '@/lib/credit/application';
import { validateDraft, validateSubmit } from '@/lib/credit/validate';
import { assertCreditStatusTransition } from '@/lib/credit/status';
import { buildSaCreditTermsText, TERMS_VERSION, sha256Hex } from '@/lib/credit/terms';
import { notifyCreditApplicationSubmitted } from '@/lib/notifications/email-alerts';

function badToken() {
  return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });
}

async function loadScopedApplication(profileId: number, customerId: number, applicationId: number) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('profile_id', profileId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error || !data) return null;
  return mapCreditApplication(data as Record<string, unknown>);
}

async function loadScopedPrincipals(profileId: number, applicationId: number) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('credit_application_principals')
    .select('*')
    .eq('profile_id', profileId)
    .eq('application_id', applicationId)
    .order('id', { ascending: true });
  return (data || []).map((row) => maskPrincipalRow(row as Record<string, unknown>));
}

export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const ip = firstIp(request) || 'ip';
    const rl = checkRateLimit({
      key: `portal-credit-get:${token.slice(0, 24)}:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const guest = await resolveGuestViewer(token);
    if (!guest.ok) return badToken();
    const { portal, viewer } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) return badToken();

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('credit_applications')
      .select('*')
      .eq('profile_id', portal.profile_id)
      .eq('customer_id', viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const apps = (data || []).map((row) => maskCreditApplication(mapCreditApplication(row as Record<string, unknown>)));
    const enriched = await Promise.all(
      apps.map(async (app) => {
        const [documents, timeline, principals] = await Promise.all([
          loadCreditDocuments({ profileId: portal.profile_id, applicationId: app.id }),
          loadCreditTimeline({ profileId: portal.profile_id, applicationId: app.id }),
          loadScopedPrincipals(portal.profile_id, app.id),
        ]);
        return {
          ...app,
          documents: documents.map((d) => ({
            id: Number(d.id),
            principal_id: d.principal_id != null ? Number(d.principal_id) : null,
            doc_type: String(d.doc_type || 'other'),
            file_name: d.file_name != null ? String(d.file_name) : null,
            mime_type: d.mime_type != null ? String(d.mime_type) : null,
            size_bytes: d.size_bytes != null ? Number(d.size_bytes) : null,
            created_at: d.created_at != null ? String(d.created_at) : null,
          })),
          timeline,
          principals,
        };
      })
    );

    let prefill: Record<string, unknown> | null = null;
    if (!enriched.length) {
      const { data: customer } = await supabase
        .from('customers')
        .select('trading_name, legal_name, registration_number, vat_number, contact_name, email, phone, industry, billing_address, shipping_address, city, province, country, payment_terms')
        .eq('id', viewer.customer_id)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      prefill = customer
        ? {
            business: {
              trading_name: String(customer.trading_name || ''),
              registered_name: String(customer.legal_name || customer.trading_name || ''),
              registration_number: String(customer.registration_number || ''),
              vat_number: String(customer.vat_number || ''),
              industry: String(customer.industry || ''),
            },
            contacts: {
              accounts: {
                name: String(customer.contact_name || ''),
                email: String(customer.email || ''),
                phone: String(customer.phone || ''),
              },
            },
            addresses: {
              physical: {
                line1: String(customer.billing_address || ''),
                city: String(customer.city || ''),
                province: String(customer.province || ''),
                country: String(customer.country || 'ZA'),
              },
              delivery: {
                line1: String(customer.shipping_address || ''),
                city: String(customer.city || ''),
                province: String(customer.province || ''),
                country: String(customer.country || 'ZA'),
              },
            },
            requested_terms: String(customer.payment_terms || ''),
          }
        : null;
    }

    return NextResponse.json({ applications: enriched, prefill });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

async function persistPrincipals(profileId: number, applicationId: number, principals: Array<Record<string, unknown>>) {
  const supabase = getSupabaseServer();
  await supabase
    .from('credit_application_principals')
    .delete()
    .eq('profile_id', profileId)
    .eq('application_id', applicationId);
  if (!principals.length) return;
  await supabase.from('credit_application_principals').insert(
    principals.map((p) => ({
      application_id: applicationId,
      profile_id: profileId,
      full_name: p.full_name || null,
      role: p.role || null,
      id_type: p.id_type || 'other',
      id_number_enc: p.id_number_enc || null,
      id_number_last4: p.id_number_last4 || null,
      nationality: p.nationality || null,
      residential_address: p.residential_address || {},
      email: p.email || null,
      phone: p.phone || null,
      shareholding_pct: p.shareholding_pct ?? null,
      surety_offered: p.surety_offered === true,
      surety_signature: p.surety_signature || null,
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token || '').trim();
    const ip = firstIp(request) || 'ip';
    const rl = checkRateLimit({
      key: `portal-credit-post:${token.slice(0, 24)}:${ip}`,
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const guest = await resolveGuestViewer(token);
    if (!guest.ok) return badToken();
    const { portal, viewer, linkedProfileId } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) return badToken();

    const action = String(body.action || 'save_draft');
    const inputData = (body.data || {}) as Record<string, unknown>;

    const draft = validateDraft(inputData);
    if (!draft.ok) return NextResponse.json({ error: draft.errors[0], errors: draft.errors }, { status: 400 });

    const sensitiveEntered = Boolean(
      String(draft.value.bank?.account_number || '').trim() ||
      (draft.value.principals || []).some((p) => String(p.id_number || '').trim())
    );
    if (sensitiveEntered) {
      const encReady = assertCreditEncryptionReady();
      if (!encReady.ok) {
        return NextResponse.json({ error: encReady.error, code: encReady.code }, { status: encReady.status });
      }
    }

    const supabase = getSupabaseServer();
    const requestedId = Number(body.applicationId || 0);
    let existing = requestedId > 0
      ? await loadScopedApplication(portal.profile_id, viewer.customer_id, requestedId)
      : null;
    if (requestedId > 0 && !existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    if (action === 'respond_info' && requestedId <= 0) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }

    if (!existing) {
      const { data: openExisting } = await supabase
        .from('credit_applications')
        .select('*')
        .eq('profile_id', portal.profile_id)
        .eq('customer_id', viewer.customer_id)
        .in('status', ['draft', 'more_info_needed'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openExisting) {
        existing = mapCreditApplication(openExisting as Record<string, unknown>);
      }
    }

    const now = new Date().toISOString();
    const bank = { ...(draft.value.bank || {}) } as Record<string, unknown>;
    const principals = (draft.value.principals || []).map((p) => ({ ...p })) as Array<Record<string, unknown>>;

    if (String(bank.account_number || '').trim()) {
      const plain = String(bank.account_number || '').replace(/\D/g, '');
      bank.account_number_last4 = plain.slice(-4);
      bank.account_number_enc = encryptField(plain);
      delete bank.account_number;
    }

    for (const principal of principals) {
      const idNum = String(principal.id_number || '').trim();
      if (idNum) {
        const digits = idNum.replace(/\s/g, '');
        principal.id_number_last4 = digits.slice(-4);
        principal.id_number_enc = encryptField(digits);
        delete principal.id_number;
      }
    }

    if (!existing) {
      const reference = await nextCreditReference(portal.profile_id);
      const { data: inserted, error } = await supabase
        .from('credit_applications')
        .insert({
          profile_id: portal.profile_id,
          customer_id: viewer.customer_id,
          viewer_id: viewer.id,
          applicant_profile_id: linkedProfileId,
          reference,
          country_code: draft.value.country_code || 'ZA',
          form_version: 1,
          status: action === 'submit' ? 'submitted' : 'draft',
          business: draft.value.business || {},
          addresses: draft.value.addresses || {},
          contacts: draft.value.contacts || {},
          trade_references: draft.value.trade_references || [],
          bank,
          requested_limit: draft.value.requested_limit ?? null,
          requested_terms: draft.value.requested_terms || null,
          currency: draft.value.currency || 'ZAR',
          info_response: draft.value.info_response || null,
          updated_at: now,
          submitted_at: action === 'submit' ? now : null,
          popia_consent_at: action === 'submit' && draft.value.consent?.popia ? now : null,
          credit_check_consent_at: action === 'submit' && draft.value.consent?.credit_check ? now : null,
          terms_accepted_at: action === 'submit' && draft.value.consent?.terms_accepted ? now : null,
          terms_version: action === 'submit' ? TERMS_VERSION : null,
          terms_sha256:
            action === 'submit'
              ? sha256Hex(buildSaCreditTermsText(String(guest.ctx.portal.title || guest.ctx.accountName || 'Supplier')))
              : null,
          signature:
            action === 'submit'
              ? {
                  typed_name: draft.value.signature?.typed_name || '',
                  capacity: draft.value.signature?.capacity || '',
                  signed_at: now,
                  ip,
                  user_agent: String(request.headers.get('user-agent') || '').slice(0, 240),
                }
              : null,
        })
        .select('*')
        .single();
      if (error || !inserted) return NextResponse.json({ error: error?.message || 'Could not save application' }, { status: 500 });
      existing = mapCreditApplication(inserted as Record<string, unknown>);
    } else {
      if (!['draft', 'more_info_needed'].includes(existing.status)) {
        return NextResponse.json({ error: 'Application is read-only in current status' }, { status: 409 });
      }
      const toStatus = action === 'submit' ? 'submitted' : existing.status;
      if (action === 'submit') {
        const t = assertCreditStatusTransition({ actor: 'customer', from: existing.status, to: 'submitted' });
        if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });
      }
      const { error } = await supabase
        .from('credit_applications')
        .update({
          country_code: draft.value.country_code || 'ZA',
          business: draft.value.business || {},
          addresses: draft.value.addresses || {},
          contacts: draft.value.contacts || {},
          trade_references: draft.value.trade_references || [],
          bank,
          requested_limit: draft.value.requested_limit ?? null,
          requested_terms: draft.value.requested_terms || null,
          currency: draft.value.currency || 'ZAR',
          info_response: action === 'respond_info' ? draft.value.info_response || null : existing.info_response,
          status: toStatus,
          submitted_at: action === 'submit' ? now : existing.submitted_at,
          popia_consent_at: action === 'submit' && draft.value.consent?.popia ? now : existing.popia_consent_at,
          credit_check_consent_at: action === 'submit' && draft.value.consent?.credit_check ? now : existing.credit_check_consent_at,
          terms_accepted_at: action === 'submit' && draft.value.consent?.terms_accepted ? now : existing.terms_accepted_at,
          terms_version: action === 'submit' ? TERMS_VERSION : existing.terms_version,
          terms_sha256:
            action === 'submit'
              ? sha256Hex(buildSaCreditTermsText(String(guest.ctx.portal.title || guest.ctx.accountName || 'Supplier')))
              : existing.terms_sha256,
          signature:
            action === 'submit'
              ? {
                  typed_name: draft.value.signature?.typed_name || '',
                  capacity: draft.value.signature?.capacity || '',
                  signed_at: now,
                  ip,
                  user_agent: String(request.headers.get('user-agent') || '').slice(0, 240),
                }
              : existing.signature,
          updated_at: now,
        })
        .eq('id', existing.id)
        .eq('profile_id', portal.profile_id)
        .eq('customer_id', viewer.customer_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      existing = await loadScopedApplication(portal.profile_id, viewer.customer_id, existing.id);
      if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    await persistPrincipals(portal.profile_id, existing.id, principals);

    if (action === 'submit') {
      const docs = await loadCreditDocuments({ profileId: portal.profile_id, applicationId: existing.id });
      const submitCheck = validateSubmit(draft.value, docs.map((d) => ({
        doc_type: String(d.doc_type) as never,
        principal_id: d.principal_id != null ? Number(d.principal_id) : null,
      })));
      if (!submitCheck.ok) {
        return NextResponse.json({ error: submitCheck.errors[0], errors: submitCheck.errors }, { status: 400 });
      }
    }

    if (action === 'respond_info') {
      if (existing.status !== 'more_info_needed') {
        return NextResponse.json({ error: 'Application is not waiting for more info' }, { status: 409 });
      }
      const t = assertCreditStatusTransition({ actor: 'customer', from: existing.status, to: 'submitted' });
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.status });
      const { error } = await supabase
        .from('credit_applications')
        .update({ status: 'submitted', updated_at: now, info_response: draft.value.info_response || null })
        .eq('id', existing.id)
        .eq('profile_id', portal.profile_id)
        .eq('customer_id', viewer.customer_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await insertCreditEvent({
      application_id: existing.id,
      profile_id: portal.profile_id,
      actor_type: 'customer',
      actor_id: String(viewer.id),
      action,
      from_status: existing.status,
      to_status:
        action === 'submit'
          ? 'submitted'
          : action === 'respond_info'
            ? 'submitted'
            : existing.status,
      ip,
    });
    if (action === 'submit') {
      void notifyCreditApplicationSubmitted({
        profileId: portal.profile_id,
        applicationId: existing.id,
      });
    }

    const final = await loadScopedApplication(portal.profile_id, viewer.customer_id, existing.id);
    if (!final) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    return NextResponse.json({ success: true, application: maskCreditApplication(final) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
