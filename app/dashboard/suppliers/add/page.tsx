'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { SUPPLIER_CERTIFICATIONS, SUPPLIER_INDUSTRIES } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';

export default function AddSupplierPage() {
  return (
    <CompanyRequired>
      <AddInner />
    </CompanyRequired>
  );
}

function AddInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [form, setForm] = useState({
    trading_name: '',
    legal_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    industry: '',
    category: '',
    city: '',
    country: 'South Africa',
    notes: '',
    certifications: [] as string[],
  });

  const toggleCert = (c: string) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.includes(c)
        ? f.certifications.filter((x) => x !== c)
        : [...f.certifications, c],
    }));
  };

  const submit = async () => {
    if (!form.trading_name.trim()) {
      toast.error('Trading name required');
      return;
    }
    if (sendInvite && !form.contact_email.trim()) {
      toast.error('Email required to invite');
      return;
    }
    setSaving(true);
    try {
      if (sendInvite) {
        const res = await fetch('/api/suppliers/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            trading_name: form.trading_name,
            legal_name: form.legal_name || form.trading_name,
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            contact_phone: form.contact_phone,
            website: form.website,
            industry: form.industry,
            category: form.category,
            city: form.city,
            country: form.country,
            invitedBy: form.contact_name || 'Buyer',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invite failed');
        toast.success(
          data.warning
            ? 'Supplier added — share invite link manually (email failed)'
            : 'Invitation sent — supplier can claim and take over'
        );
        if (data.inviteLink) {
          try {
            await navigator.clipboard.writeText(data.inviteLink);
            toast.message('Invite link copied to clipboard');
          } catch {
            /* ignore */
          }
        }
      } else {
        const res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            ...form,
            email: form.contact_email,
            phone: form.contact_phone,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Create failed');
        toast.success('Supplier added to your book');
      }
      router.push('/dashboard/suppliers/network');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="Add or invite supplier"
        description="Add a supplier to your book immediately. Invite them to SupplierAdvisor so they claim the profile, complete verification, and take over their own data — while your connection stays live."
      />

      <div className="max-w-2xl bg-white border rounded-3xl p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer p-3 rounded-2xl bg-sky-50 border border-sky-100">
          <input
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
          />
          Send platform invite (recommended) — they take over their company profile
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Trading name *</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.trading_name}
              onChange={(e) => setForm({ ...form, trading_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Legal name</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Contact name</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Email {sendInvite ? '*' : ''}</label>
            <input
              type="email"
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Phone</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Industry</label>
            <select
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              <option value="">Select…</option>
              {SUPPLIER_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Category</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Dairy ingredients"
            />
          </div>
          <div>
            <label className="text-xs font-medium">City</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Country</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Website</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
        </div>

        {!sendInvite && (
          <div>
            <label className="text-xs font-medium">Known certifications</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUPPLIER_CERTIFICATIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                    form.certifications.includes(c)
                      ? 'border-[#00b4d8] bg-[#00b4d8]/10'
                      : 'border-neutral-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="btn-primary w-full !py-3"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              {sendInvite ? 'Add & send invite' : 'Add to my book only'}
            </>
          )}
        </button>
      </div>
    </div>
    </SuppliersPage>
  );
}
