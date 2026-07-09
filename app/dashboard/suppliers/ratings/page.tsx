'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { CompanyRequired, SuppliersHeader } from '@/components/suppliers/SuppliersShell';

type Agg = {
  supplier_profile_id: number;
  name: string;
  rating_avg: number;
  rating_count: number;
  quality: number | null;
  delivery: number | null;
  communication: number | null;
  value: number | null;
};

export default function SupplierRatingsPage() {
  return (
    <CompanyRequired>
      <RatingsInner />
    </CompanyRequired>
  );
}

function RatingsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const [bySupplier, setBySupplier] = useState<Agg[]>([]);
  const [summary, setSummary] = useState({ reviewCount: 0, givenCount: 0, suppliersRated: 0, avgRating: 0 });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    supplierProfileId: '',
    overall: 5,
    quality: 5,
    delivery: 5,
    communication: 5,
    value: 5,
    comment: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/ratings?companyId=${companyId}`);
      const data = await res.json();
      setBySupplier(data.bySupplier || []);
      setSummary(data.summary || summary);
      if (data.warning) toast.message(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.supplierProfileId) {
      toast.error('Supplier profile id required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: user?.id,
          supplierProfileId: Number(form.supplierProfileId),
          overall: form.overall,
          quality: form.quality,
          delivery: form.delivery,
          communication: form.communication,
          value: form.value,
          comment: form.comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Rating published');
      setForm({ ...form, comment: '' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <SuppliersHeader
        title="Supplier ratings"
        description="Rate suppliers on quality, delivery, communication, and value. Ratings feed the composite trust score alongside OTIFEF."
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-2xl font-black">{summary.suppliersRated}</div>
          <div className="text-xs text-neutral-500">Suppliers rated</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-2xl font-black">{summary.avgRating.toFixed(1)}</div>
          <div className="text-xs text-neutral-500">Average rating</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-2xl font-black">{summary.givenCount}</div>
          <div className="text-xs text-neutral-500">Reviews given</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-3xl overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-neutral-500">
            Aggregate by supplier
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : bySupplier.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">No ratings yet.</div>
          ) : (
            <ul className="divide-y">
              {bySupplier.map((s) => (
                <li key={s.supplier_profile_id} className="px-5 py-4 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      {s.rating_avg.toFixed(1)}
                      <span className="text-neutral-400 font-normal">({s.rating_count})</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] text-neutral-500">
                    <span>Q {s.quality?.toFixed(1) ?? '—'}</span>
                    <span>D {s.delivery?.toFixed(1) ?? '—'}</span>
                    <span>C {s.communication?.toFixed(1) ?? '—'}</span>
                    <span>V {s.value?.toFixed(1) ?? '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border rounded-3xl p-5 space-y-3">
          <h3 className="font-bold">Rate a supplier</h3>
          <p className="text-xs text-neutral-500">
            Prefer rating from a completed PO when possible (unique per PO). This form also works
            with the supplier&apos;s platform profile id.
          </p>
          <div>
            <label className="text-xs font-medium">Supplier profile id *</label>
            <input
              className="input mt-1 w-full !p-3 !text-sm"
              value={form.supplierProfileId}
              onChange={(e) => setForm({ ...form, supplierProfileId: e.target.value })}
              placeholder="Linked platform profile id"
            />
          </div>
          {(
            [
              ['overall', 'Overall'],
              ['quality', 'Quality'],
              ['delivery', 'Delivery'],
              ['communication', 'Communication'],
              ['value', 'Value'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-medium">
                {label}: {form[key]}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                className="w-full"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
          <textarea
            className="input w-full !p-3 !text-sm min-h-[70px]"
            placeholder="Comment"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="btn-primary w-full !py-3"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Publish rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
