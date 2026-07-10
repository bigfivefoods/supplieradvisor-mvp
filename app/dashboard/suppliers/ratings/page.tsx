'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Star, Link2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';

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

type ConnectedSupplier = {
  profileId: number;
  trading_name: string;
  role?: string;
};

type CompletedPo = {
  id: number;
  supplier_profile_id?: number | null;
  supplier_name?: string | null;
  status?: string;
  total_amount?: number | null;
  currency?: string | null;
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
  const privyUserId = getCanonicalUserId(user?.id);

  const [bySupplier, setBySupplier] = useState<Agg[]>([]);
  const [summary, setSummary] = useState({
    reviewCount: 0,
    givenCount: 0,
    suppliersRated: 0,
    avgRating: 0,
  });
  const [connected, setConnected] = useState<ConnectedSupplier[]>([]);
  const [pos, setPos] = useState<CompletedPo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    supplierProfileId: '',
    purchaseOrderId: '',
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
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);

      const [ratingsRes, connRes, bookRes, poRes] = await Promise.all([
        fetch(`/api/suppliers/ratings?companyId=${companyId}`),
        fetch(`/api/connections?${params}`),
        fetch(`/api/suppliers?companyId=${companyId}`),
        privyUserId
          ? fetch(
              `/api/suppliers/purchase-orders?companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId)}`
            )
          : Promise.resolve(null),
      ]);

      const ratingsData = await ratingsRes.json();
      setBySupplier(ratingsData.bySupplier || []);
      setSummary(
        ratingsData.summary || {
          reviewCount: 0,
          givenCount: 0,
          suppliersRated: 0,
          avgRating: 0,
        }
      );
      if (ratingsData.warning) toast.message(ratingsData.warning);

      // Connected peers (accepted) that look like suppliers + SRM book links
      const peers = new Map<number, ConnectedSupplier>();

      const connData = await connRes.json();
      for (const e of connData.edges || []) {
        if (e.status !== 'accepted' || e.suspended) continue;
        const id = Number(e.peer?.id);
        if (!id) continue;
        const name =
          e.peer?.trading_name ||
          e.peer?.legal_name ||
          null;
        if (!name) continue;
        // Include supplier / seller / partner roles for rating
        peers.set(id, {
          profileId: id,
          trading_name: name,
          role: e.role || e.connection_type || 'partner',
        });
      }

      const bookData = await bookRes.json();
      for (const s of bookData.suppliers || []) {
        const id = Number(s.linked_profile_id);
        if (!id) continue;
        if (!peers.has(id)) {
          peers.set(id, {
            profileId: id,
            trading_name: s.trading_name || s.legal_name || `Supplier ${id}`,
            role: 'supplier',
          });
        }
      }

      const list = Array.from(peers.values()).sort((a, b) =>
        a.trading_name.localeCompare(b.trading_name)
      );
      setConnected(list);

      if (poRes) {
        const poData = await poRes.json();
        const completed = ((poData.purchaseOrders || []) as CompletedPo[]).filter((p) =>
          ['completed', 'paid', 'delivered', 'closed'].includes(
            String(p.status || '').toLowerCase()
          )
        );
        setPos(completed);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const posForSupplier = useMemo(() => {
    if (!form.supplierProfileId) return pos;
    const sid = Number(form.supplierProfileId);
    return pos.filter((p) => Number(p.supplier_profile_id) === sid);
  }, [pos, form.supplierProfileId]);

  // When PO selected, lock supplier to that PO's supplier
  useEffect(() => {
    if (!form.purchaseOrderId) return;
    const po = pos.find((p) => String(p.id) === form.purchaseOrderId);
    if (po?.supplier_profile_id) {
      setForm((f) => ({
        ...f,
        supplierProfileId: String(po.supplier_profile_id),
      }));
    }
  }, [form.purchaseOrderId, pos]);

  const submit = async () => {
    if (!form.supplierProfileId) {
      toast.error('Select a connected company to rate');
      return;
    }
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/suppliers/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          supplierProfileId: Number(form.supplierProfileId),
          purchaseOrderId: form.purchaseOrderId
            ? Number(form.purchaseOrderId)
            : undefined,
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
      setForm((f) => ({
        ...f,
        comment: '',
        purchaseOrderId: '',
      }));
      void load();
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
          title="Supplier ratings"
          description="Rate connected companies on quality, delivery, communication, and value. Ratings feed the composite trust score alongside OTIFEF."
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
              <div className="p-12 text-center text-sm text-neutral-500">
                No ratings yet. Rate a connected company using the form.
              </div>
            ) : (
              <ul className="divide-y">
                {bySupplier.map((s) => (
                  <li key={s.supplier_profile_id} className="px-5 py-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <button
                        type="button"
                        className="font-semibold text-left hover:text-[#0077b6]"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            supplierProfileId: String(s.supplier_profile_id),
                          }))
                        }
                      >
                        {s.name}
                      </button>
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                        {s.rating_avg.toFixed(1)}
                        <span className="text-neutral-400 font-normal">
                          ({s.rating_count})
                        </span>
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
              Choose a <strong>connected company</strong> by trading name. Optionally link a
              completed purchase order (one review per PO).
            </p>

            {connected.length === 0 && !loading ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No connected companies yet.{' '}
                <Link
                  href="/dashboard/suppliers/discover"
                  className="font-semibold underline inline-flex items-center gap-1"
                >
                  <Link2 className="w-3.5 h-3.5" /> Discover & connect
                </Link>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium">Company *</label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.supplierProfileId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      supplierProfileId: e.target.value,
                      purchaseOrderId: '',
                    })
                  }
                >
                  <option value="">Select connected company…</option>
                  {connected.map((c) => (
                    <option key={c.profileId} value={String(c.profileId)}>
                      {c.trading_name}
                      {c.role ? ` · ${c.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {posForSupplier.length > 0 && (
              <div>
                <label className="text-xs font-medium">
                  Completed PO (optional, recommended)
                </label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.purchaseOrderId}
                  onChange={(e) =>
                    setForm({ ...form, purchaseOrderId: e.target.value })
                  }
                >
                  <option value="">No PO — general review</option>
                  {posForSupplier.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      PO #{p.id}
                      {p.supplier_name ? ` · ${p.supplier_name}` : ''}
                      {p.total_amount != null
                        ? ` · ${p.currency || 'ZAR'} ${Number(p.total_amount).toFixed(0)}`
                        : ''}
                      {p.status ? ` · ${p.status}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                  }
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
              disabled={saving || connected.length === 0}
              onClick={() => void submit()}
              className="btn-primary w-full !py-3 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Publish rating'
              )}
            </button>
          </div>
        </div>
      </div>
    </SuppliersPage>
  );
}
