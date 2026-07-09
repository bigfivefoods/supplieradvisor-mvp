'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { LEAD_SOURCES } from '@/lib/customers/types';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import InviteCustomerButton from '@/components/customers/InviteCustomerButton';

export default function OnboardCustomerPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  /** After create: optional platform invite before navigating away. */
  const [createdCustomer, setCreatedCustomer] = useState<{
    id: number;
    trading_name: string;
    email?: string | null;
    contact_name?: string | null;
  } | null>(null);
  const [form, setForm] = useState({
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

  const load = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?companyId=${companyId}`);
      const data = await res.json();
      const c = (data.customers || []).find((x: { id: number }) => String(x.id) === editId);
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
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (createdCustomer) {
    return (
      <div className="px-2 md:px-4 max-w-3xl mx-auto pb-12">
        <CustomersHeader
          title="Customer created"
          description="Optional: invite them onto the platform. You can skip and invite later from Profiles or Invites."
        />
        <div className="bg-white border rounded-3xl p-6 space-y-5">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-bold text-lg text-slate-900">{createdCustomer.trading_name}</div>
              <p className="text-sm text-neutral-600 mt-1">
                Offline CRM profile is ready. Platform connection is optional — quotes, orders, and
                invoices work without an invite.
              </p>
            </div>
          </div>

          <InviteCustomerButton
            customerId={createdCustomer.id}
            customerName={createdCustomer.trading_name}
            defaultEmail={createdCustomer.email || ''}
            defaultContactName={createdCustomer.contact_name || ''}
            defaultOpen
            variant="primary"
          />

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Link
              href="/dashboard/customers/profiles"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              Go to profiles
            </Link>
            <Link
              href="/dashboard/customers/invites"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              View invites
            </Link>
            <button
              type="button"
              className="btn-secondary !py-2.5 !px-5 text-sm"
              onClick={() => {
                setCreatedCustomer(null);
                setForm((f) => ({
                  ...f,
                  trading_name: '',
                  legal_name: '',
                  contact_name: '',
                  email: '',
                  phone: '',
                  notes: '',
                }));
              }}
            >
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-3xl mx-auto pb-12">
      <CustomersHeader
        title={editId ? 'Edit customer' : 'Onboard customer'}
        description="Create a full customer account with commercial and contact details. You can invite them to the platform after save."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
          </button>
        }
      />

      <div className="bg-white border rounded-3xl p-6 space-y-4">
        <Section title="Identity">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Trading name *" value={form.trading_name} onChange={(v) => setForm({ ...form, trading_name: v })} />
            <Field label="Legal name" value={form.legal_name} onChange={(v) => setForm({ ...form, legal_name: v })} />
            <div>
              <label className="text-xs font-medium text-neutral-500">Customer type</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={form.customer_type}
                onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
              >
                <option value="business">Business</option>
                <option value="individual">Individual</option>
                <option value="government">Government</option>
                <option value="ngo">NGO</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Status</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
                <option value="on_hold">On hold</option>
              </select>
            </div>
            <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
            <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
            <Field label="VAT number" value={form.vat_number} onChange={(v) => setForm({ ...form, vat_number: v })} />
            <Field label="Registration no." value={form.registration_number} onChange={(v) => setForm({ ...form, registration_number: v })} />
          </div>
        </Section>

        <Section title="Primary contact">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contact name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
            <Field label="Job title" value={form.job_title} onChange={(v) => setForm({ ...form, job_title: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
        </Section>

        <Section title="Addresses">
          <div className="space-y-3">
            <Field label="Billing address" value={form.billing_address} onChange={(v) => setForm({ ...form, billing_address: v })} multiline />
            <Field label="Shipping address" value={form.shipping_address} onChange={(v) => setForm({ ...form, shipping_address: v })} multiline />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="Region / province" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
            </div>
          </div>
        </Section>

        <Section title="Commercial">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
            <Field label="Payment terms" value={form.payment_terms} onChange={(v) => setForm({ ...form, payment_terms: v })} />
            <Field label="Credit limit" value={form.credit_limit} onChange={(v) => setForm({ ...form, credit_limit: v })} type="number" />
            <div>
              <label className="text-xs font-medium text-neutral-500">Source</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="">—</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Field label="Account owner" value={form.owner_name} onChange={(v) => setForm({ ...form, owner_name: v })} />
          </div>
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} multiline />
        </Section>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary w-full !py-3"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editId ? 'Save changes' : 'Create customer'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t first:border-t-0 pt-4 first:pt-0">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {children}
    </div>
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
      <label className="text-xs font-medium text-neutral-500">{label}</label>
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
