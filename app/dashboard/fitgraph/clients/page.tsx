'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Download, Upload, X } from 'lucide-react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { FormCard, fc } from '@/components/fitness/FitForm';
import { MEMBERSHIP_STATUSES, type FitClient } from '@/lib/fitness/fitgraph';
import {
  gymCollectsDebitBank,
  gymRequiresDebitBank,
} from '@/lib/fitness/member-debit-bank';
import {
  emptyDebitBankForm,
  MemberDebitBankFields,
  type DebitBankForm,
} from '@/components/fitness/MemberDebitBankFields';
import { isInjured } from '@/lib/health/body-map';
import {
  InjuryProfileFields,
  emptyInjuryForm,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';
import { GymMemberProfileDesk } from '@/components/fitness/GymMemberProfileDesk';
import {
  GymClientDeskList,
  type ClientListFilter,
} from '@/components/fitness/GymClientDeskList';
import { AdvisorTreatmentPlanPanel } from '@/components/services/AdvisorTreatmentPlanPanel';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import { DeskUseMyWalletButton } from '@/components/b2c/DeskWalletPatientFields';
import {
  AdvisorIncomingShares,
  AdvisorProfileShare,
} from '@/components/advisors/AdvisorProfileShare';


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
  date_of_birth: string;
  next_of_kin: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
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
  date_of_birth: '',
  next_of_kin: '',
  next_of_kin_phone: '',
  next_of_kin_relationship: '',
  emergency_contact: '',
  notes: '',
  health: emptyInjuryForm(),
  debit_bank: emptyDebitBankForm(),
});

export default function ClientsPage() {
  const { companyId, store, loading, saving, post, load, summary } =
    useFitgraph();
  const search = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<ClientForm>(blankForm);
  const [editing, setEditing] = useState(false);
  /** Row id with list inline editors open (toggle via Edit / Done) */
  const [listEditId, setListEditId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [listFilter, setListFilter] = useState<ClientListFilter>('all');
  const [injuryOpen, setInjuryOpen] = useState(false);

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
      date_of_birth: c.date_of_birth || c.passport?.date_of_birth || '',
      next_of_kin:
        c.next_of_kin || c.passport?.emergency_name || '',
      next_of_kin_phone:
        c.next_of_kin_phone || c.passport?.emergency_phone || '',
      next_of_kin_relationship:
        c.next_of_kin_relationship ||
        c.passport?.emergency_relationship ||
        '',
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
    requestAnimationFrame(() => {
      document
        .getElementById('gym-client-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openId = search.get('open');
  useEffect(() => {
    if (!openId || !store || editing) return;
    const person = store.clients.find((c) => c.id === openId);
    if (person) openEdit(person);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, store]);

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
        date_of_birth: form.date_of_birth || null,
        next_of_kin: form.next_of_kin,
        next_of_kin_phone: form.next_of_kin_phone,
        next_of_kin_relationship: form.next_of_kin_relationship,
        emergency_contact:
          form.emergency_contact ||
          [form.next_of_kin, form.next_of_kin_relationship, form.next_of_kin_phone]
            .filter(Boolean)
            .join(' · '),
        notes: form.notes,
        debit_bank: form.debit_bank.account_number
          ? form.debit_bank
          : undefined,
        ...(editing
          ? {}
          : { health, health_updated_by: 'desk' }),
      },
    });
    toast.success(form.id ? 'Client profile updated' : 'Client saved');
    setForm(blankForm());
    setEditing(false);
    setInjuryOpen(false);
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
  const pickFilter = (next: ClientListFilter) => {
    setListFilter(next);
    setListOpen(true);
  };

  return (
    <FitgraphWorkbench
      title="Clients / members"
      titleAccent="member book"
      description="Member register. Open Profile for birthday, next of kin, PWA passport, join history, monthly statements, ailments, and PBs."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  id: 'all' as const,
                  label: 'Clients',
                  value: Number(summary?.clientCount) || store.clients.length,
                },
                {
                  id: 'active' as const,
                  label: 'Active',
                  value: Number(summary?.activeMembers) || 0,
                },
                {
                  id: 'private' as const,
                  label: 'Private clients',
                  value: privateCount,
                },
                {
                  id: 'injured' as const,
                  label: 'Injured / recovering',
                  value: injuredCount,
                },
              ]
            ).map((item) => {
              const on = listFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickFilter(item.id)}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    on
                      ? 'border-sky-500 bg-sky-100 ring-2 ring-sky-300 dark:border-cyan-400 dark:bg-cyan-900'
                      : 'border-cyan-200 bg-white dark:border-cyan-400 dark:bg-cyan-950'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-wide text-sky-700/80 dark:text-cyan-300/80">
                    {item.label}
                  </div>
                  <div className="text-xl font-black tabular-nums text-slate-900 dark:text-cyan-50">
                    {item.value}
                  </div>
                </button>
              );
            })}
          </div>

          <GymClientDeskList
            clients={store.clients}
            plans={store.membership_plans}
            coaches={store.coaches}
            collectBank={gymCollectsDebitBank(store)}
            requireBank={gymRequiresDebitBank(store)}
            saving={saving}
            listEditId={listEditId}
            setListEditId={setListEditId}
            filter={listFilter}
            onFilter={pickFilter}
            open={listOpen}
            onOpenChange={setListOpen}
            onPatch={(client, patch) => void patchClient(client, patch)}
            onFreeze={(c, freeze) => void freezeMembership(c, freeze)}
            onInvite={(c) => void inviteMember(c)}
            onCopyPortal={(tok) => void copyPortal(tok)}
            onIssuePortal={(id) => void issuePortal(id)}
            onProfile={openEdit}
            onDelete={(c) => {
              if (!confirm(`Remove ${c.name || 'this member'} from the book?`)) {
                return;
              }
              if (listEditId === c.id) setListEditId(null);
              void post({ entity: 'clients', action: 'delete', id: c.id });
            }}
            toolbar={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => downloadXlsx('clients_template')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Template
                </button>
                <button
                  type="button"
                  disabled={importing || saving}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
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
            }
          />

          <div id="gym-client-form">
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
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Membership start
              <input
                className={fc() + ' mt-1'}
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Birthday
              <input
                className={fc() + ' mt-1'}
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date_of_birth: e.target.value }))
                }
              />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Next of kin
              <input
                className={fc() + ' mt-1'}
                placeholder="Name"
                value={form.next_of_kin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, next_of_kin: e.target.value }))
                }
              />
            </label>
            <input
              className={fc()}
              placeholder="Next of kin phone"
              value={form.next_of_kin_phone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  next_of_kin_phone: e.target.value,
                }))
              }
            />
            <input
              className={fc()}
              placeholder="Relationship (spouse, parent…)"
              value={form.next_of_kin_relationship}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  next_of_kin_relationship: e.target.value,
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

            {!editing ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={() => setInjuryOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/70 px-3 py-2.5 text-left dark:border-teal-800 dark:bg-teal-950/40"
                  aria-expanded={injuryOpen}
                >
                  <span>
                    <span className="flex items-center gap-2 text-sm font-black text-teal-950 dark:text-teal-100">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          injuryOpen ? '' : '-rotate-90'
                        }`}
                      />
                      Injury & recovery
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {form.health.injured
                        ? 'Injured / managing an ailment — open to edit details'
                        : 'Closed by default. Open only if this member needs session modifications.'}
                    </span>
                  </span>
                </button>
                {injuryOpen ? (
                  <div className="mt-2">
                    <InjuryProfileFields
                      variant="coach"
                      value={form.health}
                      onChange={(health) =>
                        setForm((f) => ({ ...f, health }))
                      }
                      inputClass={fc()}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </FormCard>
          </div>

          {editing && form.id
            ? store.clients
                .filter((x) => x.id === form.id)
                .map((person) => (
                  <GymMemberProfileDesk
                    key={person.id}
                    client={person}
                    store={store}
                    post={post}
                    saving={saving}
                    onRefresh={() => {
                      void load();
                    }}
                  />
                ))
            : null}

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

          <AdvisorIncomingShares companyId={companyId} />
          <AdvisorMemberAppInvite
            kind="gym"
            companyId={companyId}
            brand={store.settings?.brand_name}
            audience="members"
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
