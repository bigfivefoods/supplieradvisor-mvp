'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Copy,
  Check,
  Package,
  Banknote,
  Trash2,
  ArrowRightLeft,
  Mail,
  MessageSquareHeart,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { isValidSaIdNumber } from '@/lib/verifynow/client';
import { RESELLER_VERIFY_FEE_ZAR } from '@/lib/containers/resellers';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type Reseller = {
  id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  id_number?: string | null;
  portal_status?: string | null;
  verification_status?: string | null;
  verification_fee_status?: string | null;
  verification_fee_zar?: number | null;
  primary_container_id?: number | null;
  invite_url?: string | null;
  stock_units?: number;
  sales_total?: number;
  commission_total?: number;
  sales_count?: number;
};

type Container = { id: number; name: string; container_code?: string };
type InvLine = {
  id: number;
  product_name: string;
  sku?: string | null;
  product_id?: number | null;
  qty_on_hand: number;
  unit?: string | null;
};
type Rate = {
  id: number;
  product_name?: string | null;
  product_id?: number | null;
  sku?: string | null;
  commission_type: string;
  commission_value: number;
  reseller_id?: number | null;
};

export default function ResellersPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [fee, setFee] = useState(RESELLER_VERIFY_FEE_ZAR);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    primary_container_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Transfer UI
  const [xferReseller, setXferReseller] = useState<number | ''>('');
  const [xferContainer, setXferContainer] = useState<number | ''>('');
  const [containerStock, setContainerStock] = useState<InvLine[]>([]);
  const [xferQty, setXferQty] = useState<Record<number, string>>({});
  const [xfering, setXfering] = useState(false);

  // Commission form
  const [rateForm, setRateForm] = useState({
    product_name: '',
    commission_type: 'percent',
    commission_value: '10',
    reseller_id: '',
  });

  const [fbSummary, setFbSummary] = useState<{
    total: number;
    with_text: number;
    overall: number | null;
    topProducts: Array<{ product_name: string; avg_overall: number | null; count: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes, rateRes, fbRes] = await Promise.all([
        fetch(`/api/containers/resellers?companyId=${companyId}`, {
          cache: 'no-store',
        }).then((r) => r.json()),
        fetch(`/api/containers?companyId=${companyId}`).then((r) => r.json()),
        fetch(
          `/api/containers/resellers/commissions?companyId=${companyId}`
        ).then((r) => r.json()),
        fetch(
          `/api/containers/resellers/feedback?companyId=${companyId}&limit=200`
        ).then((r) => r.json()),
      ]);
      if (rRes.migration_required) {
        setMigrationHint(
          rRes.warning ||
            'Run supabase/migrations/20260714_container_resellers.sql'
        );
      } else {
        setMigrationHint(null);
      }
      setResellers(rRes.resellers || []);
      setFee(rRes.verify_fee_zar ?? RESELLER_VERIFY_FEE_ZAR);
      setContainers(cRes.containers || []);
      setRates(rateRes.rates || []);
      if (fbRes?.summary) {
        const overallDim = (fbRes.summary.dimensions || []).find(
          (d: { key: string }) => d.key === 'rating_overall'
        );
        setFbSummary({
          total: fbRes.summary.total || 0,
          with_text: fbRes.summary.with_text || 0,
          overall: overallDim?.avg ?? null,
          topProducts: (fbRes.summary.by_product || []).slice(0, 5),
        });
      } else {
        setFbSummary(null);
      }
    } catch {
      toast.error('Failed to load resellers');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!xferContainer) {
      setContainerStock([]);
      return;
    }
    void (async () => {
      const res = await fetch(
        `/api/containers/inventory?companyId=${companyId}&containerId=${xferContainer}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      setContainerStock(data.items || []);
      setXferQty({});
    })();
  }, [xferContainer, companyId]);

  const createReseller = async () => {
    if (!form.full_name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Email is required so we can send the portal invitation');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          id_number: form.id_number || null,
          primary_container_id: form.primary_container_id
            ? Number(form.primary_container_id)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint || data.error || 'Failed');
      if (data.emailSent) {
        toast.success(
          data.message ||
            `Invitation emailed to ${form.email} — they can confirm and open the portal`
        );
      } else if (data.warning) {
        toast.message('Reseller created', { description: data.warning });
      } else {
        toast.success(data.message || 'Reseller created');
      }
      setForm({
        full_name: '',
        email: '',
        phone: '',
        id_number: '',
        primary_container_id: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const sendInviteEmail = async (r: Reseller) => {
    if (!r.email) {
      toast.error('Add an email on this reseller first');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/resellers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: r.id,
          send_invite: true,
          regenerate_invite: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      if (data.emailSent) {
        toast.success(data.message || `Invitation emailed to ${r.email}`);
      } else {
        toast.message(data.message || 'Invite link ready', {
          description: data.warning,
        });
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const verify = async (r: Reseller) => {
    const idNumber = r.id_number || form.id_number;
    if (!idNumber || !isValidSaIdNumber(idNumber)) {
      toast.error('Valid SA ID number required on the reseller first');
      return;
    }
    if (
      !confirm(
        `Run VerifyNow for ${r.full_name}? A R${fee} verification fee will be charged on success.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/resellers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          resellerId: r.id,
          idNumber,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Verify failed');
      toast.success(data.message || 'Verification complete');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setSaving(false);
    }
  };

  const transfer = async () => {
    if (!xferReseller || !xferContainer) {
      toast.error('Select reseller and container');
      return;
    }
    const lines = containerStock
      .map((item) => ({
        product_name: item.product_name,
        product_id: item.product_id,
        sku: item.sku,
        quantity: Number(xferQty[item.id] || 0),
        unit: item.unit,
      }))
      .filter((l) => l.quantity > 0);

    if (!lines.length) {
      toast.error('Enter quantities to transfer');
      return;
    }

    setXfering(true);
    try {
      const res = await fetch('/api/containers/resellers/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          resellerId: Number(xferReseller),
          containerId: Number(xferContainer),
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      toast.success(data.message || 'Stock transferred');
      setXferQty({});
      // reload stock
      const inv = await fetch(
        `/api/containers/inventory?companyId=${companyId}&containerId=${xferContainer}`
      ).then((r) => r.json());
      setContainerStock(inv.items || []);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setXfering(false);
    }
  };

  const saveRate = async () => {
    if (!rateForm.product_name.trim()) {
      toast.error('Product name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/resellers/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          product_name: rateForm.product_name,
          commission_type: rateForm.commission_type,
          commission_value: Number(rateForm.commission_value),
          reseller_id: rateForm.reseller_id
            ? Number(rateForm.reseller_id)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Commission rate saved');
      setRateForm({
        product_name: '',
        commission_type: 'percent',
        commission_value: '10',
        reseller_id: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const copyInvite = async (r: Reseller) => {
    if (!r.invite_url) return;
    await navigator.clipboard.writeText(r.invite_url);
    setCopied(r.id);
    toast.success('Invite link copied');
    setTimeout(() => setCopied(null), 2000);
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this reseller?')) return;
    await fetch(
      `/api/containers/resellers?companyId=${companyId}&id=${id}`,
      { method: 'DELETE' }
    );
    void load();
  };

  const verified = (r: Reseller) => {
    const s = String(r.verification_status || '').toLowerCase();
    return s === 'verified' || s === 'mismatch';
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Container"
        titleAccent="resellers"
        description={`Add resellers, VerifyNow (R${fee}/person), draw stock from containers, and set dynamic per-item commission. Resellers sell via their portal.`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/containers/resellers/feedback"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <MessageSquareHeart className="w-4 h-4" /> Customer feedback
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong> {migrationHint}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 space-y-4">
            <Panel title="Add reseller">
              <div className="p-4 space-y-3">
                <input
                  className="input w-full !p-2.5 !text-sm"
                  placeholder="Full name *"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                />
                <input
                  className="input w-full !p-2.5 !text-sm"
                  type="email"
                  placeholder="Email * (invitation sent here)"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                <input
                  className="input w-full !p-2.5 !text-sm"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
                <input
                  className="input w-full !p-2.5 !text-sm"
                  placeholder="SA ID number"
                  value={form.id_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, id_number: e.target.value }))
                  }
                />
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.primary_container_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      primary_container_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Primary container (optional)</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.container_code ? `· ${c.container_code}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  We email them a <strong>confirm &amp; open portal</strong> link.
                  VerifyNow charges <strong>R{fee}</strong> per person when
                  verification succeeds. Stock only after verify.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createReseller()}
                  className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add &amp; email invite
                </button>
              </div>
            </Panel>

            <Panel title="Per-item commission (dynamic)">
              <div className="p-4 space-y-3">
                <input
                  className="input w-full !p-2.5 !text-sm"
                  placeholder="Product name *"
                  value={rateForm.product_name}
                  onChange={(e) =>
                    setRateForm((f) => ({
                      ...f,
                      product_name: e.target.value,
                    }))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={rateForm.commission_type}
                    onChange={(e) =>
                      setRateForm((f) => ({
                        ...f,
                        commission_type: e.target.value,
                      }))
                    }
                  >
                    <option value="percent">% of sale</option>
                    <option value="fixed">Fixed R / unit</option>
                  </select>
                  <input
                    type="number"
                    className="input !p-2.5 !text-sm"
                    placeholder="Value"
                    value={rateForm.commission_value}
                    onChange={(e) =>
                      setRateForm((f) => ({
                        ...f,
                        commission_value: e.target.value,
                      }))
                    }
                  />
                </div>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={rateForm.reseller_id}
                  onChange={(e) =>
                    setRateForm((f) => ({
                      ...f,
                      reseller_id: e.target.value,
                    }))
                  }
                >
                  <option value="">All resellers (default)</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} only
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveRate()}
                  className="btn-secondary w-full !py-2.5 text-sm"
                >
                  Save rate
                </button>
                <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
                  {rates.length === 0 ? (
                    <li className="text-slate-500">
                      Default if unset: 10% of sale line.
                    </li>
                  ) : (
                    rates.map((rt) => (
                      <li
                        key={rt.id}
                        className="flex justify-between gap-2 border-b border-slate-50 pb-1"
                      >
                        <span className="font-semibold truncate">
                          {rt.product_name || `Product #${rt.product_id}`}
                        </span>
                        <span className="tabular-nums shrink-0">
                          {rt.commission_type === 'fixed'
                            ? `R${rt.commission_value}/u`
                            : `${rt.commission_value}%`}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </Panel>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <Panel title={`Resellers (${resellers.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-3">Person</th>
                      <th className="px-3 py-3">Verify</th>
                      <th className="px-3 py-3 text-right">Stock</th>
                      <th className="px-3 py-3 text-right">Sales</th>
                      <th className="px-3 py-3 text-right">Commission</th>
                      <th className="px-3 py-3">Portal</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No resellers yet.
                        </td>
                      </tr>
                    ) : (
                      resellers.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold">{r.full_name}</div>
                            <div className="text-[11px] text-slate-500">
                              {r.email || '—'} · {r.phone || '—'}
                            </div>
                            {r.id_number && (
                              <div className="text-[10px] font-mono text-slate-400">
                                ID {r.id_number}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                verified(r)
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {r.verification_status || 'unverified'}
                            </span>
                            {r.verification_fee_status === 'charged' && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Fee R{r.verification_fee_zar ?? fee} charged
                              </div>
                            )}
                            {!verified(r) && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void verify(r)}
                                className="mt-1 text-[11px] font-bold text-[#0077b6] hover:underline"
                              >
                                VerifyNow (R{fee})
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {r.stock_units ?? 0}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            R{(r.sales_total ?? 0).toLocaleString('en-ZA')}
                            <div className="text-[10px] text-slate-400">
                              {r.sales_count ?? 0} sales
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-800">
                            R{(r.commission_total ?? 0).toLocaleString('en-ZA')}
                          </td>
                          <td className="px-3 py-3 text-xs capitalize">
                            {r.portal_status || '—'}
                            <div className="mt-1 flex flex-col gap-0.5 items-start">
                              {r.email && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void sendInviteEmail(r)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-[#0077b6] hover:underline"
                                >
                                  <Mail className="w-3 h-3" />
                                  Email invite
                                </button>
                              )}
                              {r.invite_url && (
                                <button
                                  type="button"
                                  onClick={() => void copyInvite(r)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:underline"
                                >
                                  {copied === r.id ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Copy link
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void remove(r.id)}
                              className="text-red-500 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Draw stock to reseller">
              <div className="p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={xferReseller}
                    onChange={(e) =>
                      setXferReseller(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  >
                    <option value="">Select verified reseller…</option>
                    {resellers.filter(verified).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={xferContainer}
                    onChange={(e) =>
                      setXferContainer(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  >
                    <option value="">From container…</option>
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!resellers.some(verified) && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Verify at least one reseller with VerifyNow before drawing
                    stock.
                  </p>
                )}

                {xferContainer && (
                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    {containerStock.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        No stock on this container.{' '}
                        <Link
                          href={`/dashboard/containers/${xferContainer}/inventory`}
                          className="text-[#0077b6] font-semibold"
                        >
                          Add inventory →
                        </Link>
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                            <th className="text-left px-3 py-2">Product</th>
                            <th className="text-right px-3 py-2">On hand</th>
                            <th className="text-right px-3 py-2">Transfer qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {containerStock.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="px-3 py-2 font-medium">
                                {item.product_name}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {item.qty_on_hand} {item.unit}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={Number(item.qty_on_hand)}
                                  className="input !p-1.5 !text-sm !w-24 text-right"
                                  value={xferQty[item.id] || ''}
                                  onChange={(e) =>
                                    setXferQty((q) => ({
                                      ...q,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={xfering || !xferReseller || !xferContainer}
                  onClick={() => void transfer()}
                  className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
                >
                  {xfering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )}
                  Transfer stock to reseller
                </button>
              </div>
            </Panel>

            <Panel title="Field customer feedback">
              <div className="p-4 space-y-3">
                {fbSummary && fbSummary.total > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          Responses
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {fbSummary.total}
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" /> Overall
                        </div>
                        <div className="text-lg font-black tabular-nums text-amber-800">
                          {fbSummary.overall != null
                            ? `${fbSummary.overall.toFixed(1)}★`
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          Notes
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {fbSummary.with_text}
                        </div>
                      </div>
                    </div>
                    {fbSummary.topProducts.length > 0 && (
                      <ul className="text-xs space-y-1">
                        {fbSummary.topProducts.map((p) => (
                          <li
                            key={p.product_name}
                            className="flex justify-between gap-2 border-b border-slate-50 pb-1"
                          >
                            <span className="font-semibold truncate">
                              {p.product_name}
                            </span>
                            <span className="tabular-nums shrink-0 text-amber-700 font-bold">
                              {p.avg_overall != null
                                ? `${p.avg_overall.toFixed(1)}★`
                                : '—'}{' '}
                              <span className="text-slate-400 font-normal">
                                ({p.count})
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Resellers capture product / price / brand stars and free-text
                    notes in their portal. Nothing logged yet.
                  </p>
                )}
                <Link
                  href="/dashboard/containers/resellers/feedback"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0077b6] hover:underline"
                >
                  <MessageSquareHeart className="w-4 h-4" />
                  Open feedback report →
                </Link>
              </div>
            </Panel>

            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-slate-700">
              <strong className="text-slate-900">Reseller portal:</strong>{' '}
              <code className="text-xs">/reseller</code> — they sign in with
              Privy via invite link, see stock drawn to them, log sales, capture
              customer feedback (stars + free text), and earn commission per item
              rate.
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-[#00b4d8]" /> Draw stock
                </span>
                <span className="inline-flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-[#00b4d8]" /> Dynamic
                  commission
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00b4d8]" />{' '}
                  VerifyNow R{fee}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ContainersPage>
  );
}
