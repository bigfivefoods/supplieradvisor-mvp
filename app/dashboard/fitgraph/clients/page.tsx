'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Download, Link2, Mail, Pencil, Upload, X } from 'lucide-react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fc,
} from '@/components/fitness/FitForm';
import { MEMBERSHIP_STATUSES, type FitClient } from '@/lib/fitness/fitgraph';
import {
  gymCollectsDebitBank,
  gymRequiresDebitBank,
  memberDebitBankComplete,
} from '@/lib/fitness/member-debit-bank';
import {
  emptyDebitBankForm,
  MemberDebitBankFields,
  type DebitBankForm,
} from '@/components/fitness/MemberDebitBankFields';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import {
  InjuryProfileFields,
  emptyInjuryForm,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';
import { AdvisorTreatmentPlanPanel } from '@/components/services/AdvisorTreatmentPlanPanel';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { DeskUseMyWalletButton } from '@/components/b2c/DeskWalletPatientFields';
import {
  AdvisorIncomingShares,
  AdvisorProfileShare,
} from '@/components/advisors/AdvisorProfileShare';
import {
  InlineSelect,
  InlineText,
  InlineToggleSelect,
} from '@/components/services/InlineListFields';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || '');
      const b64 = r.includes(',') ? r.split(',')[1] : r;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

type ClientForm = {
  id?: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  id_number: string;
  photo_url: string;
  membership_plan_id: string;
  membership_status: string;
  private_client: boolean;
  coach_id: string;
  start_date: string;
  emergency_contact: string;
  notes: string;
  health: InjuryFormState;
  debit_bank: DebitBankForm;
};

const blankForm = (): ClientForm => ({
  code: '',
  name: '',
  email: '',
  phone: '',
  id_number: '',
  photo_url: '',
  membership_plan_id: '',
  membership_status: 'active',
  private_client: false,
  coach_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  emergency_contact: '',
  notes: '',
  health: emptyInjuryForm(),
  debit_bank: emptyDebitBankForm(),
});

export default function ClientsPage() {
  const { companyId, store, loading, saving, post, load, summary } =
    useFitgraph();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<ClientForm>(blankForm);
  const [editing, setEditing] = useState(false);
  /** Row id with list inline editors open (toggle via Edit / Done) */
  const [listEditId, setListEditId] = useState<string | null>(null);

  const openEdit = (c: FitClient) => {
    setForm({
      id: c.id,
      code: c.code || '',
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      id_number: c.id_number || '',
      photo_url: c.photo_url || '',
      membership_plan_id: c.membership_plan_id || '',
      membership_status: c.membership_status || 'active',
      private_client: c.private_client === true,
      coach_id: c.coach_id || '',
      start_date:
        c.start_date || new Date().toISOString().slice(0, 10),
      emergency_contact: c.emergency_contact || '',
      notes: c.notes || '',
      health: healthToForm(c.health),
      debit_bank: c.debit_bank
        ? {
            account_holder: c.debit_bank.account_holder || '',
            bank_name: c.debit_bank.bank_name || '',
            account_number: c.debit_bank.account_number || '',
            branch_code: c.debit_bank.branch_code || '',
            account_type: c.debit_bank.account_type || 'cheque',
            debit_order_authorised:
              c.debit_bank.debit_order_authorised === true,
          }
        : emptyDebitBankForm(),
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (form.private_client && !form.coach_id) {
      toast.error('Private clients need an assigned coach');
      return;
    }
    const health = formToHealthPayload(form.health);
    await post({
      entity: 'clients',
      action: 'upsert',
      record: {
        id: form.id,
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        id_number: form.id_number || '',
        photo_url: form.photo_url || '',
        membership_plan_id: form.membership_plan_id || null,
        membership_status: form.membership_status,
        private_client: form.private_client === true,
        coach_id: form.coach_id || null,
        start_date: form.start_date,
        emergency_contact: form.emergency_contact,
        notes: form.notes,
        debit_bank: form.debit_bank.account_number
          ? form.debit_bank
          : undefined,
        health,
        health_updated_by: 'desk',
      },
    });
    toast.success(form.id ? 'Client profile updated' : 'Client saved');
    setForm(blankForm());
    setEditing(false);
  };

  /** Inline list save — only patches visible columns */
  const patchClient = async (
    client: FitClient,
    patch: Partial<FitClient> & Record<string, unknown>
  ) => {
    const nextPrivate =
      patch.private_client !== undefined
        ? patch.private_client === true
        : client.private_client === true;
    const nextCoach =
      patch.coach_id !== undefined ? patch.coach_id : client.coach_id;
    if (nextPrivate && !nextCoach) {
      toast.error('Private clients need an assigned coach');
      return;
    }
    if (patch.name !== undefined && !String(patch.name || '').trim()) {
      toast.error('Name required');
      return;
    }
    try {
      await post({
        entity: 'clients',
        action: 'upsert',
        record: {
          ...client,
          ...patch,
          id: client.id,
        },
      });
      toast.success('Saved');
    } catch {
      /* toast from post */
    }
  };

  const downloadXlsx = (kind: 'clients' | 'clients_template') => {
    const url = `/api/fitness/fitgraph?companyId=${companyId}&export=${kind}`;
    window.open(url, '_blank');
  };

  const issuePortal = async (clientId: string) => {
    try {
      const data = await post({
        action: 'issue_client_portal',
        clientId,
      });
      const tok = data?.portal_token as string | undefined;
      if (tok && typeof window !== 'undefined') {
        const url = `${window.location.origin}/me?link=${encodeURIComponent(tok)}`;
        await navigator.clipboard.writeText(url);
        toast.success('SA Member app link copied — they log in and the gym is added');
      } else {
        toast.success('Member portal issued');
      }
      await load();
    } catch {
      /* toast in post */
    }
  };

  const inviteMember = async (c: FitClient) => {
    if (!c.email?.trim()) {
      toast.error('Add an email on the client profile before inviting');
      return;
    }
    try {
      const data = await post({
        action: 'invite_client',
        clientId: c.id,
        email: c.email,
      });
      const link = String(
        data?.member_app_link || data?.invite_link || ''
      );
      if (link && typeof window !== 'undefined') {
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          /* ignore clipboard */
        }
      }
      if (data?.warning) {
        toast.warning(String(data.warning));
      } else {
        toast.success(
          data?.message ||
            `Invite sent to ${c.email} — they can join and book classes`
        );
      }
      await load();
    } catch {
      /* toast in post */
    }
  };

  const copyPortal = async (tok: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/member/fitgraph/${encodeURIComponent(tok)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Member portal link copied');
  };

  const freezeMembership = async (c: FitClient, freeze: boolean) => {
    try {
      const data = await post({
        action: freeze ? 'freeze_membership' : 'unfreeze_membership',
        client_id: c.id,
      });
      toast.success(
        data?.message ||
          (freeze ? 'Membership frozen' : 'Membership unfrozen')
      );
      await load();
    } catch {
      /* toast in post */
    }
  };

  const onFile = async (file: File) => {
    setImporting(true);
    try {
      const name = file.name.toLowerCase();
      const isXlsx =
        name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel');

      let body: Record<string, unknown>;
      if (isXlsx) {
        const xlsxBase64 = await fileToBase64(file);
        body = {
          action: 'import_clients',
          xlsxBase64,
          fileName: file.name,
        };
      } else {
        const text = await file.text();
        body = {
          action: 'import_clients',
          csv: text,
          fileName: file.name,
        };
      }

      const data = await post(body);
      const created = Number(data?.created) || 0;
      const updated = Number(data?.updated) || 0;
      toast.success(
        data?.message ||
          `Imported ${created} new, updated ${updated} existing client(s)`
      );
      const warnings = (data?.warnings || []) as string[];
      const parseErrors = (data?.parseErrors || []) as string[];
      if (warnings.length) {
        toast.message(
          `${warnings.length} warning(s): ${warnings.slice(0, 3).join('; ')}${
            warnings.length > 3 ? '…' : ''
          }`
        );
      }
      if (parseErrors.length) {
        toast.message(
          `${parseErrors.length} row issue(s): ${parseErrors
            .slice(0, 3)
            .join('; ')}`
        );
      }
      await load();
    } catch (e: unknown) {
      if (!(e instanceof Error)) toast.error('Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const injuredCount =
    store?.clients.filter((c) => isInjured(c.health)).length || 0;
  const privateCount =
    store?.clients.filter((c) => c.private_client === true).length || 0;

  return (
    <FitgraphWorkbench
      title="Clients / members"
      titleAccent="member book"
      description="Member register with plan, private-client flag, and coach. Edit code, name, type, plan, status, and coach directly in the list — use Edit for the full profile, injury notes, and portal tools."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorMemberAppInvite
            kind="gym"
            companyId={companyId}
            brand={store.settings?.brand_name}
            audience="members"
          />
          <AdvisorIncomingShares companyId={companyId} />
          <StatRow
            tone="member"
            items={[
              { label: 'Clients', value: Number(summary?.clientCount) || 0 },
              { label: 'Active', value: Number(summary?.activeMembers) || 0 },
              { label: 'Private clients', value: privateCount },
              { label: 'Injured / recovering', value: injuredCount },
            ]}
          />

          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-700/50 dark:bg-sky-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-sky-950 dark:text-sky-100">
                  Client list (.xlsx)
                </h3>
                <p className="text-[11px] text-sky-900/80 dark:text-sky-200/80 mt-0.5 max-w-xl">
                  Download your current members, or a blank template. Coaches can
                  also update injury profiles from the coach portal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download list
                </button>
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients_template')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Blank template
                </button>
                <button
                  type="button"
                  disabled={importing || saving}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? 'Importing…' : 'Upload .xlsx'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </div>
            </div>
          </div>

          <FormCard
            tone="member"
            title={editing ? 'Edit client profile' : 'Add client / member'}
            description={
              editing
                ? 'Update contact details and injury awareness for coaches on the floor.'
                : 'Register a member; add injury details anytime so coaches can adapt sessions.'
            }
            onSubmit={() => void save()}
            saving={saving}
            submitLabel={editing ? 'Save profile' : 'Add client'}
          >
            {editing ? (
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setForm(blankForm());
                    setEditing(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" /> Cancel edit
                </button>
              </div>
            ) : null}
            <input
              className={fc()}
              placeholder="Code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Name *"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <DeskUseMyWalletButton
                disabled={saving}
                onFill={(w) =>
                  setForm((f) => ({
                    ...f,
                    name: f.name.trim() || w.full_name || f.name,
                    email: w.email || f.email,
                    phone: w.phone || f.phone,
                    photo_url: w.photo_url || f.photo_url,
                  }))
                }
              />
            </div>
            <input
              className={fc()}
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="ID number"
              value={form.id_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, id_number: e.target.value }))
              }
            />
            <ProfilePhotoField
              companyId={companyId}
              value={form.photo_url}
              onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
              kind="client_photo"
              label="Member photo"
              description="Upload a profile photo for this client (JPG/PNG/WebP · under 8MB)."
              disabled={saving}
              accentClass="border-sky-300 dark:border-cyan-500"
            />
            <select
              className={fc()}
              value={form.membership_plan_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  membership_plan_id: e.target.value,
                }))
              }
            >
              <option value="">Plan…</option>
              {store.membership_plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.membership_status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  membership_status: e.target.value,
                }))
              }
            >
              {MEMBERSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">
                {form.private_client
                  ? 'Coach (required for private)…'
                  : 'Coach (optional)…'}
              </option>
              {store.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/40 dark:bg-yellow-950/30 px-3 py-2">
              <input
                type="checkbox"
                checked={form.private_client}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    private_client: e.target.checked,
                  }))
                }
              />
              <span>
                Private client
                <span className="block text-[10px] font-normal text-slate-500">
                  1:1 / PT client of the assigned coach (not only gym-floor
                  member)
                </span>
              </span>
            </label>
            <input
              className={fc()}
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_date: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Emergency contact"
              value={form.emergency_contact}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  emergency_contact: e.target.value,
                }))
              }
            />
            {store && gymCollectsDebitBank(store) ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <MemberDebitBankFields
                  value={form.debit_bank}
                  onChange={(debit_bank) =>
                    setForm((f) => ({ ...f, debit_bank }))
                  }
                  required={gymRequiresDebitBank(store)}
                  complete={
                    form.debit_bank.account_number.length >= 6 &&
                    form.debit_bank.debit_order_authorised
                  }
                  inputClass={fc() + ' mt-1'}
                />
              </div>
            ) : null}
            <input
              className={fc() + ' sm:col-span-2'}
              placeholder="Desk notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />

            {editing && store.clients.find((x) => x.id === form.id)?.family?.length ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-200 mb-1.5">
                  Family members (from member portal)
                </p>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {(store.clients.find((x) => x.id === form.id)?.family || [])
                    .filter((m) => m.active !== false)
                    .map((m) => (
                      <li key={m.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-xs text-slate-500 capitalize">
                          {m.relationship}
                          {m.is_minor ? ' · minor' : ''}
                          {m.date_of_birth ? ` · DOB ${m.date_of_birth}` : ''}
                          {m.id_number ? ` · ID ${m.id_number}` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <InjuryProfileFields
              variant="coach"
              value={form.health}
              onChange={(health) => setForm((f) => ({ ...f, health }))}
              inputClass={fc()}
            />
          </FormCard>

          {editing && form.id ? (
            <AdvisorTreatmentPlanPanel
              personId={form.id}
              personLabel={form.name}
              plans={store.treatment_plans || []}
              services={(store.class_types || []).map((c) => ({
                id: c.id,
                name: c.name,
              }))}
              appointments={(store.sessions || []).map((s) => ({
                id: s.id,
                service_id: s.class_type_id,
                date: s.date,
                start_time: s.start_time,
                status:
                  s.status === 'cancelled' || s.status === 'completed'
                    ? s.status
                    : 'scheduled',
              }))}
              bookings={store.bookings || []}
              useSessionId
              accentClass="border-yellow-200"
              post={async (body) => {
                await post(body);
              }}
              onRefresh={() => {
                void load();
              }}
            />
          ) : null}

          {editing && form.id ? (
            <AdvisorProfileShare
              companyId={companyId}
              personId={form.id}
              kind="gym"
              personName={form.name}
              email={form.email}
              platformUserId={
                store.clients.find((x) => x.id === form.id)?.platform_user_id
              }
            />
          ) : null}

          <p className="text-[11px] text-slate-500 -mb-2">
            Press <strong>Edit</strong> on a row to change code, name, type,
            plan, status, and coach. Press <strong>Done</strong> to lock the
            row. <strong>Profile</strong> opens the full form.
          </p>

          <DataTable
            tone="member"
            headers={[
              '',
              'Code',
              'Name',
              'Type',
              'Plan',
              'Status',
              ...(store && gymCollectsDebitBank(store) ? ['Debit'] : []),
              'Coach',
              'Injury / recovery',
              'Portal',
              '',
            ]}
            rows={store.clients.map((c) => {
              const plan = store.membership_plans.find(
                (p) => p.id === c.membership_plan_id
              );
              const coach = store.coaches.find((x) => x.id === c.coach_id);
              const injured = isInjured(c.health);
              const isPrivate = c.private_client === true;
              const rowEditing = listEditId === c.id;
              return {
                id: c.id,
                cells: [
                  c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photo_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-sky-200"
                    />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                      —
                    </span>
                  ),
                  rowEditing ? (
                    <InlineText
                      key="code"
                      value={c.code || ''}
                      placeholder="Code"
                      onSave={(code) => void patchClient(c, { code })}
                      disabled={saving}
                    />
                  ) : (
                    <span key="code" className="font-semibold">
                      {c.code || '—'}
                    </span>
                  ),
                  (
                    <span
                      key="n"
                      className="inline-flex flex-col gap-1 min-w-[8rem]"
                    >
                      {rowEditing ? (
                        <InlineText
                          value={c.name || ''}
                          placeholder="Name"
                          wide
                          onSave={(name) => void patchClient(c, { name })}
                          disabled={saving}
                        />
                      ) : (
                        <span className="font-semibold">{c.name || '—'}</span>
                      )}
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {c.identity?.status === 'verified' ? (
                          <span
                            className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            title={
                              c.identity.verified_name
                                ? `Verified: ${c.identity.verified_name}`
                                : 'Identity verified'
                            }
                          >
                            ✓ ID
                          </span>
                        ) : null}
                        {(c.family || []).filter((m) => m.active !== false)
                          .length > 0 ? (
                          <span
                            className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                            title={(c.family || [])
                              .filter((m) => m.active !== false)
                              .map((m) => m.name)
                              .join(', ')}
                          >
                            +
                            {
                              (c.family || []).filter((m) => m.active !== false)
                                .length
                            }{' '}
                            family
                          </span>
                        ) : null}
                        {c.booking_soft_block ? (
                          <span
                            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-900"
                            title={`${c.no_show_count || 0} no-shows`}
                          >
                            no-show risk
                          </span>
                        ) : null}
                      </span>
                    </span>
                  ),
                  rowEditing ? (
                    <InlineToggleSelect
                      key="type"
                      value={isPrivate}
                      trueLabel="Private client"
                      falseLabel="Gym member"
                      disabled={saving}
                      onSave={(private_client) =>
                        void patchClient(c, { private_client })
                      }
                    />
                  ) : (
                    <span
                      key="type"
                      className={
                        isPrivate
                          ? 'inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200'
                          : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }
                      title={
                        isPrivate
                          ? coach
                            ? `Private client of ${coach.name}`
                            : 'Private client — assign a coach'
                          : 'General gym member'
                      }
                    >
                      {isPrivate ? 'Private client' : 'Gym member'}
                    </span>
                  ),
                  rowEditing ? (
                    <InlineSelect
                      key="plan"
                      value={c.membership_plan_id || ''}
                      emptyLabel="No plan"
                      disabled={saving}
                      options={store.membership_plans.map((p) => ({
                        value: p.id,
                        label: `${p.code} · ${p.name}`,
                      }))}
                      onSave={(membership_plan_id) =>
                        void patchClient(c, {
                          membership_plan_id: membership_plan_id || null,
                        })
                      }
                    />
                  ) : (
                    <span key="plan">{plan?.code || '—'}</span>
                  ),
                  (
                    <span key="ms" className="inline-flex flex-col gap-1">
                      {rowEditing ? (
                        <InlineSelect
                          value={c.membership_status || 'active'}
                          allowEmpty={false}
                          disabled={saving}
                          options={MEMBERSHIP_STATUSES.map((s) => ({
                            value: s,
                            label: s,
                          }))}
                          onSave={(membership_status) =>
                            void patchClient(c, { membership_status })
                          }
                        />
                      ) : (
                        <span>{c.membership_status || '—'}</span>
                      )}
                      <button
                        type="button"
                        className="text-[10px] font-bold text-yellow-700 underline text-left"
                        onClick={() =>
                          void freezeMembership(
                            c,
                            c.membership_status !== 'frozen'
                          )
                        }
                      >
                        {c.membership_status === 'frozen'
                          ? 'Unfreeze'
                          : 'Freeze'}
                      </button>
                    </span>
                  ),
                  ...(store && gymCollectsDebitBank(store)
                    ? [
                        memberDebitBankComplete(c) ? (
                          <span
                            key="bank"
                            className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800"
                          >
                            On file
                          </span>
                        ) : (
                          <span
                            key="bank"
                            className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900"
                          >
                            {gymRequiresDebitBank(store)
                              ? 'Needed'
                              : 'Missing'}
                          </span>
                        ),
                      ]
                    : []),
                  rowEditing ? (
                    <InlineSelect
                      key="coach"
                      value={c.coach_id || ''}
                      emptyLabel={
                        isPrivate ? 'Coach required…' : 'No coach'
                      }
                      disabled={saving}
                      options={store.coaches
                        .filter((x) => x.active !== false)
                        .map((x) => ({
                          value: x.id,
                          label: x.name,
                        }))}
                      onSave={(coach_id) =>
                        void patchClient(c, {
                          coach_id: coach_id || null,
                        })
                      }
                    />
                  ) : (
                    <span
                      key="coach"
                      className={
                        coach
                          ? 'font-semibold text-slate-800 dark:text-slate-100'
                          : isPrivate
                            ? 'text-[11px] font-bold text-amber-700 dark:text-amber-300'
                            : 'text-[11px] text-slate-400'
                      }
                      title={
                        coach
                          ? isPrivate
                            ? `Private coach: ${coach.name}`
                            : `Assigned coach: ${coach.name}`
                          : isPrivate
                            ? 'Private client needs a coach'
                            : 'No coach assigned'
                      }
                    >
                      {coach?.name ||
                        (isPrivate ? 'Coach unassigned' : '—')}
                    </span>
                  ),
                  (
                    <span
                      key="h"
                      className={
                        injured
                          ? 'inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          : 'text-[11px] text-slate-500'
                      }
                      title={c.health?.training_modifications || c.health?.injury_notes || ''}
                    >
                      {healthSummaryLabel(c.health)}
                    </span>
                  ),
                  (
                    <div key="p" className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300"
                        onClick={() => void inviteMember(c)}
                        title="Email invite so they can join as a member and open their portal"
                      >
                        <Mail className="w-3 h-3" />
                        {c.invite_status === 'pending'
                          ? 'Resend invite'
                          : c.invite_status === 'accepted'
                            ? 'Re-invite'
                            : 'Invite'}
                      </button>
                      {c.invite_status ? (
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            c.invite_status === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : c.invite_status === 'pending'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {c.invite_status}
                        </span>
                      ) : null}
                      {c.portal_token ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-700 dark:text-yellow-300"
                          onClick={() => void copyPortal(c.portal_token!)}
                          title="Copy member portal link"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-800 dark:text-yellow-200"
                        onClick={() => void issuePortal(c.id)}
                        title="Issue member portal so they can book open classes"
                      >
                        <Link2 className="w-3 h-3" />
                        {c.portal_token ? 'Re-issue' : 'Issue portal'}
                      </button>
                    </div>
                  ),
                  (
                    <span key="e" className="inline-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          rowEditing
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-sky-700 dark:text-cyan-300'
                        }`}
                        onClick={() =>
                          setListEditId((id) =>
                            id === c.id ? null : c.id
                          )
                        }
                      >
                        <Pencil className="w-3 h-3" />
                        {rowEditing ? 'Done' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                        onClick={() => openEdit(c)}
                        title="Open full profile form"
                      >
                        Profile
                      </button>
                    </span>
                  ),
                ],
              };
            })}
            onDelete={(id) => {
              if (listEditId === id) setListEditId(null);
              void post({ entity: 'clients', action: 'delete', id });
            }}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
