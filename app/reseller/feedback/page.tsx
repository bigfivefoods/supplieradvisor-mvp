'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquareHeart, Star } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';
import { FEEDBACK_STAR_DIMENSIONS } from '@/lib/containers/reseller-feedback';

type Inv = {
  id: number;
  product_name: string;
  product_id?: number | null;
  sku?: string | null;
};

type FeedbackRow = {
  id: number;
  product_name: string;
  rating_overall?: number | null;
  rating_product?: number | null;
  rating_price?: number | null;
  rating_brand?: number | null;
  free_text?: string | null;
  customer_name?: string | null;
  created_at?: string;
};

type Summary = {
  total: number;
  with_text: number;
  dimensions: Array<{ key: string; label: string; avg: number | null; count: number }>;
};

const emptyStars = () =>
  Object.fromEntries(FEEDBACK_STAR_DIMENSIONS.map((d) => [d.key, 0])) as Record<
    string,
    number
  >;

export default function ResellerFeedbackPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resellerId, setResellerId] = useState<number | null>(null);
  const [items, setItems] = useState<Inv[]>([]);
  const [history, setHistory] = useState<FeedbackRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [productKey, setProductKey] = useState('');
  const [customProduct, setCustomProduct] = useState('');
  const [stars, setStars] = useState<Record<string, number>>(emptyStars);
  const [freeText, setFreeText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');

  const authBody = useCallback(() => {
    if (!user) return null;
    return {
      privyUserId: getCanonicalUserId(user.id),
      email: extractEmailFromPrivyUser(user),
    };
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const body = authBody()!;
      const sessionRes = await fetch('/api/reseller/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const session = await sessionRes.json();
      const r = session.resellers?.[0];
      setResellerId(r?.id ?? null);
      setItems(session.inventory || []);

      const fbRes = await fetch('/api/reseller/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          resellerId: r?.id,
          list: true,
        }),
      });
      const fb = await fbRes.json();
      if (fb.migration_required) {
        toast.message('Feedback migration pending on server');
      }
      setHistory(fb.feedback || []);
      setSummary(fb.summary || null);
    } finally {
      setLoading(false);
    }
  }, [user, authBody]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedInv =
    productKey && productKey !== '__other__'
      ? items.find((i) => String(i.id) === productKey)
      : null;

  const submit = async () => {
    if (!user || !resellerId) return;
    const product_name =
      selectedInv && productKey !== '__other__'
        ? selectedInv.product_name
        : customProduct.trim();
    if (!product_name) {
      toast.error('Select or enter a product name');
      return;
    }

    const payload: Record<string, unknown> = {
      ...authBody(),
      resellerId,
      product_name,
      product_id: selectedInv?.product_id ?? null,
      sku: selectedInv?.sku ?? null,
      free_text: freeText.trim(),
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      customer_location: customerLocation.trim() || null,
    };
    for (const d of FEEDBACK_STAR_DIMENSIONS) {
      payload[d.key] = stars[d.key] > 0 ? stars[d.key] : null;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/reseller/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success(data.message || 'Feedback saved');
      setStars(emptyStars());
      setFreeText('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerLocation('');
      setCustomProduct('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (!resellerId) {
    return (
      <p className="text-sm text-slate-500">
        No reseller profile linked. Open your invite link first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
          <MessageSquareHeart className="w-6 h-6 text-[#00b4d8]" />
          Customer feedback
        </h1>
        <p className="text-sm text-slate-500">
          Capture what customers say about product, price, brand and packaging.
          This feeds product development and pricing for the network.
        </p>
      </div>

      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MiniKpi label="Responses" value={String(summary.total)} />
          <MiniKpi
            label="With notes"
            value={String(summary.with_text)}
          />
          {summary.dimensions
            .filter((d) => d.key === 'rating_overall' || d.avg != null)
            .slice(0, 4)
            .map((d) => (
              <MiniKpi
                key={d.key}
                label={d.label}
                value={d.avg != null ? `${d.avg.toFixed(1)}★` : '—'}
              />
            ))}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Product *
          </label>
          {items.length > 0 && (
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={productKey}
              onChange={(e) => {
                setProductKey(e.target.value);
                if (e.target.value !== '__other__') setCustomProduct('');
              }}
            >
              <option value="">Select product…</option>
              {items.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.product_name}
                  {i.sku ? ` · ${i.sku}` : ''}
                </option>
              ))}
              <option value="__other__">Other / not in stock list…</option>
            </select>
          )}
          {(items.length === 0 || productKey === '__other__') && (
            <input
              className={`input w-full !p-2.5 !text-sm ${items.length ? 'mt-2' : 'mt-1.5'}`}
              placeholder="Product name *"
              value={customProduct}
              onChange={(e) => setCustomProduct(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Star ratings
          </div>
          {FEEDBACK_STAR_DIMENSIONS.map((d) => (
            <StarRow
              key={d.key}
              label={d.label}
              value={stars[d.key] || 0}
              onChange={(n) => setStars((s) => ({ ...s, [d.key]: n }))}
            />
          ))}
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Free text notes
          </label>
          <textarea
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[110px] resize-y"
            placeholder="What did the customer say? Taste, size, price resistance, competitors, packaging issues, re-buy intent…"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            maxLength={4000}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Optional but valuable for product development.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Customer name
            </label>
            <input
              className="input w-full !p-2.5 !text-sm mt-1"
              placeholder="Optional"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Phone
            </label>
            <input
              className="input w-full !p-2.5 !text-sm mt-1"
              placeholder="Optional"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Area / location
            </label>
            <input
              className="input w-full !p-2.5 !text-sm mt-1"
              placeholder="Optional"
              value={customerLocation}
              onChange={(e) => setCustomerLocation(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="w-full btn-primary !py-3 text-sm font-bold inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Star className="w-4 h-4" /> Save feedback
            </>
          )}
        </button>
      </div>

      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
          Recent captures ({history.length})
        </h2>
        {history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No feedback yet. Capture the first customer response above.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 20).map((f) => (
              <li
                key={f.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {f.product_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {f.created_at
                        ? new Date(f.created_at).toLocaleString('en-ZA')
                        : ''}
                      {f.customer_name ? ` · ${f.customer_name}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-black tabular-nums text-amber-600 shrink-0">
                    {f.rating_overall != null
                      ? `${Number(f.rating_overall).toFixed(1)}★`
                      : '—'}
                  </div>
                </div>
                {(f.rating_product != null ||
                  f.rating_price != null ||
                  f.rating_brand != null) && (
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {f.rating_product != null && (
                      <span>Product {Number(f.rating_product).toFixed(1)}</span>
                    )}
                    {f.rating_price != null && (
                      <span>Price {Number(f.rating_price).toFixed(1)}</span>
                    )}
                    {f.rating_brand != null && (
                      <span>Brand {Number(f.rating_brand).toFixed(1)}</span>
                    )}
                  </div>
                )}
                {f.free_text && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {f.free_text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-slate-700 shrink-0 w-32 sm:w-40">
        {label}
      </span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border text-base transition-colors ${
              value >= n
                ? 'bg-amber-400 border-amber-500 text-white'
                : 'bg-white border-slate-200 text-slate-300 hover:border-amber-300'
            }`}
            aria-label={`${label} ${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-lg font-black tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
