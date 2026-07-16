'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  Save,
  UserPlus,
  Building2,
  MapPin,
  Banknote,
  ArrowRight,
  Users,
  FileText,
  Handshake,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { LEAD_SOURCES } from '@/lib/customers/types';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';
import {
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';

const PROCESS = [
  { label: 'Lead', href: '/dashboard/customers/leads' },
  { label: 'Onboard', href: '/dashboard/customers/onboard' },
  { label: 'Invite', href: '/dashboard/customers/invites' },
  { label: 'Quote', href: '/dashboard/customers/quotes' },
  { label: 'Order', href: '/dashboard/customers/orders' },
  { label: 'Invoice', href: '/dashboard/customers/invoices' },
];

type FormState = {
  trading_name: string;
  legal_name: string;
  contact_name: string;
  job_title: string;
  email: string;
  phone: string;
  customer_type: string;
  status: string;
  website: string;
  industry: string;
  vat_number: string;
  registration_number: string;
  billing_address: string;
  shipping_address: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  currency: string;
  payment_terms: string;
  credit_limit: string;
  source: string;
  owner_name: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  trading_name: '',
  legal_name: '',
  contact_name: '',
  job_title: '',
  email: '',
  phone: '',
  customer_type: 'business',
  status: 'active',
  website: '',
  industry: '',
  vat_number: '',
  registration_number: '',
  billing_address: '',
  shipping_address: '',
  city: '',
  region: '',
  country: '',
  postal_code: '',
  currency: 'ZAR',
  payment_terms: 'Net 30',
  credit_limit: '0',
  source: '',
  owner_name: '',
  notes: '',
});

export default function OnboardCustomerPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <CustomersPage>
            <div className="py-24 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          </CustomersPage>
        }
      >
        <OnboardInner />
      </Suspense>
    </CompanyRequired>
  );
}

function OnboardInner() {
  const companyId = getSelectedCompanyId()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [createdCustomer, setCreatedCustomer] = useState<{
    id: number;
    trading_name: string;
    email?: string | null;
    contact_name?: string | null;
  } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const load = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?companyId=${companyId}`);
      const data = await res.json();
      const c = (data.customers || []).find(
        (x: { id: number }) => String(x.id) === editId
      );
      if (!c) {
        toast.error('Customer not found');
        return;
      }
      setForm({
        trading_name: c.trading_name || '',
        legal_name: c.legal_name || '',
        contact_name: c.contact_name || '',
        job_title: c.job_title || '',
        email: c.email || '',
        phone: c.phone || '',
        customer_type: c.customer_type || 'business',
        status: c.status || 'active',
        website: c.website || '',
        industry: c.industry || '',
        vat_number: c.vat_number || '',
        registration_number: c.registration_number || '',
        billing_address: c.billing_address || '',
        shipping_address: c.shipping_address || '',
        city: c.city || '',
        region: c.region || '',
        country: c.country || '',
        postal_code: c.postal_code || '',
        currency: c.currency || 'ZAR',
        payment_terms: c.payment_terms || 'Net 30',
        credit_limit: String(c.credit_limit ?? 0),
        source: c.source || '',
        owner_name: c.owner_name || '',
        notes: c.notes || '',
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, editId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        privyUserId: privyUserId || undefined,
        ...form,
        credit_limit: Number(form.credit_limit) || 0,
      };
      const res = await fetch('/api/customers', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { id: Number(editId), ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success(editId ? 'Customer updated' : 'Customer onboarded');
      if (editId) {
        router.push('/dashboard/customers/profiles');
      } else if (data.customer?.id) {
        setCreatedCustomer({
          id: data.customer.id,
          trading_name: data.customer.trading_name || form.trading_name,
          email: data.customer.email || form.email || null,
          contact_name: data.customer.contact_name || form.contact_name || null,
        });
      } else {
        router.push('/dashboard/customers/profiles');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CustomersPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </CustomersPage>
    );
  }

  if (createdCustomer) {
    return (
      <CustomersPage>
        <CustomersHeader
          title="Customer"
          titleAccent="created"
          description="Offline CRM profile is ready. Optionally invite them onto the platform so you can share docs and trade on a connected edge."
        />

        <div className="max-w-2xl">
          <Panel>
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex gap-3 items-start">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="font-bold text-lg text-slate-800">
                    {createdCustomer.trading_name}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                    Quotes, orders, and invoices work offline. A platform invite is optional —
                    connect when you want shared documents and network collaboration.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#00b4d8]/20 bg-[#00b4d8]/5 p-4">
                <InviteCustomerButton
                  customerId={createdCustomer.id}
                  customerName={createdCustomer.trading_name}
                  defaultEmail={createdCustomer.email || ''}
                  defaultContactName={createdCustomer.contact_name || ''}
                  defaultOpen
                  variant="primary"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                <Link
                  href="/dashboard/customers/profiles"
                  className="btn-primary !py-2.5 !px-5 text-sm"
                >
                  Go to profiles <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/dashboard/customers/invites"
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  <Handshake className="w-4 h-4" /> View invites
                </Link>
                <Link
                  href="/dashboard/customers/quotes"
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  <FileText className="w-4 h-4" /> Create quote
                </Link>
                <button
                  type="button"
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                  onClick={() => {
                    setCreatedCustomer(null);
                    setForm(emptyForm());
                  }}
                >
                  <UserPlus className="w-4 h-4" /> Add another
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </CustomersPage>
    );
  }

  return (
    <CustomersPage>
      <CustomersHeader
        title={editId ? 'Edit' : 'Onboard'}
        titleAccent="customer"
        description="Create a full customer account with commercial and contact details. Invite to the platform after save when you are ready to connect."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> {editId ? 'Save changes' : 'Create customer'}
              </>
            )}
          </button>
        }
      />

      {!editId && (
        <>
        </>
      )}

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        <div className="lg:col-span-3 space-y-4">
          <Panel title="Identity">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                <Building2 className="w-3.5 h-3.5 text-[#00b4d8]" />
                Company identity on your CRM book
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Trading name *"
                  value={form.trading_name}
                  onChange={(v) => set('trading_name', v)}
                />
                <Field
                  label="Legal name"
                  value={form.legal_name}
                  onChange={(v) => set('legal_name', v)}
                />
                <div>
                  <Label>Customer type</Label>
                  <select
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.customer_type}
                    onChange={(e) => set('customer_type', e.target.value)}
                  >
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                    <option value="government">Government</option>
                    <option value="ngo">NGO</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="prospect">Prospect</option>
                    <option value="on_hold">On hold</option>
                  </select>
                </div>
                <Field
                  label="Industry"
                  value={form.industry}
                  onChange={(v) => set('industry', v)}
                />
                <Field
                  label="Website"
                  value={form.website}
                  onChange={(v) => set('website', v)}
                />
                <Field
                  label="VAT number"
                  value={form.vat_number}
                  onChange={(v) => set('vat_number', v)}
                />
                <Field
                  label="Registration no."
                  value={form.registration_number}
                  onChange={(v) => set('registration_number', v)}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Primary contact">
            <div className="p-5">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Contact name"
                  value={form.contact_name}
                  onChange={(v) => set('contact_name', v)}
                />
                <Field
                  label="Job title"
                  value={form.job_title}
                  onChange={(v) => set('job_title', v)}
                />
                <Field
                  label="Email"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  type="email"
                />
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Addresses">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#00b4d8]" />
                Billing & shipping
              </div>
              <Field
                label="Billing address"
                value={form.billing_address}
                onChange={(v) => set('billing_address', v)}
                multiline
              />
              <Field
                label="Shipping address"
                value={form.shipping_address}
                onChange={(v) => set('shipping_address', v)}
                multiline
              />
              <GeoSelectFields
                compact
                countryRequired={false}
                value={{
                  continent: '',
                  country: form.country || '',
                  province: form.region || '',
                  city: form.city || '',
                }}
                onChange={(g: GeoValue) => {
                  setForm((prev) => ({
                    ...prev,
                    country: g.country,
                    region: g.province,
                    city: g.city,
                  }));
                }}
              />
              <Field
                label="Postal code"
                value={form.postal_code}
                onChange={(v) => set('postal_code', v)}
              />
            </div>
          </Panel>

          <Panel title="Commercial terms">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                <Banknote className="w-3.5 h-3.5 text-[#00b4d8]" />
                Credit & payment defaults
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="Currency"
                  value={form.currency}
                  onChange={(v) => set('currency', v)}
                />
                <Field
                  label="Payment terms"
                  value={form.payment_terms}
                  onChange={(v) => set('payment_terms', v)}
                />
                <Field
                  label="Credit limit"
                  value={form.credit_limit}
                  onChange={(v) => set('credit_limit', v)}
                  type="number"
                />
                <div>
                  <Label>Source</Label>
                  <select
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.source}
                    onChange={(e) => set('source', e.target.value)}
                  >
                    <option value="">—</option>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Account owner"
                  value={form.owner_name}
                  onChange={(v) => set('owner_name', v)}
                />
              </div>
              <Field
                label="Notes"
                value={form.notes}
                onChange={(v) => set('notes', v)}
                multiline
              />
            </div>
          </Panel>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary w-full !py-3.5 text-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editId ? (
              <>
                <Save className="w-4 h-4" /> Save changes
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create customer
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Panel title="How onboarding works">
            <div className="p-5 space-y-4">
              {[
                {
                  n: '01',
                  title: 'CRM profile first',
                  body: 'Trading name, contacts, and commercial terms live on your customers book — works fully offline.',
                },
                {
                  n: '02',
                  title: 'Optional platform invite',
                  body: 'After save, invite them to claim SupplierAdvisor and connect as a buyer edge.',
                },
                {
                  n: '03',
                  title: 'Sell with confidence',
                  body: 'Quotes → orders → invoices, loyalty, reviews, and RIAD attach to this account.',
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-3">
                  <span className="text-[10px] font-black tracking-[0.16em] text-[#00b4d8] mt-0.5">
                    {s.n}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                    <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="rounded-3xl border border-[#00b4d8]/20 bg-gradient-to-br from-white to-[#00b4d8]/[0.06] p-5">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  From a lead?
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Capture demand in Pipeline first, then convert here when the account is real.
                </p>
                <Link
                  href="/dashboard/customers/leads"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00b4d8] mt-2"
                >
                  Open pipeline <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <Panel title="Related">
            <div className="p-3 space-y-1">
              <SideLink
                href="/dashboard/customers/profiles"
                label="Customer profiles"
                desc="Search and manage the book"
              />
              <SideLink
                href="/dashboard/customers/invites"
                label="Platform invites"
                desc="Connect buyers on-platform"
              />
              <SideLink
                href="/dashboard/connections"
                label="Network connections"
                desc="Accepted trade edges"
              />
            </div>
          </Panel>
        </div>
      </div>
    </CustomersPage>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {multiline ? (
        <textarea
          className="input mt-1 w-full !p-3 !text-sm min-h-[72px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="input mt-1 w-full !p-3 !text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function SideLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[#00b4d8]/5 transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800 group-hover:text-[#0077b6]">
          {label}
        </div>
        <div className="text-[11px] text-neutral-500">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8]" />
    </Link>
  );
}
