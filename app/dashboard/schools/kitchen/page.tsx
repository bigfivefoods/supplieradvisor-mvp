'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  PackagePlus,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  ShoppingCart,
  CalendarDays,
  Save,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  formatStockQty,
  requiredOrderQty,
  roundStockQty,
} from '@/lib/schools/kitchen-stock-plan';

type Product = {
  id: number;
  name: string;
  brand_name: string;
  uom?: string | null;
  image_url?: string | null;
  category?: string | null;
};

type OpenOrder = {
  id: number;
  po_number?: string | null;
  status?: string;
  order_date?: string;
  total_amount?: number;
  lines?: Array<{
    approved_product_id?: number;
    product_name?: string;
    brand_name?: string;
    qty?: number;
    uom?: string;
  }>;
  isp_profile_id?: number | null;
};

type GrnLine = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  qty: string;
  uom: string;
};

type PlanProduct = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  uom: string;
  category?: string;
  daily_usage: number;
  weekly_usage: number;
  qty_on_hand: number;
  days_on_hand: number | null;
  target_qty: number;
  reorder_level: number;
  suggested_order_qty: number;
  status: string;
  message: string;
};

type CoverPolicy = {
  cover_days: number;
  reorder_cover_days: number;
  lead_time_days: number;
};

type LevelRow = {
  approved_product_id: number;
  product_name: string;
  brand_name: string;
  category: string;
  uom: string;
  qty_on_hand: string;
  reorder_level: string;
  target_level: string;
  /** School-editable qty that lands on the suggested PO (defaults to required cover gap) */
  order_qty: string;
  stock_id?: number;
  low_stock?: boolean;
  daily_usage?: number;
  days_on_hand?: number | null;
  suggested_order_qty?: number;
  cover_status?: string;
  cover_message?: string;
};

type LevelSortKey =
  | 'product'
  | 'daily_usage'
  | 'days_on_hand'
  | 'qty_on_hand'
  | 'reorder_level'
  | 'target_level'
  | 'suggested_order_qty'
  | 'order_qty'
  | 'uom';

const SUGGESTED_PO_KEY = 'nsnp_kitchen_suggested_po';

export default function KitchenPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<Array<Record<string, unknown>>>([]);
  const [lowStock, setLowStock] = useState<Array<Record<string, unknown>>>([]);
  const [receipts, setReceipts] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [poId, setPoId] = useState('');
  const [lines, setLines] = useState<GrnLine[]>([]);
  const [receiving, setReceiving] = useState(false);
  const [levelRows, setLevelRows] = useState<LevelRow[]>([]);
  const [savingLevels, setSavingLevels] = useState(false);
  const [showLevels, setShowLevels] = useState(true);
  const [coverDays, setCoverDays] = useState('14');
  const [reorderDays, setReorderDays] = useState('5');
  const [leadDays, setLeadDays] = useState('3');
  const [learners, setLearners] = useState(0);
  const [stockPlan, setStockPlan] = useState<{
    products: PlanProduct[];
    summary?: {
      products_with_demand: number;
      reorder_count: number;
      critical_count: number;
      suggested_lines: number;
    };
    policy?: CoverPolicy;
  } | null>(null);
  const [savingCover, setSavingCover] = useState(false);
  const [recipesCount, setRecipesCount] = useState(0);
  const [levelSort, setLevelSort] = useState<{
    key: LevelSortKey;
    dir: 'asc' | 'desc';
  }>({ key: 'product', dir: 'asc' });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  /** School can tick any stock lines to build a PO (not only suggested) */
  const [orderSelect, setOrderSelect] = useState<Set<number>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, pRes] = await Promise.all([
        fetch(`/api/schools/kitchen?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/approved?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
      ]);
      const k = await kRes.json();
      const p = await pRes.json();
      if (!kRes.ok) throw new Error(k.error || 'Failed');
      setStock(k.stock || []);
      setLowStock(k.lowStock || []);
      setReceipts(k.receipts || []);
      setOpenOrders(k.openOrders || []);
      setProducts(p.products || []);
      setLearners(Number(k.learners) || 0);
      setRecipesCount(Number(k.recipes_count) || 0);
      if (k.cover_policy) {
        setCoverDays(String(k.cover_policy.cover_days ?? 14));
        setReorderDays(String(k.cover_policy.reorder_cover_days ?? 5));
        setLeadDays(String(k.cover_policy.lead_time_days ?? 3));
      }
      setStockPlan(k.stock_plan || null);

      const planByPid = new Map<number, PlanProduct>();
      for (const row of k.stock_plan?.products || []) {
        planByPid.set(Number(row.approved_product_id), row);
      }

      const stockByPid = new Map<number, Record<string, unknown>>();
      for (const s of k.stock || []) {
        const pid = Number(s.approved_product_id);
        if (Number.isFinite(pid)) stockByPid.set(pid, s);
      }
      const rows: LevelRow[] = (p.products || []).map((prod: Product) => {
        const s = stockByPid.get(prod.id);
        const plan = planByPid.get(prod.id);
        const uom = prod.uom || 'kg';
        const onHandRaw =
          s?.qty_on_hand != null ? Number(s.qty_on_hand) : 0;
        const reorderRaw =
          s?.reorder_level != null
            ? Number(s.reorder_level)
            : plan?.reorder_level != null
              ? Number(plan.reorder_level)
              : null;
        const targetRaw =
          s?.target_level != null
            ? Number(s.target_level)
            : plan?.target_qty != null
              ? Number(plan.target_qty)
              : null;
        const coverStatus = plan?.status || String(s?.cover_status || '');
        const required = requiredOrderQty({
          qty_on_hand: onHandRaw,
          target_qty: targetRaw,
          reorder_level: reorderRaw,
          daily_usage: plan?.daily_usage ?? (Number(s?.daily_usage) || 0),
          reorder_cover_days: k.cover_policy?.reorder_cover_days,
          status: coverStatus,
          uom,
        });
        const suggestRaw =
          plan?.suggested_order_qty ??
          (Number(s?.suggested_order_qty) || 0) ||
          required;
        const suggestFinal = roundStockQty(suggestRaw, uom, 'ceil') || required;
        return {
          approved_product_id: prod.id,
          product_name: prod.name,
          brand_name: prod.brand_name,
          category: String(
            prod.category || plan?.category || 'Uncategorised'
          ).trim() || 'Uncategorised',
          uom,
          qty_on_hand: formatStockQty(onHandRaw, uom, 'round'),
          reorder_level:
            reorderRaw != null && Number.isFinite(reorderRaw)
              ? formatStockQty(reorderRaw, uom, 'ceil')
              : '',
          target_level:
            targetRaw != null && Number.isFinite(targetRaw)
              ? formatStockQty(targetRaw, uom, 'ceil')
              : '',
          order_qty: suggestFinal > 0 ? formatStockQty(suggestFinal, uom, 'ceil') : '',
          stock_id: s?.id != null ? Number(s.id) : undefined,
          low_stock: Boolean(s?.low_stock),
          daily_usage: plan?.daily_usage ?? (Number(s?.daily_usage) || 0),
          days_on_hand:
            plan?.days_on_hand ??
            (s?.days_on_hand != null ? Number(s.days_on_hand) : null),
          suggested_order_qty: suggestFinal,
          cover_status: coverStatus,
          cover_message: plan?.message || String(s?.cover_message || ''),
        };
      });
      for (const s of k.stock || []) {
        const pid = Number(s.approved_product_id);
        if (!rows.some((r) => r.approved_product_id === pid)) {
          const plan = planByPid.get(pid);
          const uom = String(s.uom || 'kg');
          const coverStatus = plan?.status || String(s.cover_status || '');
          const required = requiredOrderQty({
            qty_on_hand: s.qty_on_hand ?? 0,
            target_qty: s.target_level ?? plan?.target_qty,
            reorder_level: s.reorder_level ?? plan?.reorder_level,
            daily_usage: plan?.daily_usage ?? 0,
            reorder_cover_days: k.cover_policy?.reorder_cover_days,
            status: coverStatus,
            uom,
          });
          const suggestFinal =
            roundStockQty(plan?.suggested_order_qty ?? 0, uom, 'ceil') ||
            required;
          rows.push({
            approved_product_id: pid,
            product_name: String(s.product_name || ''),
            brand_name: String(s.brand_name || ''),
            category: String(
              s.category || plan?.category || 'Uncategorised'
            ).trim() || 'Uncategorised',
            uom,
            qty_on_hand: formatStockQty(s.qty_on_hand ?? 0, uom, 'round'),
            reorder_level:
              s.reorder_level != null
                ? formatStockQty(s.reorder_level, uom, 'ceil')
                : '',
            target_level:
              s.target_level != null
                ? formatStockQty(s.target_level, uom, 'ceil')
                : plan?.target_qty != null
                  ? formatStockQty(plan.target_qty, uom, 'ceil')
                  : '',
            order_qty:
              suggestFinal > 0 ? formatStockQty(suggestFinal, uom, 'ceil') : '',
            stock_id: Number(s.id),
            low_stock: Boolean(s.low_stock),
            daily_usage: plan?.daily_usage ?? 0,
            days_on_hand: plan?.days_on_hand ?? null,
            suggested_order_qty: suggestFinal,
            cover_status: coverStatus,
            cover_message: plan?.message,
          });
        }
      }
      setLevelRows(rows);
      setCategoryFilter('all');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPo = useMemo(
    () => openOrders.find((o) => o.id === Number(poId)) || null,
    [openOrders, poId]
  );

  useEffect(() => {
    if (!selectedPo) return;
    const poLines = Array.isArray(selectedPo.lines) ? selectedPo.lines : [];
    setLines(
      poLines
        .filter((l) => Number(l.approved_product_id) > 0)
        .map((l) => ({
          approved_product_id: Number(l.approved_product_id),
          product_name: String(l.product_name || ''),
          brand_name: String(l.brand_name || ''),
          qty: String(l.qty ?? 1),
          uom: String(l.uom || 'kg'),
        }))
    );
  }, [selectedPo]);

  /** Lines with a positive suggested PO qty (may include ok items topping up to target) */
  const suggestedLines = useMemo(
    () =>
      (stockPlan?.products || []).filter((p) => p.suggested_order_qty > 0),
    [stockPlan]
  );

  /** Products flagged reorder/critical — always orderable even if suggest was rounded to 0 */
  const reorderPlanLines = useMemo(
    () =>
      (stockPlan?.products || []).filter(
        (p) => p.status === 'reorder' || p.status === 'critical'
      ),
    [stockPlan]
  );

  const addBlankLine = () => {
    const first = products[0];
    if (!first)
      return toast.error('No approved products — join DBE catalogue first');
    setLines((prev) => [
      ...prev,
      {
        approved_product_id: first.id,
        product_name: first.name,
        brand_name: first.brand_name,
        qty: '1',
        uom: first.uom || 'kg',
      },
    ]);
  };

  const receive = async () => {
    const payloadLines = lines
      .map((l) => ({
        approved_product_id: l.approved_product_id,
        product_name: l.product_name,
        brand_name: l.brand_name,
        qty: Number(l.qty),
        uom: l.uom,
      }))
      .filter((l) => l.qty > 0 && l.approved_product_id > 0);

    if (!payloadLines.length) {
      return toast.error('Add at least one line with quantity');
    }

    setReceiving(true);
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'receive',
          po_id: poId ? Number(poId) : null,
          isp_profile_id: selectedPo?.isp_profile_id || null,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GRN rejected');
      toast.success(
        data.po_status
          ? `GRN posted · PO → ${data.po_status}`
          : 'Received into kitchen (approved brands only)'
      );
      setLines([]);
      setPoId('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setReceiving(false);
    }
  };

  const saveCoverPolicy = async (applyLevels = true) => {
    setSavingCover(true);
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'set_cover_policy',
          cover_days: Number(coverDays) || 14,
          reorder_cover_days: Number(reorderDays) || 5,
          lead_time_days: Number(leadDays) || 3,
          apply_levels: applyLevels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Cover policy saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingCover(false);
    }
  };

  const saveLevels = async () => {
    setSavingLevels(true);
    try {
      const linesPayload = levelRows
        .filter(
          (r) =>
            r.reorder_level !== '' ||
            r.target_level !== '' ||
            Number(r.qty_on_hand) > 0 ||
            r.stock_id
        )
        .map((r) => ({
          approved_product_id: r.approved_product_id,
          product_name: r.product_name,
          brand_name: r.brand_name,
          uom: r.uom,
          qty_on_hand:
            r.qty_on_hand === ''
              ? undefined
              : roundStockQty(r.qty_on_hand, r.uom, 'round'),
          reorder_level:
            r.reorder_level === ''
              ? null
              : roundStockQty(r.reorder_level, r.uom, 'ceil'),
          target_level:
            r.target_level === ''
              ? null
              : roundStockQty(r.target_level, r.uom, 'ceil'),
        }));
      if (!linesPayload.length) {
        return toast.error('Set at least one on-hand or reorder level');
      }
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'set_levels',
          lines: linesPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(data.message || 'Inventory levels saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingLevels(false);
    }
  };

  /**
   * Qty for PO line: school-edited order_qty if set, else required cover gap
   * (target hold − on hand) for days-cover restoration.
   */
  const orderQtyForRow = (r: {
    order_qty?: string | number | null;
    suggested_order_qty?: number;
    target_qty?: number;
    target_level?: string | number;
    qty_on_hand?: number | string;
    reorder_level?: number | string;
    daily_usage?: number;
    status?: string;
    cover_status?: string;
    uom: string;
  }) => {
    const edited = Number(r.order_qty);
    if (Number.isFinite(edited) && edited > 0) {
      return roundStockQty(edited, r.uom, 'ceil') || 1;
    }
    return (
      requiredOrderQty({
        qty_on_hand: r.qty_on_hand,
        target_qty:
          r.target_qty ??
          (r.target_level !== '' && r.target_level != null
            ? Number(r.target_level)
            : 0),
        reorder_level: r.reorder_level,
        daily_usage: r.daily_usage,
        reorder_cover_days: stockPlan?.policy?.reorder_cover_days,
        status: r.status || r.cover_status,
        uom: r.uom,
      }) ||
      roundStockQty(r.suggested_order_qty ?? 0, r.uom, 'ceil') ||
      1
    );
  };

  /** Recompute suggested + draft order qty from on-hand / target / cover status */
  const recomputeRowOrderQty = (row: LevelRow): Partial<LevelRow> => {
    const required = requiredOrderQty({
      qty_on_hand: row.qty_on_hand,
      target_qty: row.target_level,
      reorder_level: row.reorder_level,
      daily_usage: row.daily_usage,
      reorder_cover_days: stockPlan?.policy?.reorder_cover_days,
      status: row.cover_status,
      uom: row.uom,
    });
    return {
      suggested_order_qty: required,
      order_qty: required > 0 ? formatStockQty(required, row.uom, 'ceil') : '',
    };
  };

  const pushOrderPayload = (
    rows: Array<{
      approved_product_id: number;
      product_name: string;
      brand_name: string;
      uom: string;
      qty: number;
    }>
  ) => {
    const payload = rows
      .map((r) => ({
        approved_product_id: r.approved_product_id,
        product_name: r.product_name,
        brand_name: r.brand_name,
        qty: roundStockQty(r.qty, r.uom, 'ceil') || 0,
        uom: r.uom,
        unit_price: 0,
      }))
      .filter((l) => l.qty > 0 && l.approved_product_id > 0);
    if (!payload.length) {
      return toast.message(
        'No order lines to send — set Order qty (required cover gap) and try again'
      );
    }
    try {
      sessionStorage.setItem(SUGGESTED_PO_KEY, JSON.stringify(payload));
    } catch {
      /* soft */
    }
    toast.success(
      `${payload.length} line(s) with required cover levels ready on Orders — adjust qty up/down if needed, pick SP & delivery date, then submit`
    );
    window.location.href = '/dashboard/schools/orders?suggested=1';
  };

  const orderSuggested = (mode: 'suggested' | 'reorder' | 'selected' | 'all') => {
    const planById = new Map(
      (stockPlan?.products || []).map((p) => [p.approved_product_id, p])
    );
    const rowById = new Map(
      levelRows.map((r) => [r.approved_product_id, r] as const)
    );

    if (mode === 'selected') {
      if (!orderSelect.size) {
        return toast.message(
          'Tick products in the inventory list (or use Order on a row), then try again'
        );
      }
      const rows = levelRows
        .filter((r) => orderSelect.has(r.approved_product_id))
        .map((r) => {
          const plan = planById.get(r.approved_product_id);
          return {
            approved_product_id: r.approved_product_id,
            product_name: r.product_name,
            brand_name: r.brand_name,
            uom: r.uom,
            qty: orderQtyForRow({
              ...r,
              suggested_order_qty:
                plan?.suggested_order_qty ?? r.suggested_order_qty,
              target_qty: plan?.target_qty ?? (Number(r.target_level) || 0),
              status: plan?.status || r.cover_status,
            }),
          };
        });
      return pushOrderPayload(rows);
    }

    if (mode === 'all') {
      if (!levelRows.length) {
        return toast.message('No catalogue products to order');
      }
      const rows = levelRows.map((r) => {
        const plan = planById.get(r.approved_product_id);
        return {
          approved_product_id: r.approved_product_id,
          product_name: r.product_name,
          brand_name: r.brand_name,
          uom: r.uom,
          qty: orderQtyForRow({
            ...r,
            suggested_order_qty:
              plan?.suggested_order_qty ?? r.suggested_order_qty,
            target_qty: plan?.target_qty ?? (Number(r.target_level) || 0),
            status: plan?.status || r.cover_status,
          }),
        };
      });
      return pushOrderPayload(rows);
    }

    // suggested | reorder — prefer kitchen rows (editable order_qty) + plan
    const sourceIds =
      mode === 'reorder'
        ? reorderPlanLines.map((p) => p.approved_product_id)
        : suggestedLines.length
          ? suggestedLines.map((p) => p.approved_product_id)
          : reorderPlanLines.map((p) => p.approved_product_id);

    // Also include any low-stock rows from the level table even if plan missed them
    if (mode === 'suggested' || mode === 'reorder') {
      for (const r of levelRows) {
        const low =
          r.cover_status === 'reorder' ||
          r.cover_status === 'critical' ||
          r.low_stock ||
          (Number(r.suggested_order_qty) || 0) > 0 ||
          (Number(r.order_qty) || 0) > 0;
        if (low && !sourceIds.includes(r.approved_product_id)) {
          if (mode === 'reorder') {
            if (
              r.cover_status === 'reorder' ||
              r.cover_status === 'critical' ||
              r.low_stock
            ) {
              sourceIds.push(r.approved_product_id);
            }
          } else if ((Number(r.order_qty) || Number(r.suggested_order_qty) || 0) > 0) {
            sourceIds.push(r.approved_product_id);
          }
        }
      }
    }

    if (!sourceIds.length) {
      return toast.message(
        mode === 'reorder'
          ? 'Nothing at reorder point — select products below and use Order selected, or Order any product'
          : 'No auto-suggested lines — select products in the list and Order selected (any product is allowed)'
      );
    }

    pushOrderPayload(
      sourceIds.map((pid) => {
        const r = rowById.get(pid);
        const plan = planById.get(pid);
        if (r) {
          return {
            approved_product_id: r.approved_product_id,
            product_name: r.product_name,
            brand_name: r.brand_name,
            uom: r.uom,
            qty: orderQtyForRow({
              ...r,
              suggested_order_qty:
                plan?.suggested_order_qty ?? r.suggested_order_qty,
              target_qty: plan?.target_qty ?? (Number(r.target_level) || 0),
              status: plan?.status || r.cover_status,
            }),
          };
        }
        // Fallback from plan only
        const p = plan!;
        return {
          approved_product_id: p.approved_product_id,
          product_name: p.product_name,
          brand_name: p.brand_name,
          uom: p.uom,
          qty: orderQtyForRow({
            suggested_order_qty: p.suggested_order_qty,
            target_qty: p.target_qty,
            qty_on_hand: p.qty_on_hand,
            reorder_level: p.reorder_level,
            daily_usage: p.daily_usage,
            status: p.status,
            uom: p.uom,
          }),
        };
      })
    );
  };

  const toggleOrderSelect = (pid: number) => {
    setOrderSelect((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const orderOneProduct = (r: LevelRow) => {
    const plan = (stockPlan?.products || []).find(
      (p) => p.approved_product_id === r.approved_product_id
    );
    pushOrderPayload([
      {
        approved_product_id: r.approved_product_id,
        product_name: r.product_name,
        brand_name: r.brand_name,
        uom: r.uom,
        qty: orderQtyForRow({
          ...r,
          suggested_order_qty:
            plan?.suggested_order_qty ?? r.suggested_order_qty,
          target_qty: plan?.target_qty ?? (Number(r.target_level) || 0),
          status: plan?.status || r.cover_status,
        }),
      },
    ]);
  };

  const nudgeOrderQty = (pid: number, delta: number) => {
    setLevelRows((prev) =>
      prev.map((x) => {
        if (x.approved_product_id !== pid) return x;
        const cur = Number(x.order_qty) || 0;
        const next = Math.max(0, cur + delta);
        return {
          ...x,
          order_qty: next > 0 ? formatStockQty(next, x.uom, 'ceil') : '',
        };
      })
    );
  };

  const adjust = async (
    stockId: number,
    action: 'issue' | 'waste',
    defaultQty = 1
  ) => {
    const raw = window.prompt(
      action === 'waste'
        ? 'Waste quantity to write off'
        : 'Issue quantity to kitchen/serve',
      String(defaultQty)
    );
    if (raw == null) return;
    const q = Number(raw);
    if (!(q > 0)) return toast.error('Enter a positive quantity');
    try {
      const res = await fetch('/api/schools/kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action,
          stock_id: stockId,
          qty: q,
          reason: action === 'waste' ? 'kitchen_waste' : 'serve_day',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'waste' ? 'Waste logged' : 'Stock issued');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const summary = stockPlan?.summary;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of levelRows) {
      set.add(r.category || 'Uncategorised');
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [levelRows]);

  const toggleLevelSort = (key: LevelSortKey) => {
    setLevelSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'product' || key === 'uom' ? 'asc' : 'desc' }
    );
  };

  const patchLevelRow = (
    productId: number,
    patch: Partial<LevelRow> | ((row: LevelRow) => Partial<LevelRow>)
  ) => {
    setLevelRows((prev) =>
      prev.map((x) => {
        if (x.approved_product_id !== productId) return x;
        const p = typeof patch === 'function' ? patch(x) : patch;
        return { ...x, ...p };
      })
    );
  };

  const levelRowValue = (r: LevelRow, key: LevelSortKey): string | number => {
    switch (key) {
      case 'product':
        return `${r.product_name} ${r.brand_name}`.toLowerCase();
      case 'daily_usage':
        return Number(r.daily_usage) || 0;
      case 'days_on_hand':
        return r.days_on_hand == null ? -1 : Number(r.days_on_hand);
      case 'qty_on_hand':
        return Number(r.qty_on_hand) || 0;
      case 'reorder_level':
        return r.reorder_level === '' ? -1 : Number(r.reorder_level) || 0;
      case 'target_level':
        return r.target_level === '' ? -1 : Number(r.target_level) || 0;
      case 'suggested_order_qty':
        return Number(r.suggested_order_qty) || 0;
      case 'order_qty':
        return Number(r.order_qty) || 0;
      case 'uom':
        return String(r.uom || '').toLowerCase();
      default:
        return 0;
    }
  };

  const sortedFilteredLevels = useMemo(() => {
    let rows = [...levelRows];
    if (categoryFilter !== 'all') {
      rows = rows.filter(
        (r) => (r.category || 'Uncategorised') === categoryFilter
      );
    }
    const { key, dir } = levelSort;
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      // Keep category groups together when not filtering one category
      if (categoryFilter === 'all') {
        const ca = (a.category || 'Uncategorised').toLowerCase();
        const cb = (b.category || 'Uncategorised').toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb);
      }
      const va = levelRowValue(a, key);
      const vb = levelRowValue(b, key);
      if (typeof va === 'string' && typeof vb === 'string') {
        return mult * va.localeCompare(vb);
      }
      return mult * ((Number(va) || 0) - (Number(vb) || 0));
    });
    return rows;
  }, [levelRows, categoryFilter, levelSort]);

  const levelsByCategory = useMemo(() => {
    const groups: Array<{ category: string; rows: LevelRow[] }> = [];
    const map = new Map<string, LevelRow[]>();
    for (const r of sortedFilteredLevels) {
      const cat = r.category || 'Uncategorised';
      if (!map.has(cat)) {
        map.set(cat, []);
        groups.push({ category: cat, rows: map.get(cat)! });
      }
      map.get(cat)!.push(r);
    }
    return groups;
  }, [sortedFilteredLevels]);

  const SortTh = ({
    label,
    sortKey,
    className = '',
  }: {
    label: string;
    sortKey: LevelSortKey;
    className?: string;
  }) => {
    const active = levelSort.key === sortKey;
    return (
      <th className={`px-2 py-2 ${className}`}>
        <button
          type="button"
          onClick={() => toggleLevelSort(sortKey)}
          className={`inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider hover:text-slate-800 ${
            active ? 'text-sky-800' : 'text-slate-400'
          }`}
          title={`Sort by ${label}`}
        >
          {label}
          <span className="tabular-nums text-[9px] opacity-80">
            {active ? (levelSort.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen stock"
        titleAccent="Levels · GRN"
        description="Estimated stock holding from DBE menu × learners. When days cover is low, suggested PO lines use the required qty to restore target hold — edit Order qty up or down to match school needs."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/schools/orders"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Orders
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Cover policy */}
      <div className="mb-4 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-black inline-flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-700" />
              Days of stock to hold
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 max-w-xl">
              Based on programme recipes ×{' '}
              <strong>{learners.toLocaleString('en-ZA')}</strong> NSNP learners
              {recipesCount
                ? ` · ${recipesCount} active recipe(s)`
                : ' · no recipes yet — join DBE menu/recipes for demand'}.
              Target holding = daily use × cover days.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            {summary ? (
              <>
                <span className="font-bold text-slate-800">
                  {summary.products_with_demand}
                </span>{' '}
                products on menu ·{' '}
                <span className="font-bold text-amber-800">
                  {summary.reorder_count}
                </span>{' '}
                reorder ·{' '}
                <span className="font-bold text-rose-700">
                  {summary.critical_count}
                </span>{' '}
                critical
              </>
            ) : null}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Hold (cover days)
            </span>
            <input
              type="number"
              min={1}
              max={90}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-black tabular-nums"
              value={coverDays}
              onChange={(e) => setCoverDays(e.target.value)}
            />
            <span className="text-[10px] text-slate-400">e.g. 14 days</span>
          </label>
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Reorder at (days left)
            </span>
            <input
              type="number"
              min={0}
              max={90}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
              value={reorderDays}
              onChange={(e) => setReorderDays(e.target.value)}
            />
            <span className="text-[10px] text-slate-400">
              Prompt when cover ≤ this
            </span>
          </label>
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              SP lead time (days)
            </span>
            <input
              type="number"
              min={0}
              max={30}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums"
              value={leadDays}
              onChange={(e) => setLeadDays(e.target.value)}
            />
            <span className="text-[10px] text-slate-400">Critical if below</span>
          </label>
          <button
            type="button"
            disabled={savingCover}
            onClick={() => void saveCoverPolicy(true)}
            className="btn-primary !py-2.5 !px-3 text-xs inline-flex items-center justify-center gap-1"
          >
            {savingCover ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save & apply levels
          </button>
          <button
            type="button"
            onClick={() => orderSuggested('suggested')}
            className="btn-secondary !py-2.5 !px-3 text-xs inline-flex items-center justify-center gap-1"
            title="Products with a system-suggested top-up qty"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Suggested PO ({suggestedLines.length})
          </button>
          <button
            type="button"
            onClick={() => orderSuggested('selected')}
            className="btn-primary !py-2.5 !px-3 text-xs inline-flex items-center justify-center gap-1"
            disabled={!orderSelect.size}
            title="Order any products you ticked in the inventory list"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Order selected ({orderSelect.size})
          </button>
        </div>
      </div>

      {(lowStock.length > 0 || (summary?.reorder_count || 0) > 0) && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>
                {summary?.reorder_count || lowStock.length} product(s)
              </strong>{' '}
              at or below reorder cover — order from your SP with a required
              delivery date.
              {summary?.critical_count ? (
                <>
                  {' '}
                  <strong className="text-rose-800">
                    {summary.critical_count} critical
                  </strong>{' '}
                  (below lead time).
                </>
              ) : null}
            </span>
          </span>
          <button
            type="button"
            onClick={() => orderSuggested('reorder')}
            className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Order reorder list
          </button>
          <button
            type="button"
            onClick={() => orderSuggested('selected')}
            className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            disabled={!orderSelect.size}
          >
            Order selected ({orderSelect.size})
          </button>
        </div>
      )}

      {/* Inventory levels + demand */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black">
              Inventory levels · estimated holding
            </p>
            <p className="text-[11px] text-slate-500">
              Daily use from recipes × learners. Tick any product to order from
              your SP — not only system-suggested lines. Suggested PO = target −
              on hand.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowLevels((v) => !v)}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              {showLevels ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={() => orderSuggested('selected')}
              disabled={!orderSelect.size}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Order selected ({orderSelect.size})
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderSelect(
                  new Set(sortedFilteredLevels.map((r) => r.approved_product_id))
                );
              }}
              className="btn-secondary !py-1.5 !px-3 text-xs"
              title="Select all products currently visible in the list"
            >
              Select visible
            </button>
            <button
              type="button"
              onClick={() => setOrderSelect(new Set())}
              className="btn-secondary !py-1.5 !px-3 text-xs"
              disabled={!orderSelect.size}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={savingLevels}
              onClick={() => void saveLevels()}
              className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            >
              {savingLevels ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Save levels
            </button>
          </div>
        </div>
        {showLevels ? (
          <div>
            <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center gap-1.5 bg-white">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">
                Category
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                  categoryFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                }`}
              >
                All ({levelRows.length})
              </button>
              {categories.map((c) => {
                const n = levelRows.filter(
                  (r) => (r.category || 'Uncategorised') === c
                ).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryFilter(c)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold border capitalize ${
                      categoryFilter === c
                        ? 'bg-sky-700 text-white border-sky-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    {c.replace(/_/g, ' ')} ({n})
                  </button>
                );
              })}
            </div>
            <div className="overflow-x-auto max-h-[32rem]">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b text-left">
                  <th className="px-2 py-2 w-8">
                    <span className="sr-only">Select for PO</span>
                  </th>
                  <SortTh label="Product" sortKey="product" className="px-3" />
                  <SortTh label="Daily use" sortKey="daily_usage" />
                  <SortTh label="Days left" sortKey="days_on_hand" />
                  <SortTh label="On hand" sortKey="qty_on_hand" />
                  <SortTh label="Reorder at" sortKey="reorder_level" />
                  <SortTh label="Target hold" sortKey="target_level" />
                  <SortTh label="Required (cover)" sortKey="suggested_order_qty" />
                  <SortTh label="Order qty" sortKey="order_qty" />
                  <SortTh label="UOM" sortKey="uom" />
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-400">
                    Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {levelRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No catalogue products yet — join DBE for the approved list.
                    </td>
                  </tr>
                ) : sortedFilteredLevels.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No products in this category.
                    </td>
                  </tr>
                ) : (
                  levelsByCategory.flatMap((group) => {
                    const header = (
                      <tr
                        key={`cat-${group.category}`}
                        className="bg-slate-100/90 border-y border-slate-200"
                      >
                        <td
                          colSpan={11}
                          className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-700"
                        >
                          {group.category.replace(/_/g, ' ')}
                          <span className="ml-2 text-[10px] font-semibold text-slate-500 normal-case tracking-normal">
                            {group.rows.length} item
                            {group.rows.length === 1 ? '' : 's'}
                          </span>
                        </td>
                      </tr>
                    );
                    const body = group.rows.map((r) => {
                    const onHand = Number(r.qty_on_hand) || 0;
                    const reorder =
                      r.reorder_level === ''
                        ? null
                        : Number(r.reorder_level);
                    const low =
                      r.cover_status === 'critical' ||
                      r.cover_status === 'reorder' ||
                      (reorder != null &&
                        Number.isFinite(reorder) &&
                        onHand <= reorder);
                    const critical = r.cover_status === 'critical';
                    const pid = r.approved_product_id;
                    const selected = orderSelect.has(pid);
                    return (
                      <tr
                        key={r.approved_product_id}
                        className={`border-b border-slate-50 ${
                          critical
                            ? 'bg-rose-50/70'
                            : low
                              ? 'bg-amber-50/60'
                              : selected
                                ? 'bg-sky-50/50'
                                : ''
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={selected}
                            onChange={() => toggleOrderSelect(pid)}
                            title="Include on next SP order"
                            aria-label={`Select ${r.product_name} for order`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="font-semibold text-xs">
                            {r.product_name}
                            {critical ? (
                              <span className="ml-1 text-[9px] font-bold uppercase text-rose-700">
                                Critical
                              </span>
                            ) : low ? (
                              <span className="ml-1 text-[9px] font-bold uppercase text-amber-700">
                                Reorder
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-700">
                            {r.brand_name}
                          </div>
                          {r.cover_message ? (
                            <div className="text-[10px] text-slate-400 max-w-[14rem] truncate" title={r.cover_message}>
                              {r.cover_message}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-slate-600">
                          {r.daily_usage && r.daily_usage > 0
                            ? r.daily_usage < 1
                              ? r.daily_usage
                              : roundStockQty(r.daily_usage, r.uom, 'ceil')
                            : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-xs font-bold tabular-nums">
                          {r.days_on_hand != null ? (
                            <span
                              className={
                                critical
                                  ? 'text-rose-700'
                                  : low
                                    ? 'text-amber-800'
                                    : 'text-slate-800'
                              }
                            >
                              {r.days_on_hand}d
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step={1}
                            min={0}
                            inputMode="numeric"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold tabular-nums"
                            value={r.qty_on_hand}
                            onChange={(e) =>
                              patchLevelRow(pid, {
                                qty_on_hand: e.target.value,
                              })
                            }
                            onBlur={() =>
                              patchLevelRow(pid, (x) => {
                                const qty_on_hand = formatStockQty(
                                  x.qty_on_hand,
                                  x.uom,
                                  'round'
                                );
                                return {
                                  qty_on_hand,
                                  ...recomputeRowOrderQty({
                                    ...x,
                                    qty_on_hand,
                                  }),
                                };
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step={1}
                            min={0}
                            inputMode="numeric"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs tabular-nums"
                            value={r.reorder_level}
                            placeholder="auto"
                            onChange={(e) =>
                              patchLevelRow(pid, {
                                reorder_level: e.target.value,
                              })
                            }
                            onBlur={() =>
                              patchLevelRow(pid, (x) => {
                                const reorder_level =
                                  x.reorder_level === ''
                                    ? ''
                                    : formatStockQty(
                                        x.reorder_level,
                                        x.uom,
                                        'ceil'
                                      );
                                return {
                                  reorder_level,
                                  ...recomputeRowOrderQty({
                                    ...x,
                                    reorder_level,
                                  }),
                                };
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step={1}
                            min={0}
                            inputMode="numeric"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs tabular-nums"
                            value={r.target_level}
                            placeholder="auto"
                            onChange={(e) =>
                              patchLevelRow(pid, {
                                target_level: e.target.value,
                              })
                            }
                            onBlur={() =>
                              patchLevelRow(pid, (x) => {
                                const target_level =
                                  x.target_level === ''
                                    ? ''
                                    : formatStockQty(
                                        x.target_level,
                                        x.uom,
                                        'ceil'
                                      );
                                return {
                                  target_level,
                                  ...recomputeRowOrderQty({
                                    ...x,
                                    target_level,
                                  }),
                                };
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 text-xs font-black tabular-nums text-sky-900">
                          {r.suggested_order_qty && r.suggested_order_qty > 0
                            ? roundStockQty(
                                r.suggested_order_qty,
                                r.uom,
                                'ceil'
                              )
                            : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
                              onClick={() => nudgeOrderQty(pid, -1)}
                              title="Decrease order qty"
                              aria-label="Decrease order quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              step={1}
                              min={0}
                              inputMode="numeric"
                              className="w-16 rounded-lg border border-sky-200 bg-sky-50/50 px-1.5 py-1 text-xs font-black tabular-nums text-center text-sky-950"
                              value={r.order_qty}
                              placeholder="0"
                              title="Qty sent to suggested PO — edit for school requirements"
                              onChange={(e) =>
                                patchLevelRow(pid, {
                                  order_qty: e.target.value,
                                })
                              }
                              onBlur={() =>
                                patchLevelRow(pid, (x) =>
                                  x.order_qty === '' ||
                                  !(Number(x.order_qty) > 0)
                                    ? { order_qty: '' }
                                    : {
                                        order_qty: formatStockQty(
                                          x.order_qty,
                                          x.uom,
                                          'ceil'
                                        ),
                                      }
                                )
                              }
                            />
                            <button
                              type="button"
                              className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
                              onClick={() => nudgeOrderQty(pid, 1)}
                              title="Increase order qty"
                              aria-label="Increase order quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-500">
                          {r.uom}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => orderOneProduct(r)}
                            className="text-[10px] font-bold text-sky-800 border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded-lg px-2 py-1 inline-flex items-center gap-0.5"
                            title="Add this product to a new SP order using Order qty (required cover gap by default)"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            Order
                          </button>
                        </td>
                      </tr>
                    );
                    });
                    return [header, ...body];
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* GRN */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs flex-1 min-w-[14rem]">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Receive against open PO
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
            >
              <option value="">Manual GRN (no PO)</option>
              {openOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.po_number || `PO #${o.id}`} · {o.status} ·{' '}
                  {o.order_date || ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addBlankLine}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            + Line
          </button>
          <button
            type="button"
            onClick={() => void receive()}
            disabled={receiving || lines.length === 0}
            className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1"
          >
            {receiving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PackagePlus className="w-3.5 h-3.5" />
            )}
            Post GRN
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">
            Select an open PO to load lines, or add a manual line from the
            approved list.
          </p>
        ) : (
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div
                key={`${line.approved_product_id}-${idx}`}
                className="grid grid-cols-12 gap-2 items-end"
              >
                <label className="col-span-12 sm:col-span-6 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Product
                  </span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const p = products.find(
                        (x) => x.id === line.approved_product_id
                      );
                      return p?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                        />
                      ) : null;
                    })()}
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={line.approved_product_id}
                      onChange={(e) => {
                        const p = products.find(
                          (x) => x.id === Number(e.target.value)
                        );
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  approved_product_id: Number(e.target.value),
                                  product_name: p?.name || l.product_name,
                                  brand_name: p?.brand_name || l.brand_name,
                                  uom: p?.uom || l.uom,
                                }
                              : l
                          )
                        );
                      }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.brand_name} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="col-span-4 sm:col-span-2 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Qty
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, qty: e.target.value } : l
                        )
                      )
                    }
                  />
                </label>
                <label className="col-span-4 sm:col-span-2 text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    UOM
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={line.uom}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, uom: e.target.value } : l
                        )
                      )
                    }
                  />
                </label>
                <div className="col-span-4 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="w-full text-xs font-bold text-rose-700 border border-rose-200 rounded-xl py-2 bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              On hand
            </div>
            <table className="w-full text-sm">
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500">
                      No stock yet — post a GRN
                    </td>
                  </tr>
                ) : (
                  stock.map((s) => (
                    <tr
                      key={String(s.id)}
                      className={`border-b border-slate-50 ${
                        s.cover_status === 'critical'
                          ? 'bg-rose-50/50'
                          : s.low_stock
                            ? 'bg-amber-50/50'
                            : ''
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="font-semibold">
                          {String(s.product_name)}
                          {s.cover_status === 'critical' ? (
                            <span className="ml-1 text-[9px] font-bold uppercase text-rose-700">
                              Critical
                            </span>
                          ) : s.low_stock ? (
                            <span className="ml-1 text-[9px] font-bold uppercase text-amber-700">
                              Reorder
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700">
                          {String(s.brand_name)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.days_on_hand != null
                            ? `~${String(s.days_on_hand)}d left`
                            : ''}
                          {s.daily_usage
                            ? ` · ${
                                Number(s.daily_usage) < 1
                                  ? String(s.daily_usage)
                                  : String(
                                      roundStockQty(
                                        Number(s.daily_usage),
                                        String(s.uom || 'kg'),
                                        'ceil'
                                      )
                                    )
                              }/${String(s.uom || 'u')}/day`
                            : ''}
                          {s.suggested_order_qty
                            ? ` · order ${roundStockQty(
                                Number(s.suggested_order_qty),
                                String(s.uom || 'kg'),
                                'ceil'
                              )}`
                            : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="font-black tabular-nums">
                          {roundStockQty(
                            Number(s.qty_on_hand),
                            String(s.uom || 'kg'),
                            'round'
                          )}{' '}
                          {String(s.uom || '')}
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              void adjust(Number(s.id), 'issue', 1)
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-200 text-sky-800 bg-sky-50"
                          >
                            Issue
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void adjust(Number(s.id), 'waste', 1)
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 text-amber-900 bg-amber-50"
                          >
                            Waste
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              Recent receipts
            </div>
            <ul className="divide-y text-sm">
              {receipts.length === 0 ? (
                <li className="px-4 py-8 text-center text-slate-500">
                  No receipts
                </li>
              ) : (
                receipts.map((r) => (
                  <li
                    key={String(r.id)}
                    className="px-4 py-3 flex justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold">
                        {String(r.receipt_number)}
                      </span>
                      {r.po_id ? (
                        <span className="ml-2 text-[10px] font-bold text-[#0077b6]">
                          PO #{String(r.po_id)}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs shrink-0">
                      {String(r.received_at)} ·{' '}
                      {r.compliance_ok !== false ? (
                        <span className="text-emerald-700 font-bold">OK</span>
                      ) : (
                        <span className="text-amber-700 font-bold">FLAG</span>
                      )}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
