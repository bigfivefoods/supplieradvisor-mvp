import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { harbourBookPayload } from '@/lib/recovery/harbour-seed';
import { fileSha256, parseBookCsv, suggestMapping, validateBook } from '@/lib/recovery/import-book';
import { resolveMemberCompany } from '@/lib/recovery/member-company';
import { companyRecovergraphEnabled, isMigrationPending, loadRecoverDesk, MigrationPendingError } from '@/lib/recovery/recovergraph-db';
import { encryptId } from '@/lib/recovery/pii-crypto';
import { assertDemoBookAllowed, assertRealDataAllowed, DemoBookBlockedError, RealDataBlockedError } from '@/lib/recovery/real-data-guard';
import { allowedBookOps, resolveRecoverRole } from '@/lib/recovery/roles';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store' };
const BODY_CAP = 2_500_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMemberCompany(request);
    if (!member.ok) return json({ error: member.error }, member.status);
    const gate = await requireCompanyPermission(request, member.member.companyId, 'recovery', 'write');
    if (!gate.ok) {
      gate.response.headers.set('Cache-Control', 'private, no-store');
      return gate.response;
    }
    if (!(await companyRecovergraphEnabled(member.member.companyId))) {
      return json({ error: 'You do not have access to do that.' }, 403);
    }
    const rawText = await request.text();
    if (rawText.length > BODY_CAP) return json({ error: 'Request could not be read.' }, 400);
    const body = JSON.parse(rawText) as Record<string, unknown>;
    const action = String(body.action || '');
    const load = await loadRecoverDesk(member.member.companyId, { userId: gate.userId, email: member.member.email });
    if (!load.ready) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
    const role = resolveRecoverRole(gate.role, load.self);
    const op = action === 'dry_run' ? 'import.dry_run' : action === 'commit' ? 'import.commit' : action === 'rollback' ? 'import.rollback' : action === 'load_demo' ? 'import.load_demo' : action === 'clear_demo' ? 'import.clear_demo' : '';
    if (!op || !allowedBookOps(role).has(op)) return json({ error: 'You do not have access to do that.' }, 403);

    if (action === 'dry_run') {
      const parsed = parseBookCsv(String(body.csv || ''));
      if (!parsed.ok) return json({ ready: true, errors: [{ row: 0, field: 'file', code: parsed.code }], summary: { will_create: 0, already_placed: 0, errors: 1, warnings: 0 } });
      const mapping = (body.mapping && typeof body.mapping === 'object' ? body.mapping : suggestMapping(parsed.headers)) as Record<string, string>;
      const result = validateBook(parsed, mapping, { today: new Date().toISOString().slice(0, 10) });
      const sha = await fileSha256(String(body.csv || ''));
      return json({
        ready: true,
        sha,
        summary: result.summary,
        errors: result.errors,
        warnings: result.warnings,
        suggested: suggestMapping(parsed.headers),
      });
    }

    const supabase = getSupabaseServer();
    if (action === 'load_demo') {
      assertDemoBookAllowed(load.workspace);
      const loaded = await supabase.rpc('recover_load_demo_book', {
        p_company_id: member.member.companyId,
        p_actor_id: gate.userId,
        p_book: await sealDemoBook(),
      });
      if (isMigrationPending(loaded.error)) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
      if (loaded.error) return json({ error: 'RecoverAdvisor® could not load the demo book.' }, 400);
      return json(loaded.data);
    }
    if (action === 'clear_demo') {
      const cleared = await supabase.rpc('recover_clear_demo', {
        p_company_id: member.member.companyId,
        p_actor_id: gate.userId,
      });
      if (isMigrationPending(cleared.error)) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
      if (cleared.error) return json({ error: 'RecoverAdvisor® could not clear the demo book.' }, 400);
      return json(cleared.data);
    }
    if (action === 'rollback') {
      const rolled = await supabase.rpc('recover_rollback_batch', {
        p_company_id: member.member.companyId,
        p_actor_id: gate.userId,
        p_batch_id: String(body.batch_id || ''),
      });
      if (isMigrationPending(rolled.error)) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
      if (rolled.error) return json({ error: 'RecoverAdvisor® could not roll that batch back.' }, 400);
      return json(rolled.data);
    }
    assertRealDataAllowed(load.workspace);
    const csv = String(body.csv || '');
    const parsed = parseBookCsv(csv);
    if (!parsed.ok) return json({ error: 'That file could not be read.' }, 400);
    const mapping = (body.mapping && typeof body.mapping === 'object' ? body.mapping : suggestMapping(parsed.headers)) as Record<string, string>;
    const validated = validateBook(parsed, mapping, { today: new Date().toISOString().slice(0, 10) });
    if (validated.rows.some((row) => row.id_plain)) {
      const probe = encryptId('configured');
      if (!probe.ok) return json({ ready: false, reason: 'pii_not_configured' });
    }
    const rows = [];
    for (const row of validated.rows) {
      let id_number_enc: string | null = null;
      let id_hash: string | null = null;
      let id_last4: string | null = null;
      let id_key_version: number | null = null;
      if (row.id_plain) {
        const sealed = encryptId(row.id_plain);
        if (!sealed.ok) return json({ ready: false, reason: 'pii_not_configured' });
        id_number_enc = sealed.enc;
        id_hash = sealed.hash;
        id_last4 = sealed.last4;
        id_key_version = sealed.version;
      }
      rows.push({
        creditor_account_ref: row.creditor_account_ref,
        display_name: row.display_name,
        kind: row.kind,
        first_names: row.first_names,
        last_name: row.last_name,
        company_name: row.company_name,
        id_type: row.id_type || null,
        id_number_enc,
        id_hash,
        id_last4,
        id_key_version,
        principal_cents: row.principal_cents,
        interest_cents: row.interest_cents,
        fees_cents: row.fees_cents,
        costs_cents: row.costs_cents,
        original_cents: row.original_cents,
        default_date: row.default_date,
        contacts: row.contacts,
        row_number: row.row,
      });
    }
    const committed = await supabase.rpc('recover_import_commit', {
      p_company_id: member.member.companyId,
      p_actor_id: gate.userId,
      p_batch: {
        creditor_id: body.creditor_id,
        mandate_id: body.mandate_id,
        source: 'csv',
        file_name: String(body.file_name || 'book.csv').slice(0, 120),
        file_sha256: await fileSha256(csv),
        mapping,
        is_demo: false,
      },
      p_rows: rows,
    });
    if (isMigrationPending(committed.error)) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
    if (committed.error) return json({ error: 'RecoverAdvisor® could not place that book.' }, 400);
    return json(committed.data);
  } catch (error) {
    if (error instanceof RealDataBlockedError || error instanceof DemoBookBlockedError) return json({ error: error.message }, 403);
    if (error instanceof MigrationPendingError) return json({ ready: false, reason: 'migration_pending', feature: 'import' });
    return json({ error: 'RecoverAdvisor® could not import that book.' }, 400);
  }
}

async function sealDemoBook() {
  const book = harbourBookPayload();
  const { createHash } = await import('node:crypto');
  return {
    ...book,
    batches: book.batches.map((batch) => ({
      ...batch,
      file_sha256: createHash('sha256').update(batch.file_name).digest('hex'),
      mapping: {},
    })),
  };
}
