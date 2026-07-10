'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Trash2,
  FileText,
  Package,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  ExternalLink,
  Search,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  agreementStatusClass,
  type PricingAgreement,
  type PricingAgreementLine,
} from '@/lib/pricing/types';
import { formatMoney } from '@/lib/inventory/types';
import {
  CompanyRequired,
  ConnectionsNav,
  ConnectionsPage,
} from '@/components/connections/ConnectionsShell';
import {
  Panel,
  RelationshipHeader,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

type Peer = { id: number; trading_name: string; role?: string };
type ProductOpt = {
  id: number;
  name: string;
  sku?: string | null;
  sell_price?: number | null;
  uom?: string | null;
  specs_sheet_url?: string | null;
  specs_sheet_name?: string | null;
  primary_image_url?: string | null;
};

type LineForm = {
  key: string;
  seller_product_id: string;
  product_name: string;
  sku: string;
  uom: string;
  list_price: string;
  min_qty: string;
  suggested_resale_price: string;
  specs_sheet_url: string;
  specs_sheet_name: string;
};

type IncomingLine = PricingAgreementLine & {
  agreement_title?: string;
  seller_profile_id?: number | null;
  seller_name?: string | null;
  currency?: string | null;
};

const emptyLine = (): LineForm => ({
  key: `${Date.now()}-${Math.random()}`,
  seller_product_id: '',
  product_name: '',
  sku: '',
  uom: 'unit',
  list_price: '',
  min_qty: '1',
  suggested_resale_price: '',
  specs_sheet_url: '',
  specs_sheet_name: '',
});

export default function PricingAgreementsPage() {
  return (
    <CompanyRequired>
      <PricingInner />
    </CompanyRequired>
  );
}

function PricingInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [tab, setTab] = useState<'selling' | 'buying' | 'import'>('selling');
  const [agreements, setAgreements] = useState<PricingAgreement[]>([]);
  const [incoming, setIncoming] = useState<IncomingLine[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PricingAgreement | null>(null);
  const [q, setQ] = useState('');

  const [form, setForm] = useState({
    buyerProfileId: '',
    title: '',
    currency: 'ZAR',
    payment_terms: 'Net 30',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    notes: '',
    status: 'active',
  });
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const [agRes, catRes, connRes, prodRes] = await Promise.all([
        fetch(`/api/pricing/agreements?${params}&lines=1`),
        fetch(`/api/pricing/lookup?companyId=${companyId}&catalogue=1`),
        fetch(`/api/connections?companyId=${companyId}${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`),
        fetch(`/api/inventory/products?companyId=${companyId}`),
      ]);
      const agData = await agRes.json();
      const catData = await catRes.json();
      const connData = await connRes.json();
      const prodData = await prodRes.json();

      setAgreements(agData.agreements || []);
      setIncoming(catData.lines || []);
      if (agData.warning) toast.message(agData.warning, { description: agData.hint });

      const peerList: Peer[] = [];
      const seen = new Set<number>();
      for (const e of connData.edges || []) {
        if (e.status !== 'accepted' || e.suspended) continue;
        const id = Number(e.peer?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        peerList.push({
          id,
          trading_name: e.peer?.trading_name || e.peer?.legal_name || `Company #${id}`,
          role: e.role,
        });
      }
      peerList.sort((a, b) => a.trading_name.localeCompare(b.trading_name));
      setPeers(peerList);
      setProducts(prodData.products || []);
    } catch {
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selling = useMemo(
    () => agreements.filter((a) => a.direction === 'selling'),
    [agreements]
  );
  const buying = useMemo(
    () => agreements.filter((a) => a.direction === 'buying'),
    [agreements]
  );

  const filteredSelling = useMemo(() => {
    if (!q) return selling;
    const n = q.toLowerCase();
    return selling.filter(
      (a) =>
        a.title.toLowerCase().includes(n) ||
        a.buyer_name?.toLowerCase().includes(n) ||
        a.agreement_number?.toLowerCase().includes(n)
    );
  }, [selling, q]);

  const filteredBuying = useMemo(() => {
    if (!q) return buying;
    const n = q.toLowerCase();
    return buying.filter(
      (a) =>
        a.title.toLowerCase().includes(n) ||
        a.seller_name?.toLowerCase().includes(n) ||
        a.agreement_number?.toLowerCase().includes(n)
    );
  }, [buying, q]);

  const filteredIncoming = useMemo(() => {
    if (!q) return incoming;
    const n = q.toLowerCase();
    return incoming.filter(
      (l) =>
        l.product_name?.toLowerCase().includes(n) ||
        l.sku?.toLowerCase().includes(n) ||
        l.seller_name?.toLowerCase().includes(n) ||
        l.agreement_title?.toLowerCase().includes(n)
    );
  }, [incoming, q]);

  const pickProduct = (key: string, productId: string) => {
    const p = products.find((x) => String(x.id) === productId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (!p) {
          return { ...l, seller_product_id: productId };
        }
        return {
          ...l,
          seller_product_id: productId,
          product_name: p.name,
          sku: p.sku || '',
          uom: p.uom || 'unit',
          list_price:
            p.sell_price != null && Number.isFinite(Number(p.sell_price))
              ? String(p.sell_price)
              : l.list_price,
          specs_sheet_url: p.specs_sheet_url || '',
          specs_sheet_name: p.specs_sheet_name || '',
        };
      })
    );
  };

  const create = async () => {
    if (!form.buyerProfileId || !form.title.trim()) {
      toast.error('Select a buyer company and enter a title');
      return;
    }
    const cleanLines = lines
      .filter((l) => l.product_name.trim() && Number(l.list_price) >= 0)
      .map((l) => ({
        seller_product_id: l.seller_product_id ? Number(l.seller_product_id) : null,
        product_name: l.product_name.trim(),
        sku: l.sku || null,
        uom: l.uom || 'unit',
        list_price: Number(l.list_price) || 0,
        min_qty: Number(l.min_qty) || 1,
        suggested_resale_price: l.suggested_resale_price
          ? Number(l.suggested_resale_price)
          : null,
        specs_sheet_url: l.specs_sheet_url || null,
        specs_sheet_name: l.specs_sheet_name || null,
      }));
    if (!cleanLines.length) {
      toast.error('Add at least one product line with a list price');
      return;
    }
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/pricing/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          buyerProfileId: Number(form.buyerProfileId),
          title: form.title.trim(),
          currency: form.currency,
          payment_terms: form.payment_terms || null,
          effective_from: form.effective_from || null,
          effective_to: form.effective_to || null,
          notes: form.notes || null,
          status: form.status,
          lines: cleanLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agreement');
      toast.success(
        `Pricing agreement active — ${data.agreement?.buyer_name || 'buyer'} can import products at list price`
      );
      setShowCreate(false);
      setForm({
        buyerProfileId: '',
        title: '',
        currency: 'ZAR',
        payment_terms: 'Net 30',
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: '',
        notes: '',
        status: 'active',
      });
      setLines([emptyLine()]);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    if (!privyUserId) return;
    const res = await fetch('/api/pricing/agreements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Update failed');
      return;
    }
    toast.success(`Agreement marked ${status}`);
    void load();
  };

  const importLine = async (line: IncomingLine) => {
    if (!privyUserId || !line.id || !line.seller_profile_id) {
      toast.error('Missing line or seller');
      return;
    }
    setImportingId(Number(line.id));
    try {
      const res = await fetch('/api/inventory/products/import-from-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          sellerProfileId: line.seller_profile_id,
          agreementLineId: line.id,
          // cost = list, sell = suggested or 25% markup (API default)
          sell_price:
            line.suggested_resale_price != null
              ? Number(line.suggested_resale_price)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      if (data.alreadyImported) {
        toast.message('Already in your catalogue', {
          description: data.product?.name,
        });
      } else {
        toast.success(
          `Imported ${data.product?.name} — cost ${formatMoney(data.pricing?.cost_price, data.pricing?.currency || 'ZAR')}, sell ${formatMoney(data.pricing?.sell_price, data.pricing?.currency || 'ZAR')}`
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <ConnectionsPage>
      <RelationshipHeader
        nav={<ConnectionsNav />}
        eyebrow="Network commercial terms"
        title="Pricing"
        titleAccent="agreements"
        description="Set list prices for connected buyers (wholesale). Sales companies import those SKUs into their catalogue — with manufacturer specs — then on-sell at a higher price to the next company in the chain."
        action={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            <Plus className="w-4 h-4" /> New agreement
          </button>
        }
      />

      <SectionLabel>Chain example</SectionLabel>
      <Panel className="mb-8">
        <div className="px-5 py-4 grid md:grid-cols-3 gap-4 text-sm">
          <Step
            n="1"
            title="You sell wholesale"
            body="Create an agreement with your sales company — attach products, list prices, and optional suggested resale."
          />
          <Step
            n="2"
            title="Sales co imports"
            body="They import SKUs into Inventory. Cost = your list price. Spec sheets travel with the product."
          />
          <Step
            n="3"
            title="They on-sell higher"
            body="They create a new agreement for the next buyer at a higher list price — same product, new margin."
          />
        </div>
      </Panel>

      {showCreate && (
        <Panel className="mb-8" title="New pricing agreement (you are the seller)">
          <div className="px-5 py-5 space-y-4">
            {peers.length === 0 ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                Connect companies first in{' '}
                <Link href="/dashboard/connections" className="underline font-semibold">
                  Network
                </Link>{' '}
                or{' '}
                <Link href="/dashboard/suppliers/discover" className="underline font-semibold">
                  Discover
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Buyer company *</span>
                    <select
                      className="input w-full !py-2.5 !text-sm mt-1"
                      value={form.buyerProfileId}
                      onChange={(e) => setForm({ ...form, buyerProfileId: e.target.value })}
                    >
                      <option value="">Select connected company…</option>
                      {peers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.trading_name}
                          {p.role ? ` (${p.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Title *</span>
                    <input
                      className="input w-full !py-2.5 !text-sm mt-1"
                      placeholder="e.g. 2026 Wholesale list — Sales Co"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Currency</span>
                    <input
                      className="input w-full !py-2.5 !text-sm mt-1"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Payment terms</span>
                    <input
                      className="input w-full !py-2.5 !text-sm mt-1"
                      value={form.payment_terms}
                      onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Effective from</span>
                    <input
                      type="date"
                      className="input w-full !py-2.5 !text-sm mt-1"
                      value={form.effective_from}
                      onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold text-neutral-500">Effective to</span>
                    <input
                      type="date"
                      className="input w-full !py-2.5 !text-sm mt-1"
                      value={form.effective_to}
                      onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Price list lines
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#0077b6]"
                      onClick={() => setLines((p) => [...p, emptyLine()])}
                    >
                      + Add line
                    </button>
                  </div>
                  <div className="space-y-3">
                    {lines.map((l) => (
                      <div
                        key={l.key}
                        className="grid sm:grid-cols-12 gap-2 p-3 rounded-2xl border border-neutral-100 bg-neutral-50/50"
                      >
                        <select
                          className="input !py-2 !text-xs sm:col-span-3"
                          value={l.seller_product_id}
                          onChange={(e) => pickProduct(l.key, e.target.value)}
                        >
                          <option value="">Pick catalogue product…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.sku ? ` (${p.sku})` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input !py-2 !text-xs sm:col-span-3"
                          placeholder="Product name *"
                          value={l.product_name}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key ? { ...x, product_name: e.target.value } : x
                              )
                            )
                          }
                        />
                        <input
                          className="input !py-2 !text-xs sm:col-span-1"
                          placeholder="SKU"
                          value={l.sku}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key ? { ...x, sku: e.target.value } : x
                              )
                            )
                          }
                        />
                        <input
                          className="input !py-2 !text-xs sm:col-span-1"
                          placeholder="List price *"
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.list_price}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key ? { ...x, list_price: e.target.value } : x
                              )
                            )
                          }
                        />
                        <input
                          className="input !py-2 !text-xs sm:col-span-1"
                          placeholder="Min qty"
                          type="number"
                          min="0"
                          value={l.min_qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key ? { ...x, min_qty: e.target.value } : x
                              )
                            )
                          }
                        />
                        <input
                          className="input !py-2 !text-xs sm:col-span-2"
                          placeholder="Suggested resale"
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.suggested_resale_price}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key
                                  ? { ...x, suggested_resale_price: e.target.value }
                                  : x
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          className="sm:col-span-1 text-red-500 hover:text-red-700 flex items-center justify-center"
                          onClick={() =>
                            setLines((prev) =>
                              prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {l.specs_sheet_url && (
                          <div className="sm:col-span-12 text-[11px] text-emerald-700 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Specs will attach: {l.specs_sheet_name || 'sheet'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  <button
                    type="button"
                    className="btn-secondary !py-2.5 !px-5 text-sm"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void create()}
                    className="btn-primary !py-2.5 !px-5 text-sm"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Save & activate
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </Panel>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search agreements or products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              { key: 'selling', label: 'I sell', icon: ArrowUpRight, count: selling.length },
              { key: 'buying', label: 'I buy', icon: ArrowDownLeft, count: buying.length },
              { key: 'import', label: 'Import to catalogue', icon: Download, count: incoming.length },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                tab === t.key
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-neutral-200 bg-white text-neutral-600'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="tabular-nums opacity-80">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'import' ? (
        <Panel title="Import from your buy-side price lists">
          {filteredIncoming.length === 0 ? (
            <Empty
              title="No incoming list prices yet"
              body="Ask your supplier company to create a pricing agreement with you as the buyer — then import SKUs here with specs."
              href="/dashboard/suppliers/discover"
              hrefLabel="Find suppliers"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filteredIncoming.map((l) => (
                <li
                  key={l.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 flex flex-wrap items-center gap-2">
                      <Package className="w-4 h-4 text-[#00b4d8]" />
                      {l.product_name}
                      {l.sku && (
                        <span className="text-xs font-mono text-neutral-500">{l.sku}</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      From <strong>{l.seller_name || 'Seller'}</strong>
                      {l.agreement_title ? ` · ${l.agreement_title}` : ''}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      <span className="font-semibold text-slate-800">
                        List {formatMoney(l.list_price, l.currency || 'ZAR')}
                      </span>
                      {l.suggested_resale_price != null && (
                        <span className="text-emerald-700">
                          Suggested resale{' '}
                          {formatMoney(l.suggested_resale_price, l.currency || 'ZAR')}
                        </span>
                      )}
                      {l.specs_sheet_url && (
                        <a
                          href={l.specs_sheet_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#0077b6] font-medium"
                        >
                          <FileText className="w-3 h-3" /> Specs
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={importingId === l.id}
                    onClick={() => void importLine(l)}
                    className="btn-primary !py-2 !px-4 text-xs shrink-0"
                  >
                    {importingId === l.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" /> Import to catalogue
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-neutral-100 text-xs text-neutral-500">
            Import sets <strong>cost</strong> = list price and <strong>sell</strong> = suggested
            resale (or +25%). Spec sheets copy to your product so you can on-sell with manufacturer
            docs — edit sell price or replace the sheet under Inventory → Products.
          </div>
        </Panel>
      ) : (
        <Panel title={tab === 'selling' ? 'Agreements you sell under' : 'Agreements you buy under'}>
          {(tab === 'selling' ? filteredSelling : filteredBuying).length === 0 ? (
            <Empty
              title="No agreements here"
              body={
                tab === 'selling'
                  ? 'Create a wholesale price list for a connected sales company.'
                  : 'When a supplier activates a price list for your company, it appears here.'
              }
              href={tab === 'selling' ? undefined : '/dashboard/suppliers/discover'}
              hrefLabel="Discover suppliers"
              onAction={tab === 'selling' ? () => setShowCreate(true) : undefined}
              actionLabel="New agreement"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {(tab === 'selling' ? filteredSelling : filteredBuying).map((a) => (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{a.title}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${agreementStatusClass(a.status)}`}
                        >
                          {a.status}
                        </span>
                        {a.agreement_number && (
                          <span className="text-[10px] font-mono text-neutral-400">
                            {a.agreement_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {tab === 'selling' ? (
                          <>
                            Buyer: <strong>{a.buyer_name || `#${a.buyer_profile_id}`}</strong>
                          </>
                        ) : (
                          <>
                            Seller: <strong>{a.seller_name || `#${a.seller_profile_id}`}</strong>
                          </>
                        )}
                        {a.payment_terms ? ` · ${a.payment_terms}` : ''}
                        {a.currency ? ` · ${a.currency}` : ''}
                        {' · '}
                        {a.line_count ?? a.lines?.length ?? 0} SKUs
                      </div>
                      {a.lines && a.lines.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-neutral-400">
                                <th className="pr-3 pb-1 font-semibold">Product</th>
                                <th className="pr-3 pb-1 font-semibold">SKU</th>
                                <th className="pr-3 pb-1 font-semibold text-right">List</th>
                                <th className="pr-3 pb-1 font-semibold text-right">Resale hint</th>
                                <th className="pb-1 font-semibold">Specs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.lines.slice(0, detail?.id === a.id ? 999 : 5).map((l) => (
                                <tr key={l.id || l.product_name} className="border-t border-neutral-50">
                                  <td className="py-1.5 pr-3 font-medium text-slate-700">
                                    {l.product_name}
                                  </td>
                                  <td className="py-1.5 pr-3 font-mono text-neutral-500">
                                    {l.sku || '—'}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">
                                    {formatMoney(l.list_price, l.currency || a.currency || 'ZAR')}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700">
                                    {l.suggested_resale_price != null
                                      ? formatMoney(
                                          l.suggested_resale_price,
                                          l.currency || a.currency || 'ZAR'
                                        )
                                      : '—'}
                                  </td>
                                  <td className="py-1.5">
                                    {l.specs_sheet_url ? (
                                      <a
                                        href={l.specs_sheet_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[#0077b6] inline-flex items-center gap-0.5"
                                      >
                                        <FileText className="w-3 h-3" /> View
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {(a.lines?.length || 0) > 5 && detail?.id !== a.id && (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-[#0077b6] mt-1"
                              onClick={() => setDetail(a)}
                            >
                              Show all {a.lines?.length} lines
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {tab === 'selling' && a.status === 'draft' && (
                        <button
                          type="button"
                          className="btn-primary !py-1.5 !px-3 text-xs"
                          onClick={() => void setStatus(a.id, 'active')}
                        >
                          Activate
                        </button>
                      )}
                      {tab === 'selling' && a.status === 'active' && (
                        <button
                          type="button"
                          className="btn-secondary !py-1.5 !px-3 text-xs"
                          onClick={() => void setStatus(a.id, 'suspended')}
                        >
                          Suspend
                        </button>
                      )}
                      {tab === 'selling' && a.status === 'suspended' && (
                        <button
                          type="button"
                          className="btn-primary !py-1.5 !px-3 text-xs"
                          onClick={() => void setStatus(a.id, 'active')}
                        >
                          Restore
                        </button>
                      )}
                      {tab === 'buying' && a.status === 'active' && (
                        <button
                          type="button"
                          className="btn-secondary !py-1.5 !px-3 text-xs"
                          onClick={() => setTab('import')}
                        >
                          <Download className="w-3.5 h-3.5" /> Import SKUs
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        <Link
          href="/dashboard/inventory/products"
          className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors"
        >
          <Package className="w-5 h-5 text-[#00b4d8] mb-2" />
          <div className="text-sm font-semibold">Product catalogue</div>
          <div className="text-xs text-neutral-500">Edit sell prices & upload sales specs</div>
        </Link>
        <Link
          href="/dashboard/suppliers/po"
          className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors"
        >
          <ArrowDownLeft className="w-5 h-5 text-[#00b4d8] mb-2" />
          <div className="text-sm font-semibold">Raise PO at list price</div>
          <div className="text-xs text-neutral-500">Agreed unit prices on supplier orders</div>
        </Link>
        <Link
          href="/dashboard/connections/marketplace/sell"
          className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 transition-colors"
        >
          <ArrowUpRight className="w-5 h-5 text-[#00b4d8] mb-2" />
          <div className="text-sm font-semibold">List on marketplace</div>
          <div className="text-xs text-neutral-500">Publish on-sell prices to the network</div>
        </Link>
      </div>
    </ConnectionsPage>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#00b4d8]/15 text-[#0077b6] font-bold text-sm flex items-center justify-center shrink-0">
        {n}
      </div>
      <div>
        <div className="font-semibold text-slate-800 text-sm">{title}</div>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Empty({
  title,
  body,
  href,
  hrefLabel,
  onAction,
  actionLabel,
}: {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="p-12 text-center">
      <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
      <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
      <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">{body}</p>
      {onAction && actionLabel && (
        <button type="button" onClick={onAction} className="btn-primary !py-2.5 !px-5 text-sm">
          {actionLabel}
        </button>
      )}
      {href && hrefLabel && (
        <Link href={href} className="btn-secondary !py-2.5 !px-5 text-sm inline-flex">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}
