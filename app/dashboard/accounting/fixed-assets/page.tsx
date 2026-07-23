'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, TrendingDown, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, statusClass, type FixedAsset } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type AssetRow = FixedAsset & {
  monthly_depreciation?: number;
  capitalization_journal_id?: number | null;
  capitalized_at?: string | null;
};

export default function FixedAssetsPage() {
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
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    asset_code: '',
    category: 'equipment',
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: '',
    residual_value: '0',
    useful_life_months: '60',
    location: '',
    serial_number: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/fixed-assets?${params}`);
      const data = await res.json();
      setAssets(data.assets || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...form,
          purchase_cost: Number(form.purchase_cost || 0),
          residual_value: Number(form.residual_value || 0),
          useful_life_months: Number(form.useful_life_months || 60),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.journal?.entryNumber
          ? `Asset registered · on BS ${data.journal.entryNumber}`
          : 'Asset registered'
      );
      if (data.journalWarning) toast.message(data.journalWarning);
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function depreciate(id: number) {
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'depreciate',
          id,
          periods: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.journal?.entryNumber
          ? `Depreciated ${formatMoney(data.depreciation_amount)} · ${data.journal.entryNumber}`
          : `Depreciated ${formatMoney(data.depreciation_amount)}`
      );
      if (data.journalWarning) toast.message(data.journalWarning);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function capitalizeToBs(id: number) {
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'capitalize',
          id,
          creditSide: 'ap',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.skipped) {
        toast.message('Already on balance sheet');
      } else {
        toast.success(
          data.journal?.entryNumber
            ? `On BS · ${data.journal.entryNumber} (Dr PPE · Cr AP)`
            : 'Capitalised to balance sheet'
        );
      }
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function capitalizeAll() {
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'capitalize_all',
          creditSide: 'ap',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        `Capitalised ${data.capitalised || 0} · skipped ${data.skipped || 0}`
      );
      if (data.errors?.length) toast.message(String(data.errors[0]));
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const totalCost = assets
    .filter((a) => a.status !== 'disposed')
    .reduce((s, a) => s + Number(a.purchase_cost || 0), 0);
  const totalBv = assets
    .filter((a) => a.status !== 'disposed')
    .reduce((s, a) => s + Number(a.book_value || 0), 0);
  const totalAccum = assets
    .filter((a) => a.status !== 'disposed')
    .reduce((s, a) => s + Number(a.accumulated_depreciation || 0), 0);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Fixed"
        titleAccent="assets"
        description="Register assets, capitalise onto the balance sheet (Dr PPE · Cr AP), and post depreciation to GL."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void capitalizeAll()}
              className="btn-secondary !py-2.5 !px-4 text-sm"
              title="Post all uncapitalised assets to GL balance sheet"
            >
              Post all to BS
            </button>
            <button type="button" onClick={() => setShowModal(true)} className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Register asset
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Cost</div>
          <div className="text-xl font-black tabular-nums">{formatMoney(totalCost)}</div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Accum. depr.</div>
          <div className="text-xl font-black tabular-nums">{formatMoney(totalAccum)}</div>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">Book value</div>
          <div className="text-xl font-black tabular-nums text-emerald-950">{formatMoney(totalBv)}</div>
        </div>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : assets.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No fixed assets registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Asset</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Purchased</th>
                  <th className="px-4 py-3 font-semibold text-right">Cost</th>
                  <th className="px-4 py-3 font-semibold text-right">Book value</th>
                  <th className="px-4 py-3 font-semibold text-right">Monthly</th>
                  <th className="px-4 py-3 font-semibold">BS</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{a.name}</div>
                      <div className="text-[11px] text-neutral-400">
                        {a.asset_code || `#${a.id}`}
                        {a.serial_number ? ` · ${a.serial_number}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 capitalize">{a.category}</td>
                    <td className="px-4 py-3 tabular-nums text-neutral-500">
                      {a.purchase_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(a.purchase_cost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatMoney(a.book_value)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-500">
                      {formatMoney(a.monthly_depreciation)}
                    </td>
                    <td className="px-4 py-3">
                      {a.capitalization_journal_id ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800">
                          On BS
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-900">
                          Off books
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(a.status || 'active'))}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {!a.capitalization_journal_id &&
                          a.status !== 'disposed' &&
                          Number(a.purchase_cost || 0) > 0 && (
                            <button
                              type="button"
                              title="Capitalise to balance sheet (Dr PPE · Cr AP)"
                              onClick={() => void capitalizeToBs(a.id)}
                              className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg border border-violet-200 text-violet-900 hover:bg-violet-50"
                            >
                              To BS
                            </button>
                          )}
                        {a.status === 'active' && (
                          <button
                            type="button"
                            title="Run 1 month depreciation → GL"
                            onClick={() => void depreciate(a.id)}
                            className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] text-neutral-500 hover:text-[#0077b6]"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">Register asset</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Code
                  <input
                    value={form.asset_code}
                    onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="equipment">Equipment</option>
                    <option value="vehicles">Vehicles</option>
                    <option value="buildings">Buildings</option>
                    <option value="furniture">Furniture</option>
                    <option value="software">Software</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-neutral-600">
                Purchase date
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Cost
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchase_cost}
                    onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Residual
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.residual_value}
                    onChange={(e) => setForm({ ...form, residual_value: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Life (mo)
                  <input
                    type="number"
                    min="1"
                    value={form.useful_life_months}
                    onChange={(e) => setForm({ ...form, useful_life_months: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-neutral-600">
                Location
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
