/**
 * Practice medical-aid claims inbox for clinic Advisors.
 * GET  ?companyId=&module=
 * POST { action, companyId, module, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  applyClaimAmend,
  applyClaimOutcome,
  applyClaimSubmit,
  applyEraToClaim,
  applySwitchResult,
  billingFromSettings,
  claimKpis,
  collectPracticeClaims,
  createClaimFromVisit,
  unclaimedAttendedVisits,
  type ClinicClaimsModule,
} from '@/lib/clinic/medical-aid-claims';
import { validateMedicalAidClaim } from '@/lib/clinic/medical-aid-claim-validate';
import {
  pollMedicalAidSwitch,
  submitToMedicalAidSwitch,
  type PracticeClaimsSwitch,
} from '@/lib/clinic/medical-aid-switch';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import { buildMedicalAidClaimPdf } from '@/lib/clinic/medical-aid-claim-pdf';

export const runtime = 'nodejs';

const MODULES: ClinicClaimsModule[] = [
  'medicalgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
];

const LABELS: Record<ClinicClaimsModule, string> = {
  medicalgraph: 'MedicalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
};

function parseModule(v: unknown): ClinicClaimsModule | null {
  const s = String(v || '');
  return MODULES.includes(s as ClinicClaimsModule)
    ? (s as ClinicClaimsModule)
    : null;
}

function readStore(module: ClinicClaimsModule, meta: Record<string, unknown>) {
  if (module === 'physiograph') return readPhysiographFromMetadata(meta);
  if (module === 'dentalgraph') return readDentalgraphFromMetadata(meta);
  if (module === 'psychiatrygraph') return readPsychiatrygraphFromMetadata(meta);
  return readMedicalgraphFromMetadata(meta);
}

function writeStore(
  module: ClinicClaimsModule,
  meta: Record<string, unknown>,
  store: ReturnType<typeof readStore>
) {
  if (module === 'physiograph') {
    return writePhysiographToMetadata(meta, store as never);
  }
  if (module === 'dentalgraph') {
    return writeDentalgraphToMetadata(meta, store as never);
  }
  if (module === 'psychiatrygraph') {
    return writePsychiatrygraphToMetadata(meta, store as never);
  }
  return writeMedicalgraphToMetadata(meta, store as never);
}

async function load(companyId: number, module: ClinicClaimsModule) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === 'object'
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  return { meta, store: readStore(module, meta) };
}

async function save(
  companyId: number,
  module: ClinicClaimsModule,
  meta: Record<string, unknown>,
  store: ReturnType<typeof readStore>
) {
  const supabase = getSupabaseServer();
  const next = writeStore(module, meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const module = parseModule(request.nextUrl.searchParams.get('module'));
    if (!Number.isFinite(companyId) || !module) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const { store } = await load(companyId, module);
    const claims = collectPracticeClaims(store);
    return NextResponse.json({
      success: true,
      claims,
      visits: unclaimedAttendedVisits(store),
      kpis: claimKpis(claims),
      billing: billingFromSettings(store.settings),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    const module = parseModule(body.module);
    if (!Number.isFinite(companyId) || !module) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const { meta, store } = await load(companyId, module);
    const action = String(body.action || '');
    const now = new Date().toISOString();

    if (action === 'save_billing') {
      // Mutate in place. Replacing `store.settings` with a spread object
      // fails the four-clinic union (missing enabled / public_token / …).
      const settings = store.settings;
      if (!settings) {
        return NextResponse.json(
          { error: 'Practice settings not initialized' },
          { status: 400 }
        );
      }
      settings.practice_number = String(body.practice_number || '');
      settings.bhf_number = String(body.bhf_number || '');
      settings.vat_number = String(body.vat_number || '');
      settings.pcns_number = String(body.pcns_number || '');
      settings.billing_email = String(body.billing_email || '');
      const prevSwitch = settings.claims_switch || {};
      const nextSwitch: PracticeClaimsSwitch = {
        provider:
          String(body.switch_provider || prevSwitch.provider || 'medikredit') ===
          'manual'
            ? 'manual'
            : 'medikredit',
        mode:
          String(body.switch_mode || prevSwitch.mode || 'sandbox') === 'live'
            ? 'live'
            : 'sandbox',
        pcns_verified:
          body.pcns_verified === true || prevSwitch.pcns_verified === true,
        username:
          body.switch_username != null
            ? String(body.switch_username)
            : prevSwitch.username || null,
        secret_enc: prevSwitch.secret_enc || null,
        last_submitted_at: prevSwitch.last_submitted_at || null,
      };
      if (body.switch_secret) {
        nextSwitch.secret_enc = `set:${String(body.switch_secret).slice(0, 4)}…`;
      }
      settings.claims_switch = nextSwitch;
      await save(companyId, module, meta, store);
      return NextResponse.json({
        success: true,
        billing: billingFromSettings(store.settings),
        message: 'Practice billing details saved',
      });
    }

    if (action === 'from_visit') {
      const bookingId = String(body.booking_id || '');
      const visit = unclaimedAttendedVisits(store).find(
        (v) => v.booking_id === bookingId
      );
      if (!visit) {
        return NextResponse.json(
          { error: 'Attended visit not found or already claimed' },
          { status: 404 }
        );
      }
      const next = createClaimFromVisit(store, visit, now);
      store.patients = next.patients as typeof store.patients;
      await save(companyId, module, meta, store);
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        visits: unclaimedAttendedVisits(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        message: `Claim drafted for ${visit.patient_name}`,
      });
    }

    const patientId = String(body.patient_id || '');
    const claimId = String(body.claim_id || '');

    if (action === 'submit' || action === 'resubmit') {
      const patient = store.patients.find((p) => p.id === patientId);
      const claim = (patient?.medical?.claims || []).find((c) => c.id === claimId);
      if (!patient || !claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
      const billing = billingFromSettings(store.settings);
      const check = validateMedicalAidClaim({
        claim,
        medical: patient.medical,
        billing,
        requireConsent: false,
      });
      if (!check.ok) {
        return NextResponse.json(
          {
            error: check.errors[0] || 'Claim is not ready to submit',
            errors: check.errors,
            warnings: check.warnings,
          },
          { status: 400 }
        );
      }
      const sw = store.settings?.claims_switch || {
        provider: 'medikredit' as const,
        mode: 'sandbox' as const,
      };
      const switched = await submitToMedicalAidSwitch({
        claim,
        medical: patient.medical,
        billing,
        patientName: patient.name,
        patientCode: patient.code,
        switch: sw,
      });
      if (switched.ok) {
        const numbered = applyClaimSubmit(store, patientId, claimId, now);
        store.patients = numbered.patients as typeof store.patients;
      }
      const next = applySwitchResult(
        store,
        patientId,
        claimId,
        {
          ...switched,
          provider: sw.provider === 'manual' ? 'manual' : 'medikredit',
          mode: sw.mode === 'live' ? 'live' : 'sandbox',
        },
        gate.userId,
        now
      );
      store.patients = next.patients as typeof store.patients;
      if (store.settings?.claims_switch) {
        store.settings.claims_switch.last_submitted_at = now;
      }
      await save(companyId, module, meta, store);
      const row = collectPracticeClaims(store).find(
        (r) => r.claim.id === claimId
      );
      let emailed = false;
      const to = String(body.email || store.settings?.billing_email || '').trim();
      if (to.includes('@') && row) {
        try {
          const pdf = await buildMedicalAidClaimPdf({
            practice: billingFromSettings(store.settings),
            patientName: row.patient_name,
            patientCode: row.patient_code,
            medical: store.patients.find((p) => p.id === patientId)?.medical,
            claim: row.claim,
            moduleLabel: LABELS[module],
          });
          const resend = getResend();
          await resend.emails.send({
            from: getResendFrom(),
            to,
            replyTo: getResendReplyTo(),
            subject: `Medical-aid claim ${row.claim.claim_number} · ${row.patient_name}`,
            text: `${LABELS[module]} claim pack for ${row.patient_name} (${row.scheme || 'scheme'}).\nAmount: R${row.claim.amount_zar ?? '—'}\nService: ${row.claim.service_date || '—'}\nTracking: ${row.claim.switch_tracking_number || '—'}`,
            attachments: [
              {
                filename: `${row.claim.claim_number || 'claim'}.pdf`,
                content: pdf,
              },
            ],
          });
          emailed = true;
        } catch (err) {
          console.warn('[medical-aid-claim email]', err);
        }
      }
      let copay = false;
      const portion = Number(row?.claim.patient_portion);
      if (switched.ok && portion > 0 && patient.email) {
        try {
          const { publishAdvisorCharge } = await import(
            '@/lib/b2c/member-account-link'
          );
          const { loadWalletCompany } = await import('@/lib/b2c/load-company');
          const { suggestionToCharge, addCharge, readMemberAccountStore, writeMemberAccountStore } =
            await import('@/lib/b2c/member-account');
          const { MODULE_TO_KIND } = await import(
            '@/lib/b2c/member-account-types'
          );
          const company = await loadWalletCompany(companyId);
          if (company) {
            const kind = MODULE_TO_KIND[module];
            const published = await publishAdvisorCharge({
              company,
              module,
              charge: {
                ...suggestionToCharge({
                  source: 'visit',
                  source_id: `claim:${claimId}`,
                  kind,
                  ref_id: patientId,
                  member_name: patient.name,
                  member_email: patient.email,
                  description: `Medical-aid co-pay · ${row?.claim.claim_number || 'claim'}`,
                  amount_zar: portion,
                  due_date: now.slice(0, 10),
                }),
              },
            });
            company.meta = published.meta;
            const ledger = addCharge(
              readMemberAccountStore(company.meta),
              published.charge
            );
            const { saveWalletCompanyMeta } = await import('@/lib/b2c/load-company');
            await saveWalletCompanyMeta(
              companyId,
              writeMemberAccountStore(company.meta, ledger)
            );
            const stamped = applySwitchResult(
              store,
              patientId,
              claimId,
              {
                status: (row?.claim.status as 'submitted' | 'accepted' | 'rejected') || 'submitted',
                tracking_number: row?.claim.switch_tracking_number || undefined,
                message: row?.claim.response_notes || '',
                raw: row?.claim.switch_response_raw || '{}',
              },
              gate.userId,
              now
            );
            const p = stamped.patients.find((x) => x.id === patientId);
            const c = (p?.medical?.claims || []).find((x) => x.id === claimId);
            if (c) {
              const { upsertMedicalClaim } = await import(
                '@/lib/clinic/patient-medical'
              );
              const med = upsertMedicalClaim(p?.medical ?? undefined, {
                ...c,
                charge_id: published.charge.id,
              });
              store.patients = store.patients.map((x) =>
                x.id === patientId ? { ...x, medical: med } : x
              ) as typeof store.patients;
              await save(companyId, module, meta, store);
            }
            copay = true;
          }
        } catch (err) {
          console.warn('[medical-aid-claim copay]', err);
        }
      }
      try {
        const supabase = getSupabaseServer();
        await supabase.from('activity_log').insert({
          profile_id: companyId,
          actor_user_id: gate.userId,
          action: 'medical_aid.claim_submit',
          entity_type: 'medical_aid_claim',
          entity_id: claimId,
          summary: switched.message,
          metadata: {
            tracking: switched.tracking_number || null,
            status: switched.status,
          },
        });
      } catch {
        /* optional */
      }
      return NextResponse.json({
        success: switched.ok,
        claims: collectPracticeClaims(store),
        visits: unclaimedAttendedVisits(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        errors: check.errors,
        warnings: check.warnings,
        emailed,
        copay,
        message: switched.ok
          ? [
              switched.message,
              emailed ? `Pack emailed to ${to}` : null,
              copay ? `Co-pay ${portion} raised on SA Member` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : switched.message,
      });
    }

    if (action === 'amend') {
      const patch = (body.claim || body.patch || {}) as Record<string, unknown>;
      const next = applyClaimAmend(
        store,
        patientId,
        claimId,
        {
          tariff_code: patch.tariff_code != null ? String(patch.tariff_code) : undefined,
          diagnosis_code:
            patch.diagnosis_code != null ? String(patch.diagnosis_code) : undefined,
          diagnosis_codes: Array.isArray(patch.diagnosis_codes)
            ? patch.diagnosis_codes.map(String)
            : patch.diagnosis_code
              ? String(patch.diagnosis_code)
                  .split(/[,;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
          amount_zar:
            patch.amount_zar != null ? Number(patch.amount_zar) : undefined,
          patient_portion:
            patch.patient_portion != null
              ? Number(patch.patient_portion)
              : undefined,
          scheme_portion:
            patch.scheme_portion != null
              ? Number(patch.scheme_portion)
              : undefined,
          auth_number:
            patch.auth_number != null ? String(patch.auth_number) : undefined,
          notes: patch.notes != null ? String(patch.notes) : undefined,
          line_items: Array.isArray(patch.line_items)
            ? (patch.line_items as never)
            : undefined,
        },
        gate.userId,
        now
      );
      store.patients = next.patients as typeof store.patients;
      await save(companyId, module, meta, store);
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        message: 'Claim updated',
      });
    }

    if (action === 'ingest_era') {
      const tracking = String(body.tracking_number || body.claim_number || '');
      const applied = applyEraToClaim(
        store,
        tracking,
        {
          amount_paid: Number(body.amount_paid),
          payment_date: body.payment_date
            ? String(body.payment_date)
            : undefined,
          reference: body.reference ? String(body.reference) : undefined,
          notes: body.notes ? String(body.notes) : undefined,
        },
        now
      );
      store.patients = applied.store.patients as typeof store.patients;
      await save(companyId, module, meta, store);
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        message: `ERA matched ${applied.claim.claim_number || tracking} · ${applied.claim.status}`,
      });
    }

    if (action === 'poll_status') {
      const patient = store.patients.find((p) => p.id === patientId);
      const claim = (patient?.medical?.claims || []).find((c) => c.id === claimId);
      if (!claim?.switch_tracking_number) {
        return NextResponse.json(
          { error: 'No switch tracking number on this claim' },
          { status: 400 }
        );
      }
      const polled = await pollMedicalAidSwitch({
        tracking_number: claim.switch_tracking_number,
        switch: store.settings?.claims_switch || { mode: 'sandbox' },
        claim,
      });
      if (polled.ok && (polled.status === 'accepted' || polled.status === 'rejected')) {
        const next = applySwitchResult(
          store,
          patientId,
          claimId,
          {
            status: polled.status,
            tracking_number: claim.switch_tracking_number,
            message: polled.message,
            raw: polled.raw,
          },
          gate.userId,
          now
        );
        store.patients = next.patients as typeof store.patients;
        await save(companyId, module, meta, store);
      }
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        message: polled.message,
      });
    }

    if (action === 'outcome') {
      const status = String(body.status || '');
      if (status !== 'paid' && status !== 'rejected' && status !== 'partial') {
        return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
      }
      const next = applyClaimOutcome(
        store,
        patientId,
        claimId,
        status,
        body.response_notes ? String(body.response_notes) : undefined,
        now
      );
      store.patients = next.patients as typeof store.patients;
      await save(companyId, module, meta, store);
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        message: `Claim marked ${status}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
