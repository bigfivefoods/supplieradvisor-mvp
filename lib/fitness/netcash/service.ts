import { batchRowsFromLines, buildDebitBatchFile, buildMasterfile } from '@/lib/fitness/netcash/batch';
import { buildPreviewLines, periodWindow } from '@/lib/fitness/netcash/billing';
import { planActionDate, sastStamp } from '@/lib/fitness/netcash/calendar';
import { createNetcashClient, type NetcashClient } from '@/lib/fitness/netcash/client';
import { defaultSettings } from '@/lib/fitness/netcash/defaults';
import { issueJournal, settlementJournal } from '@/lib/fitness/netcash/finance';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import { documentNumber, invoiceFromLine, type InvoicePort } from '@/lib/fitness/netcash/invoices';
import { summariseCollections } from '@/lib/fitness/netcash/overview';
import { pendingLateFees, applyResults } from '@/lib/fitness/netcash/reconcile';
import type { NetcashRepo } from '@/lib/fitness/netcash/repo';
import { dunningEmail, invoiceEmail, whatsappHref, whatsappInvoiceText } from '@/lib/fitness/netcash/share';
import type { AuditEvent, BillingLine, BillingRun, BillableMember, Mandate, NetcashSettings } from '@/lib/fitness/netcash/types';
import { CONSENT_VERSION, consentText, mockAccountValidation, validateMandateInput, validateSettingsPatch, type MandateInput } from '@/lib/fitness/netcash/validate';

export type Mailer = (input: { to: string; subject: string; text: string; companyId: number }) => Promise<{ ok: boolean; skipped?: boolean }>;

export type ServiceDeps = {
  repo: NetcashRepo;
  now?: () => Date;
  id?: () => string;
  invoices?: InvoicePort;
  mailer?: Mailer;
  clientFor?: (mode: 'test' | 'live') => NetcashClient;
  sealServiceKey?: (companyId: number, key: string) => string | null;
  sealAccount?: (companyId: number, mandateId: string, account: string) => string | null;
  openAccount?: (companyId: number, mandate: Mandate) => string | null;
  sealFile?: (companyId: number, body: string) => string | null;
  gymName?: string;
};

function nowOf(deps: ServiceDeps): Date {
  return deps.now ? deps.now() : new Date();
}

function idOf(deps: ServiceDeps): () => string {
  if (deps.id) return deps.id;
  return () => `nc_${Math.random().toString(36).slice(2, 12)}`;
}

async function audit(repo: NetcashRepo, event: Omit<AuditEvent, 'id' | 'createdAt'> & { id: string; createdAt: string }) {
  const safe = { ...event.detail };
  delete safe.serviceKey;
  delete safe.accountNumber;
  delete safe.file;
  await repo.appendAudit({ ...event, detail: safe });
}

export async function loadSettings(deps: ServiceDeps, companyId: number): Promise<NetcashSettings> {
  const allowed = companyAllowed(companyId);
  if (!allowed.ok) throw new Error(allowed.error);
  const existing = await deps.repo.getSettings(companyId);
  if (existing) return existing;
  const created = defaultSettings(companyId, nowOf(deps).toISOString());
  await deps.repo.saveSettings(created);
  return created;
}

export async function updateSettings(
  deps: ServiceDeps,
  companyId: number,
  patch: Record<string, unknown>,
  actor: string
): Promise<NetcashSettings> {
  const current = await loadSettings(deps, companyId);
  const parsed = validateSettingsPatch(patch as Parameters<typeof validateSettingsPatch>[0]);
  if (!parsed.ok) throw new Error(parsed.error);
  const next = { ...current, ...parsed.patch, updatedAt: nowOf(deps).toISOString(), updatedBy: actor };
  delete (next as { serviceKey?: string }).serviceKey;
  if (parsed.patch.serviceKey) {
    const seal = deps.sealServiceKey;
    if (!seal) throw new Error('The debit order encryption key is not set.');
    const sealed = seal(companyId, parsed.patch.serviceKey);
    if (!sealed) throw new Error('The debit order encryption key is not set.');
    next.serviceKeyEnc = sealed;
    next.serviceKeyLast4 = parsed.patch.serviceKey.slice(-4);
    next.serviceKeyConfigured = true;
  }
  await deps.repo.saveSettings(next);
  const id = idOf(deps);
  await audit(deps.repo, {
    id: id(),
    companyId,
    actor,
    action: 'settings.update',
    entity: 'settings',
    entityId: String(companyId),
    ip: '',
    detail: { mode: next.mode, serviceKeyConfigured: next.serviceKeyConfigured, autoSubmit: next.autoSubmit },
    createdAt: next.updatedAt,
  });
  return next;
}

export async function captureMandate(
  deps: ServiceDeps,
  input: {
    companyId: number;
    memberId: string;
    memberName: string;
    memberEmail: string;
    memberPhone: string;
    mandate: MandateInput;
    ip: string;
    userAgent: string;
    gymName: string;
  }
): Promise<Mandate> {
  const allowed = companyAllowed(input.companyId);
  if (!allowed.ok) throw new Error(allowed.error);
  const parsed = validateMandateInput(input.mandate);
  if (!parsed.ok) throw new Error(parsed.errors[0]?.message || 'Check the bank details.');
  const validation = mockAccountValidation(parsed.accountNumber, parsed.branchCode);
  const settings = await loadSettings(deps, input.companyId);
  const client = (deps.clientFor || createNetcashClient)(settings.mode);
  const remote = await client.validateAccount({
    accountNumber: parsed.accountNumber,
    branchCode: parsed.branchCode,
    accountType: parsed.accountType,
    accountHolder: input.mandate.accountHolder.trim(),
  });
  const status = remote.ok ? remote.status : 'error';
  const nowIso = nowOf(deps).toISOString();
  const id = idOf(deps);
  const existing = (await deps.repo.listMandates(input.companyId)).find(
    (mandate) => mandate.memberId === input.memberId && mandate.status !== 'cancelled'
  );
  const mandateId = existing?.id || id();
  const seal = deps.sealAccount;
  if (!seal) throw new Error('The debit order encryption key is not set.');
  const accountNumberEnc = seal(input.companyId, mandateId, parsed.accountNumber);
  if (!accountNumberEnc) throw new Error('The debit order encryption key is not set.');
  const number = existing?.netcashRef || `G${String(input.companyId).slice(-4)}${String(await deps.repo.nextNumber(input.companyId, 'mandate')).padStart(6, '0')}`;
  const mandate: Mandate = {
    id: mandateId,
    companyId: input.companyId,
    memberId: input.memberId,
    memberName: input.memberName,
    memberEmail: input.memberEmail,
    memberPhone: input.memberPhone,
    accountHolder: input.mandate.accountHolder.trim(),
    bankName: parsed.bankName,
    branchCode: parsed.branchCode,
    accountType: parsed.accountType,
    accountNumberEnc,
    accountLast4: parsed.accountNumber.slice(-4),
    validationStatus: status === 'valid' || status === 'invalid' ? status : 'error',
    validationRef: remote.ok ? remote.ref : '',
    debitDay: input.mandate.debitDay,
    amountCents: input.mandate.amountCents,
    currency: 'ZAR',
    status: 'pending',
    consentText: consentText(input.gymName),
    consentVersion: CONSENT_VERSION,
    signedAt: nowIso,
    signedIp: input.ip.slice(0, 64),
    signedUserAgent: input.userAgent.slice(0, 180),
    netcashRef: number,
    masterfileBatchId: existing?.masterfileBatchId || '',
    masterfileUploadedAt: null,
    startsOn: sastStamp(nowOf(deps)).date,
    endsOn: null,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  if (validation.status === 'invalid') mandate.validationStatus = 'invalid';
  await deps.repo.saveMandate(mandate);
  await audit(deps.repo, {
    id: id(),
    companyId: input.companyId,
    actor: input.memberId,
    action: 'mandate.sign',
    entity: 'mandate',
    entityId: mandate.id,
    ip: mandate.signedIp,
    detail: { validation: mandate.validationStatus, last4: mandate.accountLast4, consent: mandate.consentVersion },
    createdAt: nowIso,
  });
  return mandate;
}

export async function changeMandateStatus(
  deps: ServiceDeps,
  input: { companyId: number; mandateId: string; status: Mandate['status']; actor: string }
): Promise<Mandate> {
  const allowed = companyAllowed(input.companyId);
  if (!allowed.ok) throw new Error(allowed.error);
  const mandates = await deps.repo.listMandates(input.companyId);
  const mandate = mandates.find((row) => row.id === input.mandateId);
  if (!mandate) throw new Error('Mandate not found.');
  if (mandate.status === 'cancelled' && input.status !== 'cancelled') throw new Error('A cancelled mandate cannot be reopened.');
  if (input.status === 'active') {
    if (mandate.validationStatus !== 'valid') throw new Error('Validate the bank account before activating the mandate.');
    if (!mandate.signedAt) throw new Error('The member has not signed the mandate.');
    await uploadMasterfile(deps, input.companyId, mandate, input.actor);
  }
  const nowIso = nowOf(deps).toISOString();
  const next = {
    ...mandate,
    status: input.status,
    updatedAt: nowIso,
    endsOn: input.status === 'cancelled' ? sastStamp(nowOf(deps)).date : mandate.endsOn,
  };
  if (input.status === 'active') {
    const fresh = (await deps.repo.listMandates(input.companyId)).find((row) => row.id === mandate.id);
    next.masterfileBatchId = fresh?.masterfileBatchId || next.masterfileBatchId;
    next.masterfileUploadedAt = fresh?.masterfileUploadedAt || next.masterfileUploadedAt;
  }
  await deps.repo.saveMandate(next);
  await audit(deps.repo, {
    id: idOf(deps)(),
    companyId: input.companyId,
    actor: input.actor,
    action: `mandate.${input.status}`,
    entity: 'mandate',
    entityId: mandate.id,
    ip: '',
    detail: { status: input.status },
    createdAt: nowIso,
  });
  return next;
}

async function uploadMasterfile(deps: ServiceDeps, companyId: number, mandate: Mandate, actor: string) {
  const settings = await loadSettings(deps, companyId);
  const account = deps.openAccount?.(companyId, mandate) || '';
  if (!account) throw new Error('The bank account could not be opened. Check the encryption key.');
  const serviceKey = 'test-service-key';
  const file = buildMasterfile({
    serviceKey,
    mandates: [{ ...mandate, accountNumber: account }],
  });
  const client = (deps.clientFor || createNetcashClient)(settings.mode);
  const uploaded = await client.uploadMasterfile({ sha256: file.sha256, count: file.count });
  if (!uploaded.ok) throw new Error(uploaded.error);
  const sealed = deps.sealFile?.(companyId, file.body) || '';
  const nowIso = nowOf(deps).toISOString();
  await deps.repo.saveBatch({
    id: idOf(deps)(),
    companyId,
    runId: '',
    kind: 'masterfile',
    sha256: file.sha256,
    count: file.count,
    totalCents: 0,
    fileEnc: sealed,
    createdAt: nowIso,
  });
  mandate.masterfileBatchId = uploaded.batchId;
  mandate.masterfileUploadedAt = nowIso;
  await deps.repo.saveMandate(mandate);
  await audit(deps.repo, {
    id: idOf(deps)(),
    companyId,
    actor,
    action: 'masterfile.upload',
    entity: 'mandate',
    entityId: mandate.id,
    ip: '',
    detail: { batchId: uploaded.batchId, sha256: file.sha256, count: file.count },
    createdAt: nowIso,
  });
}

export async function previewBilling(
  deps: ServiceDeps,
  input: { companyId: number; members: BillableMember[]; actor: string }
): Promise<{ run: BillingRun; lines: BillingLine[] }> {
  const settings = await loadSettings(deps, input.companyId);
  const now = nowOf(deps);
  const sast = sastStamp(now);
  const period = periodWindow(settings, sast.date);
  const plan = planActionDate({
    requested: period.requested,
    now,
    leadBusinessDays: settings.leadBusinessDays,
    cutoffHourSast: settings.cutoffHourSast,
    cutoffMinute: settings.cutoffMinute,
  });
  const key = `${input.companyId}:${settings.cadence}:${period.periodKey}`;
  const existing = await deps.repo.findRunByKey(input.companyId, key);
  if (existing && existing.status !== 'preview' && existing.status !== 'failed') {
    const lines = await deps.repo.listLines(input.companyId, existing.id);
    return { run: existing, lines };
  }
  const nowIso = now.toISOString();
  const id = idOf(deps);
  const runId = existing?.id || id();
  const prior = await deps.repo.listLines(input.companyId);
  const fees = pendingLateFees(prior, settings);
  const lines = buildPreviewLines({
    companyId: input.companyId,
    runId,
    settings,
    members: input.members,
    mandates: await deps.repo.listMandates(input.companyId),
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    billedMemberIds: new Set(prior.filter((line) => line.invoiceNumber).map((line) => line.memberId)),
    pendingFees: fees,
    nowIso,
    id,
  });
  const expected = lines.filter((line) => line.collectionStatus === 'scheduled').reduce((sum, line) => sum + line.totalCents, 0);
  const run: BillingRun = {
    id: runId,
    companyId: input.companyId,
    periodKey: period.periodKey,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    status: 'preview',
    requestedActionDate: plan.requested,
    actionDate: plan.actionDate,
    cutoffApplied: plan.cutoffApplied,
    holidayShifted: plan.holidayShifted,
    actionDateNote: plan.note,
    expectedCents: expected,
    collectedCents: 0,
    unpaidCents: 0,
    memberCount: lines.length,
    batchCount: lines.filter((line) => line.collectionStatus === 'scheduled').length,
    idempotencyKey: key,
    netcashBatchId: '',
    fileSha256: '',
    submittedAt: null,
    reconciledAt: null,
    createdBy: input.actor,
    error: '',
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  await deps.repo.saveRun(run);
  await deps.repo.replaceRunLines(input.companyId, run.id, lines);
  await audit(deps.repo, {
    id: id(),
    companyId: input.companyId,
    actor: input.actor,
    action: 'run.preview',
    entity: 'run',
    entityId: run.id,
    ip: '',
    detail: { expectedCents: expected, members: lines.length, actionDate: run.actionDate },
    createdAt: nowIso,
  });
  return { run, lines };
}

export async function submitBilling(
  deps: ServiceDeps,
  input: { companyId: number; runId: string; actor: string; members: BillableMember[] }
): Promise<{ run: BillingRun; lines: BillingLine[] }> {
  const settings = await loadSettings(deps, input.companyId);
  if (!settings.merchantAccount) throw new Error('Add the Netcash merchant account before submitting.');
  if (!settings.serviceKeyConfigured) throw new Error('Add the Debit Order service key before submitting.');
  const current = (await deps.repo.listRuns(input.companyId)).find((run) => run.id === input.runId);
  if (!current) throw new Error('Billing run not found.');
  if (current.status === 'submitted' || current.status === 'reconciled' || current.status === 'cancelled') {
    return { run: current, lines: await deps.repo.listLines(input.companyId, current.id) };
  }
  const job = await deps.repo.claimJob(
    {
      companyId: input.companyId,
      kind: 'submit_batch',
      idempotencyKey: `submit:${input.runId}:${current.netcashBatchId || 'preview'}`,
      runId: input.runId,
    },
    nowOf(deps).toISOString()
  );
  if (job.state !== 'claimed') {
    return { run: current, lines: await deps.repo.listLines(input.companyId, current.id) };
  }
  try {
    if (current.status !== 'preview' && current.status !== 'failed' && current.status !== 'polling') {
      await deps.repo.finishJob(job.job.id, { status: 'succeeded', lastError: '' });
      return { run: current, lines: await deps.repo.listLines(input.companyId, current.id) };
    }
    const invoices = deps.invoices;
    if (!invoices) throw new Error('Invoicing is not available.');
    let lines = await deps.repo.listLines(input.companyId, current.id);
    const nowIso = nowOf(deps).toISOString();
    for (const line of lines) {
      if (line.invoiceNumber || line.totalCents <= 0) continue;
      const number = documentNumber(settings.invoicePrefix, await deps.repo.nextNumber(input.companyId, 'invoice'));
      const issued = await invoices.issue(
        invoiceFromLine(line, {
          number,
          issueDate: sastStamp(nowOf(deps)).date,
          dueDate: current.actionDate,
          vatBps: settings.vatBps,
        })
      );
      if (!issued.ok) throw new Error(issued.error);
      line.invoiceNumber = number;
      line.invoiceId = issued.invoiceId;
      line.financeStatus = 'issued';
      line.whatsappPath = whatsappHref(
        line.memberPhone,
        whatsappInvoiceText({
          gymName: deps.gymName || 'Your gym',
          invoiceNumber: number,
          totalCents: line.totalCents,
          actionDate: current.actionDate,
        })
      );
      const mail = invoiceEmail({
        gymName: deps.gymName || 'Your gym',
        memberName: line.memberName,
        invoiceNumber: number,
        totalCents: line.totalCents,
        actionDate: current.actionDate,
      });
      if (deps.mailer && settings.dunningEmail && line.memberEmail) {
        const sent = await deps.mailer({ to: line.memberEmail, subject: mail.subject, text: mail.text, companyId: input.companyId });
        line.notifiedAt = sent.ok ? nowIso : line.notifiedAt;
      }
      void issueJournal(line, settings);
    }
    const mandates = await deps.repo.listMandates(input.companyId);
    const accounts = new Map<string, string>();
    for (const mandate of mandates) {
      const opened = deps.openAccount?.(input.companyId, mandate) || '';
      if (opened) accounts.set(mandate.id, opened);
    }
    const rows = batchRowsFromLines(lines, mandates, accounts);
    const client = (deps.clientFor || createNetcashClient)(settings.mode);
    let batchId = '';
    let sha = '';
    if (rows.length) {
      const file = buildDebitBatchFile({ serviceKey: 'test-service-key', actionDate: current.actionDate, rows });
      sha = file.sha256;
      const sealed = deps.sealFile?.(input.companyId, file.body) || '';
      const submitted = await client.submitDebitBatch({
        sha256: file.sha256,
        actionDate: current.actionDate,
        rows: rows.map((row) => ({ netcashRef: row.netcashRef, amountCents: row.amountCents, accountNumber: row.accountNumber })),
      });
      if (!submitted.ok) throw new Error(submitted.error);
      batchId = submitted.batchId;
      await deps.repo.saveBatch({
        id: idOf(deps)(),
        companyId: input.companyId,
        runId: current.id,
        kind: 'debit_batch',
        sha256: file.sha256,
        count: file.count,
        totalCents: file.totalCents,
        fileEnc: sealed,
        createdAt: nowIso,
      });
      for (const line of lines) {
        if (line.collectionStatus === 'scheduled') line.collectionStatus = 'submitted';
        line.updatedAt = nowIso;
      }
    }
    const run: BillingRun = {
      ...current,
      status: 'submitted',
      netcashBatchId: batchId,
      fileSha256: sha,
      submittedAt: nowIso,
      updatedAt: nowIso,
      error: '',
      expectedCents: lines.filter((line) => line.collectionStatus === 'submitted').reduce((sum, line) => sum + line.totalCents, 0),
    };
    await deps.repo.saveRun(run);
    await deps.repo.saveLines(lines);
    await deps.repo.finishJob(job.job.id, { status: 'succeeded', lastError: '' });
    await audit(deps.repo, {
      id: idOf(deps)(),
      companyId: input.companyId,
      actor: input.actor,
      action: 'run.submit',
      entity: 'run',
      entityId: run.id,
      ip: '',
      detail: { batchId, sha256: sha, count: rows.length, journal: 'Dr 1180 Cr 4400 Cr 2120 on issue' },
      createdAt: nowIso,
    });
    void input.members;
    return { run, lines };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Submit failed';
    await deps.repo.finishJob(job.job.id, { status: 'failed', lastError: message });
    throw error;
  }
}

export async function pollBilling(
  deps: ServiceDeps,
  input: { companyId: number; runId: string; actor: string }
): Promise<{ run: BillingRun; lines: BillingLine[] }> {
  const settings = await loadSettings(deps, input.companyId);
  const run = (await deps.repo.listRuns(input.companyId)).find((row) => row.id === input.runId);
  if (!run) throw new Error('Billing run not found.');
  if (run.status === 'reconciled' || run.status === 'preview' || run.status === 'cancelled') {
    return { run, lines: await deps.repo.listLines(input.companyId, run.id) };
  }
  const job = await deps.repo.claimJob(
    { companyId: input.companyId, kind: 'poll_results', idempotencyKey: `poll:${run.id}:${run.netcashBatchId}`, runId: run.id },
    nowOf(deps).toISOString()
  );
  if (job.state !== 'claimed') {
    return { run, lines: await deps.repo.listLines(input.companyId, run.id) };
  }
  const lines = await deps.repo.listLines(input.companyId, run.id);
  const mandates = await deps.repo.listMandates(input.companyId);
  const accounts = new Map<string, string>();
  for (const mandate of mandates) {
    const opened = deps.openAccount?.(input.companyId, mandate) || '';
    if (opened) accounts.set(mandate.id, opened);
  }
  const rows = lines
    .filter((line) => line.collectionStatus === 'submitted' && line.mandateId)
    .map((line) => {
      const mandate = mandates.find((item) => item.id === line.mandateId);
      return { netcashRef: mandate?.netcashRef || '', accountNumber: mandate ? accounts.get(mandate.id) || '' : '' };
    })
    .filter((row) => row.netcashRef);
  const client = (deps.clientFor || createNetcashClient)(settings.mode);
  const fetched = await client.fetchResults({ batchId: run.netcashBatchId, rows });
  if (!fetched.ok) {
    await deps.repo.finishJob(job.job.id, { status: 'failed', lastError: fetched.error });
    throw new Error(fetched.error);
  }
  const applied = applyResults({
    lines,
    mandates,
    results: fetched.results,
    settings,
    nowIso: nowOf(deps).toISOString(),
    id: idOf(deps),
  });
  const invoices = deps.invoices;
  for (const line of applied.lines) {
    if (line.collectionStatus === 'paid' && invoices) {
      const paid = await invoices.markPaid({
        companyId: input.companyId,
        invoiceId: line.invoiceId,
        number: line.invoiceNumber,
        totalCents: line.totalCents,
        reference: run.netcashBatchId,
        paidAt: nowOf(deps).toISOString(),
      });
      line.financeStatus = paid.ok ? 'settled' : paid.error || 'settlement_failed';
      void settlementJournal(line, settings);
    }
    if (line.collectionStatus === 'reversed' && invoices && line.invoiceNumber && !line.creditNoteNumber) {
      const number = documentNumber(settings.creditPrefix, await deps.repo.nextNumber(input.companyId, 'credit'));
      const credit = await invoices.issue(
        invoiceFromLine(line, {
          number,
          issueDate: sastStamp(nowOf(deps)).date,
          dueDate: sastStamp(nowOf(deps)).date,
          vatBps: settings.vatBps,
          kind: 'credit_note',
          originalNumber: line.invoiceNumber,
        })
      );
      if (credit.ok) {
        line.creditNoteNumber = number;
        line.creditNoteId = credit.invoiceId;
      }
    }
    if (line.collectionStatus === 'unpaid' && settings.dunningEmail && deps.mailer && line.memberEmail && !line.notifiedAt) {
      const mail = dunningEmail({
        gymName: deps.gymName || 'Your gym',
        memberName: line.memberName,
        invoiceNumber: line.invoiceNumber,
        totalCents: line.totalCents,
        reason: line.netcashReasonText,
      });
      const sent = await deps.mailer({ to: line.memberEmail, subject: mail.subject, text: mail.text, companyId: input.companyId });
      if (sent.ok) line.notifiedAt = nowOf(deps).toISOString();
    }
  }
  for (const hold of applied.holds) await deps.repo.saveHold(hold);
  for (const memberId of applied.releasedMemberIds) await deps.repo.releaseHold(input.companyId, memberId, nowOf(deps).toISOString());
  const all = [...applied.lines, ...applied.retryLines];
  await deps.repo.saveLines(all);
  const collected = all.filter((line) => line.collectionStatus === 'paid').reduce((sum, line) => sum + line.totalCents, 0);
  const unpaid = all.filter((line) => line.collectionStatus === 'unpaid' || line.collectionStatus === 'reversed').reduce((sum, line) => sum + line.totalCents, 0);
  const retrying = applied.retryLines.length > 0;
  const next: BillingRun = {
    ...run,
    status: retrying ? 'polling' : 'reconciled',
    collectedCents: collected,
    unpaidCents: unpaid,
    reconciledAt: retrying ? null : nowOf(deps).toISOString(),
    updatedAt: nowOf(deps).toISOString(),
  };
  await deps.repo.saveRun(next);
  await deps.repo.finishJob(job.job.id, { status: 'succeeded', lastError: '' });
  await audit(deps.repo, {
    id: idOf(deps)(),
    companyId: input.companyId,
    actor: input.actor,
    action: 'run.reconcile',
    entity: 'run',
    entityId: run.id,
    ip: '',
    detail: { collectedCents: collected, unpaidCents: unpaid, holds: applied.holds.length, retries: applied.retryLines.length },
    createdAt: next.updatedAt,
  });
  return { run: next, lines: all };
}

export async function collectionsOverview(deps: ServiceDeps, companyId: number) {
  const allowed = companyAllowed(companyId);
  if (!allowed.ok) throw new Error(allowed.error);
  const runs = await deps.repo.listRuns(companyId);
  const lines = await deps.repo.listLines(companyId);
  return summariseCollections(runs, lines);
}

export async function runScheduled(deps: ServiceDeps, input: { companyId: number; members: BillableMember[] }) {
  const settings = await loadSettings(deps, input.companyId);
  const preview = await previewBilling(deps, { companyId: input.companyId, members: input.members, actor: 'cron' });
  if (!settings.autoSubmit || preview.run.status !== 'preview') return preview;
  return submitBilling(deps, { companyId: input.companyId, runId: preview.run.id, actor: 'cron', members: input.members });
}
