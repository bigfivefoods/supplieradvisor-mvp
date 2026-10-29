import 'server-only';
import { randomUUID } from 'node:crypto';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import type { JobDraft, NetcashRepo } from '@/lib/fitness/netcash/repo';
import type {
  AccessHold,
  AuditEvent,
  BillingLine,
  BillingRun,
  InvoiceLineDraft,
  JobRecord,
  Mandate,
  NetcashSettings,
} from '@/lib/fitness/netcash/types';
import { getSupabaseServer } from '@/lib/supabase/server-client';

const MIGRATION = '20261047_gym_netcash_debit_orders.sql';
const CHUNK = 400;

function gate(companyId: number) {
  const allowed = companyAllowed(companyId);
  if (!allowed.ok) throw new Error(allowed.error);
}

function fail(error: { message?: string } | null, action: string): never {
  const message = error?.message || action;
  if (/does not exist|schema cache/i.test(message)) {
    throw new Error(`Debit order tables are not installed yet. Apply ${MIGRATION} on staging first.`);
  }
  throw new Error(message);
}

function settingsFrom(row: Record<string, unknown>): NetcashSettings {
  return {
    companyId: Number(row.company_id),
    merchantAccount: String(row.merchant_account || ''),
    serviceKeyEnc: row.service_key_enc ? String(row.service_key_enc) : null,
    serviceKeyLast4: String(row.service_key_last4 || ''),
    serviceKeyConfigured: Boolean(row.service_key_enc),
    accountKeyEnc: row.account_key_enc ? String(row.account_key_enc) : null,
    accountKeyLast4: String(row.account_key_last4 || ''),
    accountKeyConfigured: Boolean(row.account_key_enc),
    mode: row.mode === 'live' ? 'live' : 'test',
    debitDay: Number(row.debit_day || 1),
    cadence: row.cadence === 'weekly' || row.cadence === 'fortnightly' ? row.cadence : 'monthly',
    leadBusinessDays: Number(row.lead_business_days ?? 2),
    cutoffHourSast: Number(row.cutoff_hour_sast ?? 14),
    cutoffMinute: Number(row.cutoff_minute || 0),
    pricesIncludeVat: row.prices_include_vat !== false,
    vatBps: Number(row.vat_bps ?? 1500),
    invoicePrefix: String(row.invoice_prefix || 'GYM'),
    creditPrefix: String(row.credit_prefix || 'GCN'),
    lateFeeCents: Number(row.late_fee_cents || 0),
    retryMaxAttempts: Number(row.retry_max_attempts || 2),
    autoSubmit: row.auto_submit === true,
    autoSuspendAccess: row.auto_suspend_access === true,
    dunningEmail: row.dunning_email !== false,
    allowAmountVariance: row.allow_amount_variance !== false,
    glBankCode: String(row.gl_bank_code || '1110'),
    glArCode: String(row.gl_ar_code || '1180'),
    glRevenueCode: String(row.gl_revenue_code || '4400'),
    glVatCode: String(row.gl_vat_code || '2120'),
    glFeeCode: String(row.gl_fee_code || '4300'),
    updatedAt: String(row.updated_at || ''),
    updatedBy: String(row.updated_by || ''),
  };
}

function settingsTo(settings: NetcashSettings) {
  return {
    company_id: settings.companyId,
    merchant_account: settings.merchantAccount,
    service_key_enc: settings.serviceKeyEnc,
    service_key_last4: settings.serviceKeyLast4,
    account_key_enc: settings.accountKeyEnc,
    account_key_last4: settings.accountKeyLast4,
    mode: settings.mode,
    debit_day: settings.debitDay,
    cadence: settings.cadence,
    lead_business_days: settings.leadBusinessDays,
    cutoff_hour_sast: settings.cutoffHourSast,
    cutoff_minute: settings.cutoffMinute,
    prices_include_vat: settings.pricesIncludeVat,
    vat_bps: settings.vatBps,
    invoice_prefix: settings.invoicePrefix,
    credit_prefix: settings.creditPrefix,
    late_fee_cents: settings.lateFeeCents,
    retry_max_attempts: settings.retryMaxAttempts,
    auto_submit: settings.autoSubmit,
    auto_suspend_access: settings.autoSuspendAccess,
    dunning_email: settings.dunningEmail,
    allow_amount_variance: settings.allowAmountVariance,
    gl_bank_code: settings.glBankCode,
    gl_ar_code: settings.glArCode,
    gl_revenue_code: settings.glRevenueCode,
    gl_vat_code: settings.glVatCode,
    gl_fee_code: settings.glFeeCode,
    updated_at: settings.updatedAt,
    updated_by: settings.updatedBy,
  };
}

function mandateFrom(row: Record<string, unknown>): Mandate {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    memberId: String(row.member_id || ''),
    memberName: String(row.member_name || ''),
    memberEmail: String(row.member_email || ''),
    memberPhone: String(row.member_phone || ''),
    accountHolder: String(row.account_holder || ''),
    bankName: String(row.bank_name || ''),
    branchCode: String(row.branch_code || ''),
    accountType: (row.account_type as Mandate['accountType']) || 'cheque',
    accountNumberEnc: String(row.account_number_enc || ''),
    accountLast4: String(row.account_last4 || ''),
    validationStatus: (row.validation_status as Mandate['validationStatus']) || 'unchecked',
    validationRef: String(row.validation_ref || ''),
    debitDay: Number(row.debit_day || 1),
    amountCents: Number(row.amount_cents || 0),
    currency: 'ZAR',
    status: (row.status as Mandate['status']) || 'pending',
    consentText: String(row.consent_text || ''),
    consentVersion: String(row.consent_version || ''),
    signedAt: row.signed_at ? String(row.signed_at) : null,
    signedIp: String(row.signed_ip || ''),
    signedUserAgent: String(row.signed_user_agent || ''),
    netcashRef: String(row.netcash_ref || ''),
    masterfileBatchId: String(row.masterfile_batch_id || ''),
    masterfileUploadedAt: row.masterfile_uploaded_at ? String(row.masterfile_uploaded_at) : null,
    startsOn: String(row.starts_on || '').slice(0, 10),
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function mandateTo(mandate: Mandate) {
  return {
    id: mandate.id,
    company_id: mandate.companyId,
    member_id: mandate.memberId,
    member_name: mandate.memberName,
    member_email: mandate.memberEmail,
    member_phone: mandate.memberPhone,
    account_holder: mandate.accountHolder,
    bank_name: mandate.bankName,
    branch_code: mandate.branchCode,
    account_type: mandate.accountType,
    account_number_enc: mandate.accountNumberEnc,
    account_last4: mandate.accountLast4,
    validation_status: mandate.validationStatus,
    validation_ref: mandate.validationRef,
    debit_day: mandate.debitDay,
    amount_cents: mandate.amountCents,
    currency: 'ZAR',
    status: mandate.status,
    consent_text: mandate.consentText,
    consent_version: mandate.consentVersion,
    signed_at: mandate.signedAt,
    signed_ip: mandate.signedIp,
    signed_user_agent: mandate.signedUserAgent,
    netcash_ref: mandate.netcashRef,
    masterfile_batch_id: mandate.masterfileBatchId,
    masterfile_uploaded_at: mandate.masterfileUploadedAt,
    starts_on: mandate.startsOn || null,
    ends_on: mandate.endsOn,
    created_at: mandate.createdAt,
    updated_at: mandate.updatedAt,
  };
}

function runFrom(row: Record<string, unknown>): BillingRun {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    periodKey: String(row.period_key || ''),
    periodStart: String(row.period_start || '').slice(0, 10),
    periodEnd: String(row.period_end || '').slice(0, 10),
    status: (row.status as BillingRun['status']) || 'preview',
    requestedActionDate: String(row.requested_action_date || '').slice(0, 10),
    actionDate: String(row.action_date || '').slice(0, 10),
    cutoffApplied: row.cutoff_applied === true,
    holidayShifted: row.holiday_shifted === true,
    actionDateNote: String(row.action_date_note || ''),
    expectedCents: Number(row.expected_cents || 0),
    collectedCents: Number(row.collected_cents || 0),
    unpaidCents: Number(row.unpaid_cents || 0),
    memberCount: Number(row.member_count || 0),
    batchCount: Number(row.batch_count || 0),
    idempotencyKey: String(row.idempotency_key || ''),
    netcashBatchId: String(row.netcash_batch_id || ''),
    fileSha256: String(row.file_sha256 || ''),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    reconciledAt: row.reconciled_at ? String(row.reconciled_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    approvedBy: String(row.approved_by || ''),
    createdBy: String(row.created_by || ''),
    error: String(row.error || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function runTo(run: BillingRun) {
  return {
    id: run.id,
    company_id: run.companyId,
    period_key: run.periodKey,
    period_start: run.periodStart || null,
    period_end: run.periodEnd || null,
    status: run.status,
    requested_action_date: run.requestedActionDate || null,
    action_date: run.actionDate || null,
    cutoff_applied: run.cutoffApplied,
    holiday_shifted: run.holidayShifted,
    action_date_note: run.actionDateNote,
    expected_cents: run.expectedCents,
    collected_cents: run.collectedCents,
    unpaid_cents: run.unpaidCents,
    member_count: run.memberCount,
    batch_count: run.batchCount,
    idempotency_key: run.idempotencyKey,
    netcash_batch_id: run.netcashBatchId,
    file_sha256: run.fileSha256,
    submitted_at: run.submittedAt,
    reconciled_at: run.reconciledAt,
    approved_at: run.approvedAt,
    approved_by: run.approvedBy,
    created_by: run.createdBy,
    error: run.error,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

function lineFrom(row: Record<string, unknown>): BillingLine {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    runId: String(row.run_id),
    mandateId: row.mandate_id ? String(row.mandate_id) : null,
    memberId: String(row.member_id || ''),
    memberName: String(row.member_name || ''),
    memberEmail: String(row.member_email || ''),
    memberPhone: String(row.member_phone || ''),
    crmCustomerId: row.crm_customer_id ? Number(row.crm_customer_id) : null,
    description: String(row.description || ''),
    planCents: Number(row.plan_cents || 0),
    addonCents: Number(row.addon_cents || 0),
    discountCents: Number(row.discount_cents || 0),
    prorataCents: Number(row.prorata_cents || 0),
    feeCents: Number(row.fee_cents || 0),
    netCents: Number(row.net_cents || 0),
    vatCents: Number(row.vat_cents || 0),
    totalCents: Number(row.total_cents || 0),
    items: Array.isArray(row.items) ? (row.items as InvoiceLineDraft[]) : [],
    invoiceId: row.invoice_id ? Number(row.invoice_id) : null,
    invoiceNumber: String(row.invoice_number || ''),
    creditNoteId: row.credit_note_id ? Number(row.credit_note_id) : null,
    creditNoteNumber: String(row.credit_note_number || ''),
    collectionStatus: (row.collection_status as BillingLine['collectionStatus']) || 'scheduled',
    skipReason: String(row.skip_reason || ''),
    netcashReasonCode: String(row.netcash_reason_code || ''),
    netcashReasonText: String(row.netcash_reason_text || ''),
    retryOfLineId: row.retry_of_line_id ? String(row.retry_of_line_id) : null,
    attempt: Number(row.attempt || 1),
    accessSuspended: row.access_suspended === true,
    notifiedAt: row.notified_at ? String(row.notified_at) : null,
    whatsappPath: String(row.whatsapp_path || ''),
    idempotencyKey: String(row.idempotency_key || ''),
    financeStatus: String(row.finance_status || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function lineTo(line: BillingLine) {
  return {
    id: line.id,
    company_id: line.companyId,
    run_id: line.runId,
    mandate_id: line.mandateId,
    member_id: line.memberId,
    member_name: line.memberName,
    member_email: line.memberEmail,
    member_phone: line.memberPhone,
    crm_customer_id: line.crmCustomerId,
    description: line.description,
    plan_cents: line.planCents,
    addon_cents: line.addonCents,
    discount_cents: line.discountCents,
    prorata_cents: line.prorataCents,
    fee_cents: line.feeCents,
    net_cents: line.netCents,
    vat_cents: line.vatCents,
    total_cents: line.totalCents,
    items: line.items,
    invoice_id: line.invoiceId,
    invoice_number: line.invoiceNumber,
    credit_note_id: line.creditNoteId,
    credit_note_number: line.creditNoteNumber,
    collection_status: line.collectionStatus,
    skip_reason: line.skipReason,
    netcash_reason_code: line.netcashReasonCode,
    netcash_reason_text: line.netcashReasonText,
    retry_of_line_id: line.retryOfLineId,
    attempt: line.attempt,
    access_suspended: line.accessSuspended,
    notified_at: line.notifiedAt,
    whatsapp_path: line.whatsappPath,
    idempotency_key: line.idempotencyKey,
    finance_status: line.financeStatus,
    created_at: line.createdAt,
    updated_at: line.updatedAt,
  };
}

function jobFrom(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    kind: row.kind as JobRecord['kind'],
    idempotencyKey: String(row.idempotency_key || ''),
    status: (row.status as JobRecord['status']) || 'queued',
    attempts: Number(row.attempts || 0),
    runId: row.run_id ? String(row.run_id) : null,
    lastError: String(row.last_error || ''),
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function supabaseNetcashRepo(): NetcashRepo {
  const db = getSupabaseServer();
  return {
    async getSettings(companyId) {
      gate(companyId);
      const { data, error } = await db.from('gym_netcash_settings').select('*').eq('company_id', companyId).maybeSingle();
      if (error) fail(error, 'settings');
      return data ? settingsFrom(data as Record<string, unknown>) : null;
    },
    async saveSettings(settings) {
      gate(settings.companyId);
      const { error } = await db.from('gym_netcash_settings').upsert(settingsTo(settings));
      if (error) fail(error, 'save settings');
      return settings;
    },
    async listMandates(companyId) {
      gate(companyId);
      const { data, error } = await db.from('gym_debit_mandates').select('*').eq('company_id', companyId).order('updated_at', { ascending: false }).limit(5000);
      if (error) fail(error, 'mandates');
      return (data || []).map((row) => mandateFrom(row as Record<string, unknown>));
    },
    async saveMandate(mandate) {
      gate(mandate.companyId);
      const { error } = await db.from('gym_debit_mandates').upsert(mandateTo(mandate));
      if (error) fail(error, 'save mandate');
      return mandate;
    },
    async listRuns(companyId) {
      gate(companyId);
      const { data, error } = await db.from('gym_billing_runs').select('*').eq('company_id', companyId).order('action_date', { ascending: false }).limit(200);
      if (error) fail(error, 'runs');
      return (data || []).map((row) => runFrom(row as Record<string, unknown>));
    },
    async saveRun(run) {
      gate(run.companyId);
      const { error } = await db.from('gym_billing_runs').upsert(runTo(run));
      if (error) fail(error, 'save run');
      return run;
    },
    async listLines(companyId, runId) {
      gate(companyId);
      let query = db.from('gym_billing_lines').select('*').eq('company_id', companyId);
      if (runId) query = query.eq('run_id', runId);
      const { data, error } = await query.order('member_name').limit(20000);
      if (error) fail(error, 'lines');
      return (data || []).map((row) => lineFrom(row as Record<string, unknown>));
    },
    async saveLines(lines) {
      if (!lines.length) return;
      gate(lines[0].companyId);
      for (let i = 0; i < lines.length; i += CHUNK) {
        const slice = lines.slice(i, i + CHUNK).map(lineTo);
        const { error } = await db.from('gym_billing_lines').upsert(slice);
        if (error) fail(error, 'save lines');
      }
    },
    async replaceRunLines(companyId, runId, lines) {
      gate(companyId);
      const { error } = await db.from('gym_billing_lines').delete().eq('company_id', companyId).eq('run_id', runId);
      if (error) fail(error, 'replace lines');
      await this.saveLines(lines);
    },
    async findRunByKey(companyId, idempotencyKey) {
      gate(companyId);
      const { data, error } = await db.from('gym_billing_runs').select('*').eq('company_id', companyId).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (error) fail(error, 'find run');
      return data ? runFrom(data as Record<string, unknown>) : null;
    },
    async appendAudit(event) {
      gate(event.companyId);
      const row: AuditEvent = event;
      const { error } = await db.from('gym_netcash_audit').insert({
        id: row.id,
        company_id: row.companyId,
        actor: row.actor,
        action: row.action,
        entity: row.entity,
        entity_id: row.entityId,
        ip: row.ip,
        detail: row.detail,
        created_at: row.createdAt,
      });
      if (error) fail(error, 'audit');
    },
    async listAudit(companyId, limit) {
      gate(companyId);
      const { data, error } = await db.from('gym_netcash_audit').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(limit);
      if (error) fail(error, 'list audit');
      return (data || []).map((row) => {
        const rec = row as Record<string, unknown>;
        return {
          id: String(rec.id),
          companyId: Number(rec.company_id),
          actor: String(rec.actor || ''),
          action: String(rec.action || ''),
          entity: String(rec.entity || ''),
          entityId: String(rec.entity_id || ''),
          ip: String(rec.ip || ''),
          detail: (rec.detail as Record<string, unknown>) || {},
          createdAt: String(rec.created_at || ''),
        };
      });
    },
    async listHolds(companyId) {
      gate(companyId);
      const { data, error } = await db.from('gym_member_access_holds').select('*').eq('company_id', companyId).eq('active', true).limit(5000);
      if (error) fail(error, 'holds');
      return (data || []).map((row) => holdFrom(row as Record<string, unknown>));
    },
    async saveHold(hold) {
      gate(hold.companyId);
      const { error } = await db.from('gym_member_access_holds').upsert({
        id: hold.id,
        company_id: hold.companyId,
        member_id: hold.memberId,
        member_name: hold.memberName,
        reason: hold.reason,
        active: hold.active,
        created_at: hold.createdAt,
        released_at: hold.releasedAt,
      });
      if (error) fail(error, 'save hold');
    },
    async releaseHold(companyId, memberId, at) {
      gate(companyId);
      const { error } = await db.from('gym_member_access_holds').update({ active: false, released_at: at }).eq('company_id', companyId).eq('member_id', memberId).eq('active', true);
      if (error) fail(error, 'release hold');
    },
    async nextNumber(companyId, name) {
      gate(companyId);
      const { data, error } = await db.rpc('gym_netcash_next_number', { p_company_id: companyId, p_name: name });
      if (error || data == null) fail(error, 'sequence');
      return Number(data);
    },
    async claimJob(draft: JobDraft, nowIso: string) {
      gate(draft.companyId);
      const { data, error } = await db.from('gym_netcash_jobs').select('*').eq('company_id', draft.companyId).eq('idempotency_key', draft.idempotencyKey).maybeSingle();
      if (error) fail(error, 'job');
      if (data) {
        const existing = jobFrom(data as Record<string, unknown>);
        if (existing.status === 'succeeded') return { state: 'duplicate' as const, job: existing };
        if (existing.status === 'running') return { state: 'busy' as const, job: existing };
        const { error: updateError } = await db.from('gym_netcash_jobs').update({
          status: 'running',
          attempts: existing.attempts + 1,
          locked_at: nowIso,
          last_error: '',
          updated_at: nowIso,
        }).eq('id', existing.id).eq('status', 'failed');
        if (updateError) fail(updateError, 'claim job');
        return { state: 'claimed' as const, job: { ...existing, status: 'running', attempts: existing.attempts + 1, lockedAt: nowIso, updatedAt: nowIso, lastError: '' } };
      }
      const job: JobRecord = {
        id: draft.id || `job_${randomUUID()}`,
        companyId: draft.companyId,
        kind: draft.kind,
        idempotencyKey: draft.idempotencyKey,
        status: 'running',
        attempts: 1,
        runId: draft.runId,
        lastError: '',
        lockedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const { error: insertError } = await db.from('gym_netcash_jobs').insert({
        id: job.id,
        company_id: job.companyId,
        kind: job.kind,
        idempotency_key: job.idempotencyKey,
        status: job.status,
        attempts: job.attempts,
        run_id: job.runId,
        last_error: '',
        locked_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (insertError) {
        if (/duplicate|unique/i.test(insertError.message || '')) {
          const again = await db.from('gym_netcash_jobs').select('*').eq('company_id', draft.companyId).eq('idempotency_key', draft.idempotencyKey).maybeSingle();
          if (again.data) return { state: 'busy' as const, job: jobFrom(again.data as Record<string, unknown>) };
        }
        fail(insertError, 'insert job');
      }
      return { state: 'claimed' as const, job };
    },
    async finishJob(id, patch) {
      const { error } = await db.from('gym_netcash_jobs').update({
        status: patch.status,
        last_error: patch.lastError,
        locked_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) fail(error, 'finish job');
    },
    async saveBatch(batch) {
      gate(batch.companyId);
      const { error } = await db.from('gym_netcash_batches').insert({
        id: batch.id,
        company_id: batch.companyId,
        run_id: batch.runId,
        kind: batch.kind,
        sha256: batch.sha256,
        count: batch.count,
        total_cents: batch.totalCents,
        file_enc: batch.fileEnc,
        created_at: batch.createdAt,
      });
      if (error) fail(error, 'batch');
    },
  };
}

function holdFrom(row: Record<string, unknown>): AccessHold {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    memberId: String(row.member_id || ''),
    memberName: String(row.member_name || ''),
    reason: String(row.reason || ''),
    active: row.active !== false,
    createdAt: String(row.created_at || ''),
    releasedAt: row.released_at ? String(row.released_at) : null,
  };
}
