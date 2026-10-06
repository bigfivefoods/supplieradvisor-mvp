'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
  Globe,
  FileText,
  Receipt,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  canInviteCustomer,
  customerInviteActionLabel,
  customerInviteStatusClass,
  customerInviteStatusLabel,
  resolveCustomerConnectionPhase,
  type CustomerRecord,
} from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';
import { AccountLogoField } from '@/components/relationship/AccountLogoField';
import type { PartyRoleRow } from '@/lib/accounting/party-roles';
import { glCodeFromMeta } from '@/lib/accounting/party-roles';
import { PartyBookRoleSelect } from '@/components/accounting/PartyBookRoleSelect';
import { HostCommercial } from '@/components/commercial/CommercialPanel';
import { CURRENCIES, DEFAULT_PAYMENT_TERMS_OPTIONS } from '@/lib/business/types';

export default function CustomerProfilesPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <CustomersPage>
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
            </div>
          </CustomersPage>
        }
      >
        <ProfilesInner />
      </Suspense>
    </CompanyRequired>
  );
}

function ProfilesInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = Number(searchParams.get('id') || 0);
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isFinite(urlId) && urlId > 0 ? urlId : null
  );
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [inviteOpenId, setInviteOpenId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [partyByCustomer, setPartyByCustomer] = useState<
    Record<number, PartyRoleRow>
  >({});
  const [commercialId, setCommercialId] = useState<number | null>(null);
  const [bookHold, setBookHold] = useState<CustomerRecord | null>(null);
  const [bookMiss, setBookMiss] = useState(false);

  useEffect(() => {
    if (Number.isFinite(urlId) && urlId > 0) setSelectedId(urlId);
  }, [urlId]);

  const selectCustomer = (id: number | null) => {
    setBookHold(null);
    setBookMiss(false);
    setSelectedId(id);
    if (id !== commercialId) setCommercialId(null);
    const next = new URLSearchParams(searchParams.toString());
    if (id && id > 0) next.set('id', String(id));
    else next.delete('id');
    const qs = next.toString();
    router.replace(`/dashboard/customers/profiles${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
      try {
        const partyRes = await fetch(
          `/api/accounting/parties?companyId=${companyId}`
        );
        const partyData = await partyRes.json();
        const idx: Record<number, PartyRoleRow> = {};
        for (const row of (partyData.parties || []) as PartyRoleRow[]) {
          if (row.customer_id) idx[row.customer_id] = row;
        }
        setPartyByCustomer(idx);
      } catch {
        setPartyByCustomer({});
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, q, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setBookMiss(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/customers?companyId=${companyId}&id=${selectedId}`
        );
        const data = await res.json();
        const found = ((data.customers || []) as CustomerRecord[])[0];
        if (cancelled) return;
        if (data.book && found && Number(found.id) === selectedId) setBookHold(found);
        else setBookMiss(true);
      } catch {
        if (!cancelled) setBookMiss(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedId]);

  const issuePortal = async (c: CustomerRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setActionId(c.id);
    try {
      const res = await fetch('/api/portals/trade/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind: 'customer',
          action: 'issue_account',
          customer_id: c.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not issue portal');
      if (data.url) {
        try {
          await navigator.clipboard.writeText(String(data.url));
        } catch {
          /* ignore */
        }
      }
      toast.success(
        data.existing
          ? 'Portal already live — link copied'
          : data.emailSent
            ? 'Customer portal issued — email sent, link copied'
            : 'Customer portal issued — link copied'
      );
      if (data.warning) toast.message(data.warning);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this customer?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    } else {
      const d = await res.json();
      toast.error(d.error || 'Failed');
    }
  };

  const clearCreditHold = async (c: CustomerRecord) => {
    const reset = confirm(
      `Clear credit hold for ${c.trading_name}? OK = clear hold only. Cancel = abort.\n\nAfter OK you can choose to also reset override counter.`
    );
    if (!reset) return;
    const resetOverrides = confirm('Also reset override counter to zero?');
    setActionId(c.id);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          companyId,
          privyUserId,
          action: 'clear_credit_hold',
          resetOverrides,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Credit hold cleared');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const inviteCustomersWithEmail = async () => {
    const withEmail = customers.filter(
      (c) => (c.email || c.invited_email || '').includes('@')
    );
    if (!withEmail.length) {
      toast.message('No customers with email in this list');
      return;
    }
    const ok = confirm(
      `Invite ${withEmail.length} customer(s) with email via SupplierAdvisor invite emails?`
    );
    if (!ok) return;
    setActionId(-1);
    try {
      const emails = withEmail
        .map((c) => String(c.email || c.invited_email || '').toLowerCase())
        .filter((e) => e.includes('@'));
      const res = await fetch('/api/business/network-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bulk_from_emails',
          emails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(`Sent ${data.sent || 0} invite(s)`, {
        description: data.failed?.length
          ? `${data.failed.length} failed`
          : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionId(null);
    }
  };

  const setSuspended = async (c: CustomerRecord, suspend: boolean) => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    const label = suspend ? 'Suspend' : 'Unsuspend';
    if (
      !confirm(
        suspend
          ? `Suspend platform collaboration with ${c.trading_name}? They keep historical access; new POs and shares are blocked.`
          : `Restore platform collaboration with ${c.trading_name}?`
      )
    ) {
      return;
    }
    setActionId(c.id);
    try {
      const res = await fetch(
        suspend ? '/api/customers/invites/suspend' : '/api/customers/invites/unsuspend',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            customerId: c.id,
            privyUserId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${label} failed`);
      toast.success(data.message || (suspend ? 'Suspended' : 'Unsuspended'));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActionId(null);
    }
  };

  const listRow = customers.find((c) => c.id === selectedId) || null;
  const selected =
    bookHold && bookHold.id === selectedId
      ? { ...(listRow || {}), ...bookHold }
      : listRow;
  const bookReady = Boolean(bookHold && selected && bookHold.id === selected.id);

  const mergeSaved = (saved: CustomerRecord) => {
    setBookHold(saved);
    setCustomers((prev) =>
      prev.map((row) => (row.id === saved.id ? { ...row, ...saved } : row))
    );
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer book"
        description="One customer record. Save it here and quotes, orders, and invoices use that same row."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void inviteCustomersWithEmail()}
              disabled={actionId === -1}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              {actionId === -1 ? 'Inviting…' : 'Invite all with email'}
            </button>
            <Link
              href="/dashboard/customers/invites"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              Invites
            </Link>
            <Link
              href="/dashboard/network-invites"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Invite CRM
            </Link>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add customer
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !pl-9 !py-2.5 !text-sm"
            placeholder="Search name, email, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input !py-2.5 !px-3 !text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="prospect">Prospect</option>
          <option value="on_hold">On hold</option>
        </select>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white lg:order-1">
        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center text-neutral-500">
            <Users className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
            <p className="mb-4">No customers yet. Onboard your first account.</p>
            <Link href="/dashboard/customers/onboard" className="btn-primary !py-2.5 !px-5 text-sm">
              Add customer
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {customers.map((c) => {
              const isSelected = selectedId === c.id;
              const held =
                String(c.notes || '').includes('[credit hold]') ||
                String(c.status || '').toLowerCase() === 'credit_hold';
              return (
                <li
                  key={c.id}
                  className={`flex items-start gap-3 px-4 py-3.5 ${
                    isSelected ? 'bg-sky-50/80' : ''
                  }`}
                >
                    <AccountLogoField
                      companyId={companyId}
                      privyUserId={privyUserId}
                      kind="customer"
                      recordId={c.id}
                      logoUrl={c.logo_url}
                      name={c.trading_name}
                      size="sm"
                      compact
                      onChange={(url) => {
                        setCustomers((prev) =>
                          prev.map((row) =>
                            row.id === c.id ? { ...row, logo_url: url } : row
                          )
                        );
                        setBookHold((prev) =>
                          prev && prev.id === c.id ? { ...prev, logo_url: url } : prev
                        );
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => selectCustomer(isSelected ? null : c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{c.trading_name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerStatusClass(c.status)}`}
                        >
                          {(c.status || 'active').replace(/_/g, ' ')}
                        </span>
                        {held ? (
                          <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
                            Credit hold
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {[c.contact_name, c.city, c.country].filter(Boolean).join(' · ') ||
                          c.legal_name ||
                          c.industry ||
                          '—'}
                      </span>
                    </button>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerInviteStatusClass(c.invite_status, c.linked_profile_id)}`}
                    >
                      {customerInviteStatusLabel(c.invite_status, c.linked_profile_id)}
                    </span>
                </li>
              );
            })}
          </ul>
        )}
        </div>

        <div className="order-first lg:sticky lg:top-24 lg:order-2">
          {selected ? (
            <CustomerAccountPanel
              customer={selected}
              companyId={companyId}
              privyUserId={privyUserId}
              party={partyByCustomer[selected.id]}
              busy={actionId === selected.id}
              inviting={inviteOpenId === selected.id}
              commercialOpen={commercialId === selected.id}
              bookReady={bookReady}
              bookMiss={bookMiss}
              onClose={() => selectCustomer(null)}
              onSaved={mergeSaved}
              onChanged={() => void load()}
              onToggleCommercial={() =>
                setCommercialId((cur) => (cur === selected.id ? null : selected.id))
              }
              onInvite={() => setInviteOpenId(selected.id)}
              onCancelInvite={() => setInviteOpenId(null)}
              onInvited={() => {
                setInviteOpenId(null);
                void load();
              }}
              onPortal={() => void issuePortal(selected)}
              onSuspend={(suspend) => void setSuspended(selected, suspend)}
              onClearHold={() => void clearCreditHold(selected)}
              onDelete={() => void remove(selected.id)}
            />
          ) : (
            <div className="hidden rounded-[1.5rem] border border-dashed border-neutral-200 bg-white/70 px-5 py-10 text-center text-sm text-neutral-500 lg:block">
              Select a customer to see the account, credit, and the next quote or invoice.
            </div>
          )}
        </div>
      </div>
    </CustomersPage>
  );
}

function customerStatusClass(status?: string | null) {
  const s = (status || 'active').toLowerCase();
  if (s === 'on_hold' || s === 'credit_hold') return 'bg-rose-50 text-rose-800';
  if (s === 'inactive') return 'bg-neutral-100 text-neutral-600';
  if (s === 'prospect') return 'bg-amber-50 text-amber-900';
  return 'bg-emerald-50 text-emerald-800';
}

type BookForm = {
  trading_name: string;
  legal_name: string;
  contact_name: string;
  email: string;
  phone: string;
  customer_type: string;
  status: string;
  industry: string;
  vat_number: string;
  billing_address: string;
  city: string;
  country: string;
  currency: string;
  payment_terms: string;
  credit_limit: string;
};

function bookFormFrom(c: CustomerRecord): BookForm {
  return {
    trading_name: c.trading_name || '',
    legal_name: c.legal_name || '',
    contact_name: c.contact_name || '',
    email: c.email || '',
    phone: c.phone || '',
    customer_type: c.customer_type || 'business',
    status: c.status || 'active',
    industry: c.industry || '',
    vat_number: c.vat_number || '',
    billing_address: c.billing_address || '',
    city: c.city || '',
    country: c.country || '',
    currency: c.currency || 'ZAR',
    payment_terms: c.payment_terms || 'Net 30',
    credit_limit:
      c.credit_limit != null && Number(c.credit_limit) > 0
        ? String(c.credit_limit)
        : '',
  };
}

const STATUS_OPTIONS = ['active', 'prospect', 'inactive', 'on_hold'];

function CustomerAccountPanel({
  customer: c,
  companyId,
  privyUserId,
  party,
  busy,
  inviting,
  commercialOpen,
  bookReady,
  bookMiss,
  onClose,
  onSaved,
  onChanged,
  onToggleCommercial,
  onInvite,
  onCancelInvite,
  onInvited,
  onPortal,
  onSuspend,
  onClearHold,
  onDelete,
}: {
  customer: CustomerRecord;
  companyId: number;
  privyUserId: string | null;
  party?: PartyRoleRow;
  busy: boolean;
  inviting: boolean;
  commercialOpen: boolean;
  bookReady: boolean;
  bookMiss: boolean;
  onClose: () => void;
  onSaved: (customer: CustomerRecord) => void;
  onChanged: () => void;
  onToggleCommercial: () => void;
  onInvite: () => void;
  onCancelInvite: () => void;
  onInvited: () => void;
  onPortal: () => void;
  onSuspend: (suspend: boolean) => void;
  onClearHold: () => void;
  onDelete: () => void;
}) {
  const phase = resolveCustomerConnectionPhase(c);
  const held =
    String(c.notes || '').includes('[credit hold]') ||
    String(c.status || '').toLowerCase() === 'credit_hold';
  const [form, setForm] = useState<BookForm>(() => bookFormFrom(c));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bookReady) return;
    setForm(bookFormFrom(c));
  }, [bookReady, c.id, c.updated_at]);

  const set = (key: keyof BookForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    if (form.credit_limit.trim() && !Number.isFinite(Number(form.credit_limit))) {
      toast.error('Credit limit must be a number');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          companyId,
          privyUserId: privyUserId || undefined,
          trading_name: form.trading_name.trim(),
          legal_name: form.legal_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          customer_type: form.customer_type,
          ...(held ? {} : { status: form.status }),
          industry: form.industry,
          vat_number: form.vat_number,
          billing_address: form.billing_address,
          city: form.city,
          country: form.country,
          currency: form.currency,
          payment_terms: form.payment_terms,
          credit_limit: form.credit_limit.trim() === '' ? null : Number(form.credit_limit),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const saved = (data.customer || null) as CustomerRecord | null;
      toast.success('Saved to the customer book');
      onSaved(saved && saved.id ? saved : { ...c, ...form, credit_limit: numericCredit(form.credit_limit) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const terms = form.payment_terms &&
    !(DEFAULT_PAYMENT_TERMS_OPTIONS as readonly string[]).includes(form.payment_terms)
    ? [form.payment_terms, ...DEFAULT_PAYMENT_TERMS_OPTIONS]
    : [...DEFAULT_PAYMENT_TERMS_OPTIONS];
  const currencies = (CURRENCIES as readonly string[]).includes(form.currency)
    ? CURRENCIES
    : [form.currency, ...CURRENCIES];
  const statuses = STATUS_OPTIONS.includes(form.status)
    ? STATUS_OPTIONS
    : [form.status, ...STATUS_OPTIONS];

  return (
    <aside className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[1.5rem] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6]">
            Account
          </p>
          <h2 className="truncate text-lg font-black tracking-tight text-slate-900">
            {form.trading_name || c.trading_name}
          </h2>
          <p className="text-xs text-neutral-500">
            One database record. Quotes and invoices copy the terms and currency saved here.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-neutral-500 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerStatusClass(c.status)}`}>
          {(c.status || 'active').replace(/_/g, ' ')}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${customerInviteStatusClass(c.invite_status, c.linked_profile_id)}`}
        >
          {customerInviteStatusLabel(c.invite_status, c.linked_profile_id)}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
          {(c.customer_type || 'business').replace(/_/g, ' ')}
        </span>
      </div>

      {bookReady ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <BookField label="Trading name *">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.trading_name}
              onChange={(e) => set('trading_name', e.target.value)}
            />
          </BookField>
          <BookField label="Legal name">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.legal_name}
              onChange={(e) => set('legal_name', e.target.value)}
            />
          </BookField>
          <BookField label="Contact">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
            />
          </BookField>
          <BookField label="Email">
            <input
              type="email"
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </BookField>
          <BookField label="Phone">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </BookField>
          <BookField label="Type">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.customer_type}
              onChange={(e) => set('customer_type', e.target.value)}
            >
              <option value="business">Business</option>
              <option value="individual">Individual</option>
              <option value="government">Government</option>
              <option value="ngo">NGO</option>
            </select>
          </BookField>
          {held ? (
            <BookField label="Status">
              <p className="mt-1 text-sm font-semibold normal-case tracking-normal text-rose-800">
                Credit hold. Press Clear to lift it.
              </p>
            </BookField>
          ) : (
            <BookField label="Status">
              <select
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </BookField>
          )}
          <BookField label="City">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
          </BookField>
          <BookField label="Country">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
            />
          </BookField>
          <BookField label="Payment terms">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.payment_terms}
              onChange={(e) => set('payment_terms', e.target.value)}
            >
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </BookField>
          <BookField label="Currency">
            <select
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {currencies.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </BookField>
          <BookField label="Credit limit">
            <input
              inputMode="decimal"
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.credit_limit}
              placeholder="No limit"
              onChange={(e) => set('credit_limit', e.target.value)}
            />
          </BookField>
          <BookField label="VAT number">
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.vat_number}
              onChange={(e) => set('vat_number', e.target.value)}
            />
          </BookField>
          <BookField label="Industry" wide>
            <input
              className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.industry}
              onChange={(e) => set('industry', e.target.value)}
            />
          </BookField>
          <BookField label="Billing address" wide>
            <textarea
              className="input mt-0.5 min-h-[64px] w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
              value={form.billing_address}
              onChange={(e) => set('billing_address', e.target.value)}
            />
          </BookField>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save to customer book
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <Fact label="Contact" value={c.contact_name} />
          <Fact label="Email" value={c.email} />
          <Fact label="Phone" value={c.phone} />
          <Fact label="Location" value={[c.city, c.country].filter(Boolean).join(', ')} />
          <Fact label="Terms" value={c.payment_terms} />
          <p className="text-xs text-neutral-500">
            {bookMiss
              ? 'The saved record did not load. Use Full record to edit it.'
              : 'Loading the saved record…'}
          </p>
        </dl>
      )}

      {held ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
          <span className="text-xs font-bold text-rose-800">Credit hold</span>
          <button
            type="button"
            onClick={onClearHold}
            className="text-xs font-bold text-[#0077b6] hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <PartyBookRoleSelect
          companyId={companyId}
          customerId={c.id}
          supplierId={party?.supplier_id}
          role={party?.role || 'customer'}
          arCode={party?.ar_account_code || glCodeFromMeta(c.metadata)}
          apCode={party?.ap_account_code}
          compact
          onChanged={onChanged}
        />
        {party?.supplier_id ? (
          <Link
            href={`/dashboard/suppliers/network?id=${party.supplier_id}`}
            className="mt-1 inline-flex text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            Open supplier book
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/customers/onboard?id=${c.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <Pencil className="h-3.5 w-3.5" /> Full record
        </Link>
        <Link
          href={`/dashboard/customers/quotes?customerId=${c.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <FileText className="h-3.5 w-3.5" /> Quote
        </Link>
        <Link
          href={`/dashboard/customers/invoices?customerId=${c.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          <Receipt className="h-3.5 w-3.5" /> Invoice
        </Link>
        <Link
          href="/dashboard/customers/360"
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-[#00b4d8]/40 hover:text-[#0077b6]"
        >
          360
        </Link>
        <button
          type="button"
          onClick={onToggleCommercial}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#00b4d8]/30 bg-[#00b4d8]/10 px-3 py-1.5 text-xs font-semibold text-[#0077b6]"
        >
          {commercialOpen ? 'Hide commercial' : 'Commercial'}
        </button>
        {canInviteCustomer(c) && !inviting ? (
          <button
            type="button"
            onClick={onInvite}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#00b4d8] bg-[#00b4d8] px-3 py-1.5 text-xs font-semibold text-white"
          >
            {customerInviteActionLabel(c)}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || !privyUserId}
          onClick={onPortal}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-[#0077b6] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          Portal
        </button>
        {phase === 'accepted' ? (
          <button
            type="button"
            disabled={busy || !privyUserId}
            onClick={() => onSuspend(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"
          >
            <PauseCircle className="h-3.5 w-3.5" /> Suspend
          </button>
        ) : null}
        {phase === 'suspended' ? (
          <button
            type="button"
            disabled={busy || !privyUserId}
            onClick={() => onSuspend(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" /> Restore
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      {inviting && canInviteCustomer(c) ? (
        <div className="mt-3">
          <InviteCustomerButton
            key={c.id}
            customerId={c.id}
            customerName={c.trading_name}
            defaultEmail={c.email || c.invited_email || ''}
            defaultContactName={c.contact_name || ''}
            defaultOpen
            resend={
              c.invite_status === 'invited' ||
              c.invite_status === 'declined' ||
              c.invite_status === 'expired'
            }
            onCancel={onCancelInvite}
            onSent={onInvited}
          />
        </div>
      ) : null}

      {commercialOpen ? (
        <div className="mt-4">
          <HostCommercial
            companyId={companyId}
            partyKind="customer"
            customerId={c.id}
            partyName={c.trading_name || 'Customer'}
          />
        </div>
      ) : null}
    </aside>
  );
}

function numericCredit(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function BookField({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label
      className={`block text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      {label}
      {children}
    </label>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="truncate text-right text-slate-800">{value || '—'}</dd>
    </div>
  );
}
