'use client';

import { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { RecoverPendingBanner } from './RecoverChrome';
import { ENABLE_REAL_DATA_PHRASE } from '@/lib/recovery/validate';
import { staffRoleLabel } from '@/lib/recovery/roles';
import type {
  OperatorType,
  RecoverOp,
  RecoverStaff,
  StaffRole,
  TrustMode,
} from '@/lib/recovery/types';
import {
  RecoverBanner,
  RecoverButton,
  RecoverDemoGate,
  RecoverField,
  RecoverPanel,
  RecoverQuietButton,
  RecoverRoleChip,
  RecoverScreen,
  formatRand,
  recoverInputClass,
} from './RecoverChrome';
import { usePreviewBook, useRecoverDesk } from './useRecoverDesk';

function percentFromBps(bps: number | null | undefined): string {
  if (bps == null || Number.isNaN(bps)) return '';
  const percent = bps / 100;
  return Number.isInteger(percent) ? String(percent) : String(Math.round(percent * 100) / 100);
}

function percentToBps(raw: FormDataEntryValue | null): number | null {
  const text = String(raw || '').trim();
  if (text === '') return null;
  const percent = Number(text);
  if (!Number.isFinite(percent)) return null;
  return Math.round(percent * 100);
}

const STAFF_ROLES: Array<{ value: StaffRole; label: string }> = [
  { value: 'manager', label: 'Manager' },
  { value: 'collector', label: 'Agent' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'finance_view', label: 'Finance' },
];

export function RecoverTeam() {
  const { desk, error, loading, saving, save } = useRecoverDesk();
  const previewBook = usePreviewBook();
  const [phrase, setPhrase] = useState('');
  const [dialog, setDialog] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('collector');
  const [staffTarget, setStaffTarget] = useState('');
  const workspace = desk?.workspace;
  const canEdit = Boolean(desk?.capabilities.canEditSettings);
  const canStaff = Boolean(desk?.capabilities.canManageStaff);
  const canReal = Boolean(desk?.capabilities.canSetRealData);

  async function onWorkspace(form: FormData) {
    const op: RecoverOp = {
      op: workspace ? 'update_workspace' : 'init_workspace',
      display_name: String(form.get('display_name') || ''),
      operator_type: String(form.get('operator_type') || 'agency') as OperatorType,
      trust_mode: String(form.get('trust_mode') || 'trust') as TrustMode,
      cfdc_registration_no: String(form.get('cfdc_registration_no') || ''),
      cfdc_expiry: String(form.get('cfdc_expiry') || '') || null,
      vat_registered: form.get('vat_registered') === 'on',
      vat_rate_bps: percentToBps(form.get('vat_rate_percent')),
    };
    await save(op);
  }

  async function onBlock(enabled: boolean) {
    const op = { op: 'workspace.set_assignment_block' as const, enabled };
    if (previewBook) {
      previewBook(op);
      return;
    }
    await save(op);
  }

  async function onStaff(form: FormData) {
    const rands = String(form.get('target_rands') || '').trim();
    const email = String(form.get('email') || '');
    const expires = String(form.get('registration_expires_on') || '').trim();
    const ok = await save({
      op: 'upsert_staff',
      email,
      role: String(form.get('role') || 'collector') as StaffRole,
      cfdc_registration_no: String(form.get('cfdc_registration_no') || ''),
      monthly_target_cents: rands === '' ? null : Math.round(Number(rands) * 100),
    });
    if (ok && expires) {
      await save({ op: 'staff.set_expiry', email, expires_on: expires });
    }
    if (ok) {
      setStaffEmail('');
      setStaffTarget('');
    }
  }

  return (
    <RecoverScreen
      title="Team & registrations"
      description="Operator profile, Council registration, and the people who work the book."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      <RecoverDemoGate desk={desk} />
      {desk && !desk.ready ? (
        <RecoverPendingBanner role={desk.role} />
      ) : null}
      {loading || !desk ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" aria-busy="true" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <RecoverPanel title="Workspace">
            <form
              data-testid="recover-team-form"
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onWorkspace(new FormData(event.currentTarget));
              }}
            >
              <RecoverField label="Display name">
                <input
                  name="display_name"
                  defaultValue={workspace?.display_name || ''}
                  className={recoverInputClass}
                  disabled={!canEdit || !desk.ready}
                />
              </RecoverField>
              <RecoverField label="Operator">
                <select
                  name="operator_type"
                  defaultValue={workspace?.operator_type || 'agency'}
                  className={recoverInputClass}
                  disabled={!canEdit || !desk.ready}
                >
                  <option value="agency">Agency</option>
                  <option value="in_house">In-house</option>
                  <option value="attorney">Attorney</option>
                </select>
              </RecoverField>
              <RecoverField label="Programme">
                <input value="Collections" readOnly className={recoverInputClass} />
              </RecoverField>
              <RecoverField label="Trust mode">
                <select
                  name="trust_mode"
                  defaultValue={workspace && 'trust_mode' in workspace ? workspace.trust_mode : 'trust'}
                  className={recoverInputClass}
                  disabled={!canEdit || !desk.ready}
                >
                  <option value="trust">Trust account</option>
                  <option value="direct">Paid direct to the creditor</option>
                </select>
              </RecoverField>
              <p className="sm:col-span-2 text-sm leading-relaxed text-slate-600">
                Trust mode means money collected for a creditor is held and remitted. Direct means the creditor is paid without a trust ledger. The ledger itself is not open yet.
              </p>
              <label className="sm:col-span-2 flex min-h-11 items-start gap-2 text-sm font-semibold text-slate-900">
                <input
                  data-testid="recover-assignment-block"
                  type="checkbox"
                  className="mt-1"
                  checked={workspace?.block_unregistered_assignment !== false}
                  disabled={!canEdit || !desk.ready}
                  onChange={(event) => void onBlock(event.target.checked)}
                />
                <span>Block assignment when a collector&apos;s Council registration is missing or recorded as expired. ⚖ VERIFY who must register. RecoverAdvisor® gives no legal advice.</span>
              </label>
              <RecoverField label="CFDC number">
                <input
                  name="cfdc_registration_no"
                  defaultValue={workspace?.cfdc_registration_no || ''}
                  className={recoverInputClass}
                  disabled={!canEdit || !desk.ready}
                />
              </RecoverField>
              <RecoverField label="CFDC expiry">
                <input
                  name="cfdc_expiry"
                  type="date"
                  defaultValue={workspace?.cfdc_expiry || ''}
                  className={`${recoverInputClass} recover-date`}
                  disabled={!canEdit || !desk.ready}
                />
              </RecoverField>
              <RecoverField label="VAT registered">
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900">
                  <input
                    name="vat_registered"
                    type="checkbox"
                    defaultChecked={workspace?.vat_registered}
                    disabled={!canEdit || !desk.ready}
                  />
                  Registered for VAT
                </label>
              </RecoverField>
              <RecoverField label="VAT rate %">
                <input
                  name="vat_rate_percent"
                  inputMode="decimal"
                  defaultValue={percentFromBps(workspace?.vat_rate_bps)}
                  placeholder="15"
                  className={`${recoverInputClass} tabular-nums`}
                  disabled={!canEdit || !desk.ready}
                />
                <span className="mt-1.5 block text-xs font-medium normal-case tracking-normal text-slate-600">
                  Percent. 15 means a 15% rate.
                </span>
              </RecoverField>
              {canEdit ? (
                <div className="sm:col-span-2">
                  <RecoverButton type="submit" disabled={saving || !desk.ready}>
                    {workspace ? 'Save workspace' : 'Create workspace'}
                  </RecoverButton>
                </div>
              ) : null}
            </form>
          </RecoverPanel>

          <div className="space-y-4">
            <RecoverPanel title="Staff">
              <p className="mb-3 text-sm text-slate-600">
                Council registration is shown as recorded by you. ⚖ VERIFY the categories of persons who must register. RecoverAdvisor® gives no legal advice.
              </p>
              {canStaff ? (
                <form
                  className="mb-4 grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onStaff(new FormData(event.currentTarget));
                  }}
                >
                  <RecoverField label="Email">
                    <input
                      name="email"
                      type="email"
                      required
                      value={staffEmail}
                      onChange={(event) => setStaffEmail(event.target.value)}
                      className={recoverInputClass}
                      disabled={!desk.ready}
                    />
                  </RecoverField>
                  <RecoverField label="Role">
                    <select
                      name="role"
                      value={staffRole}
                      onChange={(event) => setStaffRole(event.target.value as StaffRole)}
                      className={recoverInputClass}
                      disabled={!desk.ready}
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </RecoverField>
                  <RecoverField label="CFDC number">
                    <input name="cfdc_registration_no" className={recoverInputClass} disabled={!desk.ready} />
                  </RecoverField>
                  <RecoverField label="Registration date as recorded by you">
                    <input name="registration_expires_on" type="date" className={recoverInputClass} disabled={!desk.ready} />
                  </RecoverField>
                  <RecoverField label="Monthly target (rand)">
                    <input
                      name="target_rands"
                      inputMode="decimal"
                      value={staffTarget}
                      onChange={(event) => setStaffTarget(event.target.value)}
                      className={`${recoverInputClass} tabular-nums`}
                      disabled={!desk.ready}
                    />
                  </RecoverField>
                  <div className="sm:col-span-2">
                    <RecoverButton type="submit" disabled={saving || !desk.ready}>
                      Save staff
                    </RecoverButton>
                  </div>
                </form>
              ) : null}
              <StaffTable
                rows={desk.staff}
                canStaff={canStaff && desk.ready}
                saving={saving}
                onDeactivate={(id) => void save({ op: 'deactivate_staff', id })}
              />
            </RecoverPanel>

            {canReal ? (
              <RecoverPanel title="Real debtor data" testId="recover-real-data">
                <p className="mb-4 text-sm leading-relaxed text-slate-600">
                  Debtor records for RecoverAdvisor® stay off until the data-location review and the operator agreement are signed. Until then the workspace stays in demo-data mode.
                </p>
                <p className="mb-4 text-sm font-semibold text-slate-900">
                  {workspace?.real_data_enabled ? 'Real data is on.' : 'Demo-data mode is on.'}
                </p>
                {workspace?.real_data_enabled ? (
                  <RecoverQuietButton
                    disabled={saving || !workspace}
                    onClick={() => void save({ op: 'set_real_data_enabled', enabled: false })}
                  >
                    Return to demo-data mode
                  </RecoverQuietButton>
                ) : (
                  <RecoverButton disabled={!workspace || !desk.ready} onClick={() => setDialog(true)}>
                    Enable real data
                  </RecoverButton>
                )}
              </RecoverPanel>
            ) : null}
          </div>
        </div>
      )}

      {dialog ? (
        <div
          className="fixed inset-0 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          style={{ zIndex: 800 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recover-real-data-title"
            data-testid="recover-real-data-dialog"
            className="w-full max-w-lg rounded-3xl border border-[#e2e8f0] bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-cyan-50 text-[#0077b6] shadow-sm">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <h2 id="recover-real-data-title" className="text-xl font-black tracking-tight text-slate-900">
              Enable real debtor data
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This confirms the workspace may hold real debtor records. Type {ENABLE_REAL_DATA_PHRASE} to continue.
            </p>
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className={`${recoverInputClass} mt-4`}
              aria-label="Confirmation phrase"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <RecoverButton
                disabled={saving || phrase !== ENABLE_REAL_DATA_PHRASE}
                onClick={() => {
                  void save({
                    op: 'set_real_data_enabled',
                    enabled: true,
                    confirm: phrase,
                  }).then((ok) => {
                    if (ok) {
                      setDialog(false);
                      setPhrase('');
                    }
                  });
                }}
              >
                Enable real data
              </RecoverButton>
              <RecoverQuietButton
                onClick={() => {
                  setDialog(false);
                  setPhrase('');
                }}
              >
                Cancel
              </RecoverQuietButton>
            </div>
          </div>
        </div>
      ) : null}
    </RecoverScreen>
  );
}

function StaffTable({
  rows,
  canStaff,
  saving,
  onDeactivate,
}: {
  rows: RecoverStaff[];
  canStaff: boolean;
  saving: boolean;
  onDeactivate: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-white text-[#0077b6]">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-slate-900">No staff yet</p>
        <p className="mt-1 text-sm text-slate-600">Add a manager, agent, compliance officer, or finance viewer.</p>
      </div>
    );
  }
  return (
    <div data-testid="recover-staff-table" className="overflow-hidden rounded-2xl border border-[#e2e8f0]">
      <ul className="grid gap-2 p-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <p className="break-all text-sm font-black text-slate-900">{row.email}</p>
            <p className="mt-1 text-xs font-bold text-slate-700">{staffRoleLabel(row.role)}</p>
            <RegistrationChip row={row} />
            <p className="mt-1 text-sm tabular-nums text-slate-700">{formatRand(row.monthly_target_cents)}</p>
            {row.status === 'active' && canStaff ? (
              <button
                type="button"
                className="recover-focus mt-2 min-h-11 text-sm font-semibold text-[#0077b6]"
                disabled={saving}
                onClick={() => onDeactivate(row.id)}
              >
                Deactivate
              </button>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{row.status}</p>
            )}
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wider text-slate-600">
          <tr>
            <th className="px-3 py-3">Email</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Target</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#e2e8f0]">
              <td className="px-3 py-3 font-medium text-slate-900">{row.email}</td>
              <td className="px-3 py-3">
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white px-2 py-1 text-xs font-bold text-slate-900">
                  <Users className="h-3.5 w-3.5 text-[#0077b6]" aria-hidden />
                  {staffRoleLabel(row.role)}
                </span>
                <RegistrationChip row={row} />
              </td>
              <td className="px-3 py-3 tabular-nums text-slate-700">{formatRand(row.monthly_target_cents)}</td>
              <td className="px-3 py-3">
                {row.status === 'active' && canStaff ? (
                  <button
                    type="button"
                    className="recover-focus min-h-11 text-sm font-semibold text-[#0077b6]"
                    disabled={saving}
                    onClick={() => onDeactivate(row.id)}
                  >
                    Deactivate
                  </button>
                ) : (
                  <span className="text-slate-600">{row.status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrationChip({ row }: { row: RecoverStaff }) {
  if (row.role !== 'collector') return null;
  const today = new Date().toISOString().slice(0, 10);
  const missing = !row.cfdc_registration_no;
  const expired = Boolean(row.registration_expires_on && row.registration_expires_on < today);
  if (!missing && !expired) return null;
  return (
    <p data-testid="recover-reg-chip" className="mt-1 text-xs font-bold text-[#0077b6]">
      {missing ? 'Missing registration as recorded by you' : 'Expired registration as recorded by you'}
    </p>
  );
}
