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
  applyClaimOutcome,
  applyClaimSubmit,
  billingFromSettings,
  claimKpis,
  collectPracticeClaims,
  createClaimFromVisit,
  unclaimedAttendedVisits,
  type ClinicClaimsModule,
} from '@/lib/clinic/medical-aid-claims';
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

    if (action === 'submit') {
      const next = applyClaimSubmit(store, patientId, claimId, now);
      store.patients = next.patients as typeof store.patients;
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
            text: `${LABELS[module]} claim pack for ${row.patient_name} (${row.scheme || 'scheme'}).\nAmount: R${row.claim.amount_zar ?? '—'}\nService: ${row.claim.service_date || '—'}`,
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
      return NextResponse.json({
        success: true,
        claims: collectPracticeClaims(store),
        visits: unclaimedAttendedVisits(store),
        kpis: claimKpis(collectPracticeClaims(store)),
        emailed,
        message: emailed
          ? `Claim submitted and emailed to ${to}`
          : 'Claim marked submitted — download the pack to send to the scheme',
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
