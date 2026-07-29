'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  FileUp,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  FILE_KINDS,
  QTY_VARIANCE_AMBER_PCT,
  deliveryQtyTone,
  deliveryStatusClass,
  fileKindLabel,
  qtyVariance,
  qtyVarianceClass,
  qtyVarianceDotClass,
  type QtyVarianceTone,
} from '@/lib/schools/deliveries';
import type { MatchingReport } from '@/lib/schools/delivery-documents';
import GoldenPathStrip from '@/components/schools/GoldenPathStrip';

type Delivery = {
  id: number;
  delivery_number?: string;
  status?: string;
  po_id?: number | null;
  school_profile_id?: number;
  isp_profile_id?: number;
  expected_date?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  received_at?: string | null;
  vehicle_reg?: string | null;
  driver_name?: string | null;
  lines?: Array<Record<string, unknown>>;
  notes_isp?: string | null;
  notes_school?: string | null;
  grn_receipt_id?: number | null;
  created_at?: string;
};

type FileRow = {
  id: number;
  kind?: string;
  file_name?: string | null;
  file_url: string;
  uploaded_by_role?: string;
  content_type?: string | null;
  created_at?: string;
};

type LineEdit = {
  approved_product_id?: number | null;
  product_name: string;
  brand_name: string;
  qty_ordered: number;
  qty_delivered: number;
  qty_received: number;
  uom: string;
  approved?: boolean;
  other_item?: boolean;
};

const TIMELINE = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'received', label: 'Received' },
] as const;

function timelineIndex(status?: string) {
  const s = String(status || 'draft');
  if (s === 'received') return 3;
  if (s === 'delivered') return 2;
  if (s === 'dispatched') return 1;
  if (s === 'confirmed' || s === 'draft') return 0;
  if (s === 'disputed') return 2;
  return -1;
}

export default function DeliveriesPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'school' | 'isp'>('school');
  const [filter, setFilter] = useState('all');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [openOrders, setOpenOrders] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [summary, setSummary] = useState({
    total: 0,
    awaitingReceive: 0,
    received: 0,
    disputed: 0,
  });
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileKind, setFileKind] = useState('pod');
  const [poId, setPoId] = useState('');
  const [showDispatch, setShowDispatch] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notesIsp, setNotesIsp] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [receiveLines, setReceiveLines] = useState<LineEdit[]>([]);
  const [notesSchool, setNotesSchool] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraBrand, setExtraBrand] = useState('');
  const [extraQty, setExtraQty] = useState('1');
  const [extraUom, setExtraUom] = useState('unit');
  /** SP-editable planned/actual delivery qtys on the DN */
  const [dnLines, setDnLines] = useState<LineEdit[]>([]);
  const [savingLines, setSavingLines] = useState(false);
  /** PO · DN · GRN matching + exceptions (shared school / SP) */
  const [matching, setMatching] = useState<MatchingReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schools/deliveries?companyId=${companyId}&role=auto`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRole(data.role === 'isp' ? 'isp' : 'school');
      setDeliveries(data.deliveries || []);
      setOpenOrders(data.openOrders || []);
      setSummary(
        data.summary || {
          total: 0,
          awaitingReceive: 0,
          received: 0,
          disputed: 0,
        }
      );
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return deliveries;
    if (filter === 'action') {
      if (role === 'isp') {
        return deliveries.filter((d) =>
          ['draft', 'confirmed', 'dispatched'].includes(String(d.status))
        );
      }
      return deliveries.filter((d) =>
        ['dispatched', 'delivered', 'confirmed'].includes(String(d.status))
      );
    }
    return deliveries.filter((d) => d.status === filter);
  }, [deliveries, filter, role]);

  const openDetail = async (d: Delivery) => {
    setSelected(d);
    setShowDispatch(false);
    setShowReceive(false);
    setMatching(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/schools/deliveries?companyId=${companyId}&id=${d.id}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSelected(data.delivery);
      setFiles(data.files || []);
      setMatching(
        data.matching && typeof data.matching === 'object'
          ? (data.matching as MatchingReport)
          : null
      );
      setDriverName(String(data.delivery?.driver_name || ''));
      setVehicleReg(String(data.delivery?.vehicle_reg || ''));
      setNotesIsp(String(data.delivery?.notes_isp || ''));
      setNotesSchool(String(data.delivery?.notes_school || ''));
      // Seed editable DN line qtys (SP plans what they will deliver)
      const lines = (Array.isArray(data.delivery?.lines)
        ? data.delivery.lines
        : []) as Array<Record<string, unknown>>;
      setDnLines(
        lines.map((l) => {
          const ordered = Number(l.qty_ordered ?? l.qty ?? 0);
          const delivered = Number(l.qty_delivered ?? ordered);
          const approved = l.approved !== false && Boolean(l.approved_product_id);
          return {
            approved_product_id:
              l.approved_product_id != null
                ? Number(l.approved_product_id)
                : null,
            product_name: String(l.product_name || ''),
            brand_name: String(l.brand_name || ''),
            qty_ordered: ordered,
            qty_delivered: delivered,
            qty_received: Number(l.qty_received ?? 0),
            uom: String(l.uom || 'kg'),
            approved,
            other_item:
              l.other_item === true || l.approved === false || !l.approved_product_id,
          };
        })
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDetailLoading(false);
    }
  };

  /** Open printable PDF: dn (SP delivery note) · grn (school) · match */
  const printDoc = (kind: 'dn' | 'grn' | 'match') => {
    if (!selected) return;
    if (
      kind === 'grn' &&
      String(selected.status) !== 'received' &&
      !selected.grn_receipt_id
    ) {
      toast.message('GRN is available after the school receives the delivery');
      return;
    }
    const url = `/api/schools/deliveries?companyId=${companyId}&id=${selected.id}&format=${kind}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const saveDnQtys = async () => {
    if (!selected) return;
    setSavingLines(true);
    try {
      const merged = (selected.lines || []).map((l, i) => {
        const edit = dnLines[i];
        const ordered = Number(
          edit?.qty_ordered ?? l.qty_ordered ?? l.qty ?? 0
        );
        const delivered = Number(
          edit?.qty_delivered ?? l.qty_delivered ?? ordered
        );
        return {
          ...l,
          qty_ordered: ordered,
          qty_delivered: delivered,
          uom: edit?.uom || l.uom || 'kg',
        };
      });
      const data = await postAction('update_lines', { lines: merged });
      if (!data) return;
      toast.success('Delivery quantities saved on DN');
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingLines(false);
    }
  };

  const dnTone = useMemo(() => {
    const lines =
      dnLines.length > 0
        ? dnLines
        : (selected?.lines || []).map((l) => ({
            qty_ordered: Number(l.qty_ordered ?? 0),
            qty_delivered: Number(l.qty_delivered ?? l.qty_ordered ?? 0),
          }));
    return deliveryQtyTone(lines, 'delivered');
  }, [dnLines, selected?.lines]);

  const postAction = async (
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    if (!selected && action !== 'create') return null;
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action,
          id: selected?.id,
          delivery_id: selected?.id,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    } finally {
      setBusy(false);
    }
  };

  const createFromPo = async (explicitPoId?: number) => {
    const id = explicitPoId ?? (poId ? Number(poId) : NaN);
    if (!Number.isFinite(id)) return toast.error('Select a purchase order');
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'create_from_po',
          po_id: id,
          status: 'confirmed',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          'Delivery note ready — one-click from PO · dispatch when truck leaves'
      );
      setPoId('');
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const doDispatch = async () => {
    try {
      // Persist any edited delivery qtys before marking dispatched
      if (dnLines.length > 0 && selected) {
        const merged = (selected.lines || []).map((l, i) => {
          const edit = dnLines[i];
          const ordered = Number(
            edit?.qty_ordered ?? l.qty_ordered ?? l.qty ?? 0
          );
          const delivered = Number(
            edit?.qty_delivered ?? l.qty_delivered ?? ordered
          );
          return {
            ...l,
            qty_ordered: ordered,
            qty_delivered: delivered,
            uom: edit?.uom || l.uom || 'kg',
          };
        });
        await postAction('update_lines', { lines: merged });
      }
      const data = await postAction('dispatch', {
        driver_name: driverName || null,
        vehicle_reg: vehicleReg || null,
        expected_date: expectedDate || null,
        notes_isp: notesIsp || null,
        lines: dnLines.length
          ? (selected?.lines || []).map((l, i) => {
              const edit = dnLines[i];
              return {
                ...l,
                qty_ordered: Number(
                  edit?.qty_ordered ?? l.qty_ordered ?? l.qty ?? 0
                ),
                qty_delivered: Number(
                  edit?.qty_delivered ?? l.qty_delivered ?? l.qty_ordered ?? 0
                ),
              };
            })
          : undefined,
      });
      if (!data) return;
      const m = data.matching as
        | { summary?: { clean?: boolean; red?: number; amber?: number } }
        | undefined;
      toast.success(
        data.message ||
          (m?.summary?.clean
            ? 'Dispatched — matching clean so far (await school GRN)'
            : 'On the way — review matching report for short/over lines')
      );
      if (m) setMatching(m as MatchingReport);
      setShowDispatch(false);
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const doDelivered = async () => {
    try {
      const data = await postAction('mark_delivered', {
        notes_isp: notesIsp || null,
      });
      if (!data) return;
      toast.success('Marked delivered — upload POD & invoice now');
      setFileKind('pod');
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startReceive = () => {
    if (!selected) return;
    const lines = (selected.lines || []).map((l) => {
      const ordered = Number(l.qty_ordered ?? l.qty_delivered ?? 0);
      const delivered = Number(l.qty_delivered ?? ordered);
      return {
        approved_product_id: (l.approved_product_id as number) ?? null,
        product_name: String(l.product_name || ''),
        brand_name: String(l.brand_name || ''),
        qty_ordered: ordered,
        qty_delivered: delivered,
        qty_received: delivered,
        uom: String(l.uom || 'kg'),
      };
    });
    setReceiveLines(lines);
    setShowReceive(true);
  };

  const doReceive = async () => {
    try {
      const data = await postAction('receive', {
        lines: receiveLines,
        notes_school: notesSchool || null,
      });
      if (!data) return;
      if (data.pod_warning) {
        toast.message(String(data.pod_warning), { duration: 6000 });
      }
      if (data.prize?.message) {
        toast.success(String(data.prize.message), { duration: 6000 });
      }
      toast.success(
        data.grn
          ? 'Received — kitchen GRN posted to stock'
          : 'Delivery received'
      );
      setShowReceive(false);
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  /** One-tap: accept delivered qty → receive → kitchen GRN + prize delta */
  const doReceiveQuick = async (deliveryId?: number) => {
    const id = deliveryId || selected?.id;
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'receive_quick',
          id,
          delivery_id: id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Receive failed');
      if (data.pod_warning) {
        toast.message(String(data.pod_warning), { duration: 6000 });
      }
      if (data.prize?.message) {
        toast.success(String(data.prize.message), { duration: 7000 });
      } else {
        toast.success(
          data.message || 'Received — kitchen GRN posted in one tap'
        );
      }
      setShowReceive(false);
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (
    file: File | null,
    opts?: { kind?: string; asPod?: boolean }
  ) => {
    if (!file || !selected) return;
    const kind = opts?.kind || fileKind;
    const asPod = Boolean(opts?.asPod || kind === 'pod');
    setBusy(true);
    try {
      const up = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: `nsnp_${asPod ? 'pod' : kind}`,
      });
      if (!up.url) throw new Error(up.error || 'Upload failed');
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'attach',
          delivery_id: selected.id,
          file_url: up.url,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          kind: asPod ? 'pod' : kind,
          as_pod: asPod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Attach failed');
      toast.success(
        asPod
          ? 'POD photo attached — counts for SP prize POD points'
          : `${fileKindLabel(kind)} attached`
      );
      void openDetail(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const addExtraItem = async () => {
    if (!selected) return;
    const name = extraName.trim();
    const qty = Number(extraQty);
    if (!name) return toast.error('Product name required');
    if (!(qty > 0)) return toast.error('Qty must be > 0');
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'add_extra_lines',
          id: selected.id,
          extra_lines: [
            {
              product_name: name,
              brand_name: extraBrand.trim() || 'Other',
              qty_delivered: qty,
              uom: extraUom || 'unit',
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.message(
        data.message ||
          'Extra item on DN — full-compliance SP points only when all lines are DBE-approved'
      );
      setExtraName('');
      setExtraBrand('');
      setExtraQty('1');
      if (data.delivery) void openDetail(data.delivery);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const ti = timelineIndex(selected?.status);
  const mode = role === 'isp' ? 'isp' : 'school';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Deliveries"
        titleAccent={role === 'isp' ? 'SP supply' : 'School receive'}
        mode={mode}
        description={
          role === 'isp'
            ? 'World-class supply: PO → dispatch → POD/invoice → school confirms. Large touch targets for field drivers.'
            : 'World-class receive: check quantities, attach photos, post kitchen GRN in one step.'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <GoldenPathStrip companyId={companyId} compact />

      {/* Offline POD queue (Sprint C) */}
      <OfflinePodQueue companyId={companyId} />

      {/* Role banner */}
      <div
        className={`mb-4 rounded-2xl border px-4 py-3 text-sm flex flex-wrap items-center gap-2 ${
          role === 'isp'
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-sky-200 bg-sky-50 text-sky-950'
        }`}
      >
        <Truck className="w-4 h-4 shrink-0" />
        <span className="font-bold">
          {role === 'isp' ? 'SP workspace' : 'School kitchen receive'}
        </span>
        <span className="text-xs opacity-80">
          {role === 'isp'
            ? 'You supply approved foods. Attach POD & invoice on every drop.'
            : 'Confirm what arrived — quantities can differ from the delivery note.'}
        </span>
        {summary.awaitingReceive > 0 ? (
          <button
            type="button"
            onClick={() => setFilter('action')}
            className="ml-auto text-xs font-bold underline"
          >
            {summary.awaitingReceive} need action →
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'All', value: summary.total, f: 'all' },
          {
            label: role === 'isp' ? 'To move' : 'To receive',
            value: summary.awaitingReceive,
            f: 'action',
          },
          { label: 'Received', value: summary.received, f: 'received' },
          { label: 'Disputed', value: summary.disputed, f: 'disputed' },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => setFilter(k.f)}
            className={`rounded-2xl border px-3 py-2.5 text-left transition-all ${
              filter === k.f
                ? 'border-[#00b4d8] bg-sky-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {k.label}
            </p>
            <p className="text-xl font-black tabular-nums">{k.value}</p>
          </button>
        ))}
      </div>

      {/* One-click create from PO */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs flex-1 min-w-[12rem]">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              One-click delivery from open PO
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
            >
              <option value="">Select PO…</option>
              {openOrders.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {String(o.po_number || `PO #${o.id}`)} · {String(o.status)} ·{' '}
                  {String(o.order_date || '')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !poId}
            onClick={() => void createFromPo()}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 min-h-[44px]"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
            Create DN
          </button>
          <Link
            href="/dashboard/schools/orders"
            className="btn-secondary !py-2.5 !px-3 text-xs min-h-[44px] inline-flex items-center"
          >
            Orders
          </Link>
          <Link
            href="/dashboard/schools/kitchen"
            className="btn-secondary !py-2.5 !px-3 text-xs min-h-[44px] inline-flex items-center"
          >
            Kitchen
          </Link>
          <Link
            href="/dashboard/schools/prizes"
            className="btn-secondary !py-2.5 !px-3 text-xs min-h-[44px] inline-flex items-center"
          >
            Prize score
          </Link>
        </div>
        {openOrders.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {openOrders.slice(0, 6).map((o) => (
              <li key={String(o.id)}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createFromPo(Number(o.id))}
                  className="text-xs font-bold rounded-full border border-sky-200 bg-sky-50 text-sky-900 px-3 py-1.5 hover:bg-sky-100 disabled:opacity-40"
                >
                  + DN {String(o.po_number || o.id)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <ul className="lg:col-span-2 space-y-2">
            {filtered.length === 0 ? (
              <li className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
                <Package className="w-8 h-8 text-[#00b4d8] mx-auto mb-2" />
                <p className="font-bold">Nothing here</p>
                <p className="text-sm text-slate-500 mt-1">
                  Create a delivery note from an open PO to start the loop.
                </p>
              </li>
            ) : (
              filtered.map((d) => (
                <li
                  key={d.id}
                  className={`rounded-2xl border p-4 transition-all min-h-[72px] ${
                    selected?.id === d.id
                      ? 'border-[#00b4d8] bg-sky-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-[#00b4d8]/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void openDetail(d)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm font-mono">
                          {d.delivery_number || `DN-${d.id}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {d.po_id ? `PO #${d.po_id} · ` : ''}
                          {(d.lines || []).length} line(s)
                          {d.driver_name ? ` · ${d.driver_name}` : ''}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${deliveryStatusClass(d.status)}`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </button>
                  {role === 'school' &&
                  ['dispatched', 'delivered', 'confirmed'].includes(
                    String(d.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doReceiveQuick(d.id)}
                      className="mt-2 text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 disabled:opacity-40"
                    >
                      One-tap receive → GRN
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white p-5 min-h-[360px]">
            {!selected ? (
              <p className="text-sm text-slate-500 text-center py-20">
                Select a delivery to run the supply / receive process.
              </p>
            ) : detailLoading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-xl font-mono">
                      {selected.delivery_number || `DN-${selected.id}`}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selected.po_id ? `Linked PO #${selected.po_id}` : 'No PO'}
                      {selected.vehicle_reg
                        ? ` · ${selected.vehicle_reg}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${deliveryStatusClass(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>

                {/* Print documents — school GRN, SP DN, shared matching */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => printDoc('dn')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
                    title="Print delivery note (hard copy for school)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print DN
                  </button>
                  <button
                    type="button"
                    onClick={() => printDoc('grn')}
                    disabled={
                      String(selected.status) !== 'received' &&
                      !selected.grn_receipt_id
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Print goods received note (copy for SP)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print GRN
                  </button>
                  <button
                    type="button"
                    onClick={() => printDoc('match')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100"
                    title="PO · DN · GRN matching report with exceptions"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Matching report
                  </button>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {TIMELINE.map((step, i) => {
                    const done = ti >= i;
                    const active = ti === i;
                    return (
                      <div
                        key={step.key}
                        className="flex items-center gap-1 shrink-0"
                      >
                        <div
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            done
                              ? active
                                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-100 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          {step.label}
                        </div>
                        {i < TIMELINE.length - 1 ? (
                          <div
                            className={`w-4 h-0.5 ${done && ti > i ? 'bg-emerald-300' : 'bg-slate-200'}`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Lines — SP sets planned/actual delivery qty; colour = variance vs ordered */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Product lines · qty vs ordered
                    </p>
                    {dnTone !== 'neutral' ? (
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${qtyVarianceClass(dnTone)}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${qtyVarianceDotClass(dnTone)}`}
                        />
                        {dnTone === 'green'
                          ? 'Perfect match'
                          : dnTone === 'amber'
                            ? `Within ${QTY_VARIANCE_AMBER_PCT}%`
                            : `> ${QTY_VARIANCE_AMBER_PCT}% off`}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Enter how many items you are delivering (or plan to).{' '}
                    <span className="text-emerald-700 font-semibold">
                      Green
                    </span>{' '}
                    = exact match ·{' '}
                    <span className="text-amber-700 font-semibold">
                      Amber
                    </span>{' '}
                    = up to {QTY_VARIANCE_AMBER_PCT}% short/over ·{' '}
                    <span className="text-rose-700 font-semibold">Red</span> =
                    more than {QTY_VARIANCE_AMBER_PCT}% off.
                  </p>
                  <ul className="rounded-2xl border border-slate-100 divide-y text-sm">
                    {dnLines.length === 0 &&
                    (selected.lines || []).length === 0 ? (
                      <li className="px-3 py-4 text-slate-500 text-center">
                        No lines
                      </li>
                    ) : (
                      (dnLines.length > 0
                        ? dnLines
                        : (selected.lines || []).map((l): LineEdit => {
                            const ordered = Number(
                              l.qty_ordered ?? l.qty ?? 0
                            );
                            return {
                              approved_product_id:
                                l.approved_product_id != null
                                  ? Number(l.approved_product_id)
                                  : null,
                              product_name: String(l.product_name || ''),
                              brand_name: String(l.brand_name || ''),
                              qty_ordered: ordered,
                              qty_delivered: Number(
                                l.qty_delivered ?? ordered
                              ),
                              qty_received: Number(l.qty_received ?? 0),
                              uom: String(l.uom || 'kg'),
                              other_item:
                                l.other_item === true ||
                                l.approved === false ||
                                !l.approved_product_id,
                              approved:
                                l.approved !== false &&
                                Boolean(l.approved_product_id),
                            };
                          })
                      ).map((l, i) => {
                        const other =
                          l.other_item === true ||
                          l.approved === false ||
                          !l.approved_product_id;
                        const v = qtyVariance(
                          Number(l.qty_ordered || 0),
                          Number(l.qty_delivered || 0)
                        );
                        const canEdit =
                          role === 'isp' &&
                          !['received', 'cancelled'].includes(
                            String(selected.status)
                          );
                        return (
                          <li
                            key={i}
                            className={`px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 border-l-4 ${
                              v.tone === 'green'
                                ? 'border-l-emerald-500 bg-emerald-50/40'
                                : v.tone === 'amber'
                                  ? 'border-l-amber-400 bg-amber-50/50'
                                  : v.tone === 'red'
                                    ? 'border-l-rose-500 bg-rose-50/50'
                                    : 'border-l-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">
                                {String(l.product_name)}
                              </p>
                              <p
                                className={`text-[10px] font-bold ${
                                  other
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {String(l.brand_name || '')}
                                {other
                                  ? ' · Other (not on DBE list)'
                                  : ' · Approved'}
                                {' · '}
                                ordered {Number(l.qty_ordered || 0)}{' '}
                                {String(l.uom || '')}
                              </p>
                              {v.tone !== 'green' && v.tone !== 'neutral' ? (
                                <p
                                  className={`text-[10px] font-bold mt-0.5 ${
                                    v.tone === 'red'
                                      ? 'text-rose-700'
                                      : 'text-amber-800'
                                  }`}
                                >
                                  {v.label}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canEdit ? (
                                <label className="text-right">
                                  <span className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                    Delivering
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className={`w-24 rounded-xl border px-2 py-2 text-base font-black tabular-nums text-right ${
                                      v.tone === 'green'
                                        ? 'border-emerald-300 bg-white'
                                        : v.tone === 'amber'
                                          ? 'border-amber-300 bg-white'
                                          : v.tone === 'red'
                                            ? 'border-rose-300 bg-white'
                                            : 'border-slate-200 bg-white'
                                    }`}
                                    value={
                                      Number.isFinite(l.qty_delivered)
                                        ? l.qty_delivered
                                        : ''
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const n =
                                        raw === ''
                                          ? 0
                                          : Number(raw);
                                      setDnLines((prev) =>
                                        (prev.length > 0
                                          ? prev
                                          : []
                                        ).map((row, ri) =>
                                          ri === i
                                            ? {
                                                ...row,
                                                qty_delivered:
                                                  Number.isFinite(n) ? n : 0,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                  />
                                </label>
                              ) : (
                                <div className="text-right tabular-nums">
                                  <p className="text-[9px] font-bold uppercase text-slate-400">
                                    Delivering
                                  </p>
                                  <p className="font-black text-base">
                                    {Number(l.qty_delivered || 0)}{' '}
                                    <span className="text-xs font-semibold text-slate-500">
                                      {String(l.uom || '')}
                                    </span>
                                  </p>
                                  {Number(l.qty_received || 0) > 0 ? (
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      received {Number(l.qty_received)}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                              <span
                                title={v.label}
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${qtyVarianceDotClass(v.tone)}`}
                              />
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                  {role === 'isp' &&
                  !['received', 'cancelled'].includes(
                    String(selected.status)
                  ) &&
                  dnLines.length > 0 ? (
                    <button
                      type="button"
                      disabled={busy || savingLines}
                      onClick={() => void saveDnQtys()}
                      className="mt-2 w-full sm:w-auto min-h-[40px] rounded-xl px-4 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 inline-flex items-center justify-center gap-2"
                    >
                      {savingLines ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      Save delivery quantities
                    </button>
                  ) : null}
                </div>

                {/* SP: add other items on DN */}
                {role === 'isp' &&
                !['received', 'cancelled'].includes(
                  String(selected.status)
                ) ? (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase text-amber-900">
                      Add other item on delivery note
                    </p>
                    <p className="text-[11px] text-amber-900/80">
                      Allowed for commercial extras — kitchen will not stock
                      them as NSNP approved. Full SP prize points need 100%
                      DBE-approved lines.
                    </p>
                    <div className="grid sm:grid-cols-4 gap-2">
                      <input
                        className="rounded-xl border border-slate-200 px-2 py-2 text-xs sm:col-span-2"
                        placeholder="Product name"
                        value={extraName}
                        onChange={(e) => setExtraName(e.target.value)}
                      />
                      <input
                        className="rounded-xl border border-slate-200 px-2 py-2 text-xs"
                        placeholder="Brand"
                        value={extraBrand}
                        onChange={(e) => setExtraBrand(e.target.value)}
                      />
                      <div className="flex gap-1">
                        <input
                          className="rounded-xl border border-slate-200 px-2 py-2 text-xs w-16"
                          value={extraQty}
                          onChange={(e) => setExtraQty(e.target.value)}
                          placeholder="Qty"
                        />
                        <input
                          className="rounded-xl border border-slate-200 px-2 py-2 text-xs w-16"
                          value={extraUom}
                          onChange={(e) => setExtraUom(e.target.value)}
                          placeholder="uom"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void addExtraItem()}
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      Add to DN
                    </button>
                  </div>
                ) : null}

                {/* Primary actions — huge touch targets */}
                <div className="grid sm:grid-cols-2 gap-2">
                  {role === 'isp' &&
                  ['draft', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowDispatch(true)}
                      className="min-h-[52px] rounded-2xl font-bold text-sm bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
                    >
                      Dispatch truck
                    </button>
                  ) : null}
                  {role === 'isp' &&
                  ['dispatched', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doDelivered()}
                      className="min-h-[52px] rounded-2xl font-bold text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                    >
                      Mark delivered
                    </button>
                  ) : null}
                  {role === 'school' &&
                  ['dispatched', 'delivered', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void doReceiveQuick()}
                        className="min-h-[52px] rounded-2xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center justify-center gap-2 sm:col-span-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        One-tap receive → kitchen GRN
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={startReceive}
                        className="min-h-[44px] rounded-2xl font-bold text-xs border-2 border-emerald-200 text-emerald-900 bg-emerald-50"
                      >
                        Adjust quantities first
                      </button>
                    </>
                  ) : null}
                  {role === 'school' &&
                  !['received', 'cancelled'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt(
                          'What is wrong with this delivery?'
                        );
                        if (reason == null || !String(reason).trim()) return;
                        const wantCredit = window.confirm(
                          'Request a credit note from the SP for the shortfall / issue?'
                        );
                        void postAction('dispute', {
                          dispute_reason: reason,
                          credit_note_requested: wantCredit,
                        })
                          .then((data) => {
                            if (!data) return;
                            toast.message(
                              wantCredit
                                ? 'Disputed — credit note requested from SP'
                                : 'Disputed — SP will be notified'
                            );
                            void load();
                            if (data.delivery) void openDetail(data.delivery);
                          })
                          .catch((e: unknown) =>
                            toast.error(
                              e instanceof Error ? e.message : 'Failed'
                            )
                          );
                      }}
                      className="min-h-[52px] rounded-2xl font-bold text-sm border-2 border-rose-200 text-rose-800 bg-rose-50"
                    >
                      Dispute · request credit note
                    </button>
                  ) : null}
                  {role === 'isp' &&
                  String(selected.status) === 'disputed' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const number = window.prompt(
                          'Credit note number (optional)'
                        );
                        if (number == null) return;
                        const amountStr = window.prompt(
                          'Credit note amount ZAR (optional)',
                          ''
                        );
                        void postAction('credit_note', {
                          credit_note_number: number || null,
                          credit_note_amount: amountStr
                            ? Number(amountStr)
                            : null,
                        })
                          .then((data) => {
                            if (!data) return;
                            toast.success(
                              data.message || 'Credit note recorded'
                            );
                            void load();
                            if (data.delivery) void openDetail(data.delivery);
                          })
                          .catch((e: unknown) =>
                            toast.error(
                              e instanceof Error ? e.message : 'Failed'
                            )
                          );
                      }}
                      className="min-h-[52px] rounded-2xl font-bold text-sm border-2 border-violet-200 text-violet-900 bg-violet-50"
                    >
                      Issue credit note
                    </button>
                  ) : null}
                </div>

                {selected.grn_receipt_id ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Kitchen GRN #{selected.grn_receipt_id} posted to stock
                    </p>
                    <button
                      type="button"
                      onClick={() => printDoc('grn')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline-offset-2 hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print GRN for SP
                    </button>
                  </div>
                ) : null}

                {/* Matching report + exceptions (school & SP) */}
                {matching ? (
                  <div
                    className={`rounded-2xl border p-3 space-y-3 ${qtyVarianceClass(
                      (matching.summary.overall_tone ||
                        'neutral') as QtyVarianceTone
                    )}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          Matching report · PO · DN · GRN
                        </p>
                        <p className="font-black text-sm mt-0.5">
                          {matching.summary.clean
                            ? 'Clean match'
                            : matching.summary.red > 0
                              ? 'Exceptions need attention'
                              : matching.summary.amber > 0 ||
                                  matching.exceptions.length > 0
                                ? 'Minor exceptions'
                                : 'In progress'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => printDoc('match')}
                        className="inline-flex items-center gap-1 rounded-lg border border-current/20 bg-white/60 px-2 py-1 text-[10px] font-bold"
                      >
                        <Printer className="w-3 h-3" />
                        Print
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {[
                        {
                          label: 'Lines',
                          value: matching.summary.lines_total,
                        },
                        {
                          label: 'Perfect',
                          value: matching.summary.perfect,
                        },
                        {
                          label: 'Amber',
                          value: matching.summary.amber,
                        },
                        {
                          label: 'Red',
                          value: matching.summary.red,
                        },
                      ].map((c) => (
                        <div
                          key={c.label}
                          className="rounded-xl bg-white/70 border border-black/5 px-2 py-1.5"
                        >
                          <p className="text-lg font-black tabular-nums">
                            {c.value}
                          </p>
                          <p className="text-[9px] font-bold uppercase opacity-60">
                            {c.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] space-y-0.5 opacity-90">
                      <p>
                        Short DN: {matching.summary.short_delivered} · Over DN:{' '}
                        {matching.summary.over_delivered}
                        {String(selected.status) === 'received'
                          ? ` · Short GRN: ${matching.summary.short_received} · Over GRN: ${matching.summary.over_received}`
                          : ''}
                      </p>
                      <p>
                        Off-catalogue: {matching.summary.off_catalogue} · POD:{' '}
                        {matching.meta.has_pod ? 'yes' : 'missing'}
                        {matching.meta.grn_id
                          ? ` · GRN #${matching.meta.grn_id}`
                          : ''}
                      </p>
                    </div>
                    {matching.exceptions.length > 0 ? (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {matching.exceptions.map((ex, i) => (
                          <li
                            key={`${ex.code}-${i}`}
                            className={`flex gap-2 rounded-xl border px-2.5 py-2 text-xs bg-white/80 ${
                              ex.severity === 'red'
                                ? 'border-rose-200 text-rose-900'
                                : ex.severity === 'amber'
                                  ? 'border-amber-200 text-amber-950'
                                  : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <AlertTriangle
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                ex.severity === 'red'
                                  ? 'text-rose-600'
                                  : ex.severity === 'amber'
                                    ? 'text-amber-600'
                                    : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-[10px] uppercase tracking-wide opacity-70">
                                {ex.code.replace(/_/g, ' ')}
                              </p>
                              <p className="font-medium leading-snug">
                                {ex.message}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        No exceptions — quantities and docs align
                        {String(selected.status) !== 'received'
                          ? ' so far (GRN pending)'
                          : ''}
                      </p>
                    )}
                    {matching.lines.some((l) => l.exceptions.length > 0) ? (
                      <div className="border-t border-black/5 pt-2">
                        <p className="text-[10px] font-bold uppercase opacity-60 mb-1.5">
                          Line variances
                        </p>
                        <ul className="space-y-1 text-xs">
                          {matching.lines
                            .filter((l) => l.exceptions.length > 0)
                            .map((l, i) => (
                              <li
                                key={i}
                                className="flex justify-between gap-2 tabular-nums"
                              >
                                <span className="font-semibold truncate">
                                  {l.product_name}
                                </span>
                                <span className="shrink-0 opacity-80">
                                  {l.qty_ordered} → DN {l.qty_delivered}
                                  {String(selected.status) === 'received'
                                    ? ` → GRN ${l.qty_received}`
                                    : ''}{' '}
                                  · {l.match_status}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* POD photo — school + SP */}
                <div className="border-t pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Proof of delivery — photo POD (school or SP)
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setFileKind('pod');
                        cameraRef.current?.click();
                      }}
                      className="min-h-[52px] rounded-2xl font-bold text-sm bg-[#0077b6] text-white hover:bg-[#023e8a] disabled:opacity-40 inline-flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Photo POD (camera)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setFileKind('pod');
                        fileRef.current?.click();
                      }}
                      className="min-h-[52px] rounded-2xl font-bold text-sm border-2 border-sky-200 text-sky-900 bg-sky-50 inline-flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Upload POD photo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {role === 'isp'
                      ? 'Snap the signed POD at the gate — earns SP prize POD points (15%). Schools can also attach.'
                      : 'You can photo the POD / goods at the door if the SP has not yet. Helps disputes and SP scoring.'}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs min-h-[44px]"
                      value={fileKind}
                      onChange={(e) => setFileKind(e.target.value)}
                    >
                      {FILE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cameraRef.current?.click()}
                      className="btn-secondary !py-2.5 !px-4 text-xs inline-flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Camera className="w-4 h-4" />
                      Other photo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                      className="btn-secondary !py-2.5 !px-4 text-xs inline-flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Upload className="w-4 h-4" />
                      Invoice / file
                    </button>
                    <Link
                      href="/dashboard/schools/prizes"
                      className="btn-secondary !py-2.5 !px-3 text-xs min-h-[44px] inline-flex items-center"
                    >
                      Prize criteria
                    </Link>
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        void onUpload(e.target.files?.[0] || null, {
                          kind: fileKind === 'pod' ? 'pod' : 'photo',
                          asPod: fileKind === 'pod',
                        })
                      }
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) =>
                        void onUpload(e.target.files?.[0] || null, {
                          kind: fileKind,
                          asPod: fileKind === 'pod',
                        })
                      }
                    />
                  </div>
                  {files.length === 0 ? (
                    <p className="text-xs text-slate-500 rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                      {role === 'isp'
                        ? 'Photo the POD and upload the invoice so the school can receive with confidence.'
                        : 'SP should attach POD + invoice. You can add a POD photo of what landed at the kitchen door.'}
                    </p>
                  ) : (
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {files.map((f) => {
                        const isImage = /\.(jpg|jpeg|png|webp|gif)/i.test(
                          f.file_url
                        ) || f.content_type?.startsWith('image');
                        return (
                          <li key={f.id}>
                            <a
                              href={f.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden hover:border-[#00b4d8] transition-all"
                            >
                              {isImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={f.file_url}
                                  alt=""
                                  className="w-16 h-16 object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 flex items-center justify-center bg-white border-r border-slate-100 shrink-0">
                                  <FileUp className="w-5 h-5 text-[#0077b6]" />
                                </div>
                              )}
                              <div className="py-2 pr-2 min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">
                                  {f.file_name || fileKindLabel(f.kind)}
                                </p>
                                <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                                  {f.kind} · {f.uploaded_by_role}
                                </p>
                              </div>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispatch modal */}
      {showDispatch && selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg">Dispatch truck</h3>
              <button type="button" onClick={() => setShowDispatch(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <label className="text-xs block">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Driver name
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="text-xs block">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Vehicle registration
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                placeholder="e.g. CA 123-456"
              />
            </label>
            <label className="text-xs block">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Expected delivery date (OTIF)
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </label>
            <label className="text-xs block">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Notes for school
              </span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[72px]"
                value={notesIsp}
                onChange={(e) => setNotesIsp(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doDispatch()}
              className="w-full min-h-[52px] rounded-2xl bg-sky-600 text-white font-bold text-sm disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Confirm dispatch'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Receive modal with editable qtys */}
      {showReceive && selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
              <h3 className="font-black text-lg">Receive into kitchen</h3>
              <button type="button" onClick={() => setShowReceive(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Adjust quantities if the truck delivered less or more. Stock GRN
              uses <strong>received</strong> qty only.
            </p>
            <ul className="space-y-3">
              {receiveLines.map((line, idx) => {
                const v = qtyVariance(line.qty_ordered, line.qty_received);
                return (
                  <li
                    key={idx}
                    className={`rounded-2xl border p-3 border-l-4 ${
                      v.tone === 'green'
                        ? 'border-emerald-200 border-l-emerald-500 bg-emerald-50/40'
                        : v.tone === 'amber'
                          ? 'border-amber-200 border-l-amber-400 bg-amber-50/50'
                          : v.tone === 'red'
                            ? 'border-rose-200 border-l-rose-500 bg-rose-50/50'
                            : 'border-slate-100 border-l-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold text-sm">{line.product_name}</p>
                        <p className="text-[10px] font-bold text-emerald-700">
                          {line.brand_name} · ordered {line.qty_ordered}{' '}
                          {line.uom}
                          {line.qty_delivered !== line.qty_ordered
                            ? ` · SP delivered ${line.qty_delivered}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${qtyVarianceClass(v.tone)}`}
                      >
                        {v.label}
                      </span>
                    </div>
                    <label className="text-xs block">
                      <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Qty received
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={`w-full rounded-xl border px-3 py-3 text-lg font-black tabular-nums bg-white ${
                          v.tone === 'green'
                            ? 'border-emerald-300'
                            : v.tone === 'amber'
                              ? 'border-amber-300'
                              : v.tone === 'red'
                                ? 'border-rose-300'
                                : 'border-slate-200'
                        }`}
                        value={line.qty_received}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setReceiveLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    qty_received: Number.isFinite(n) ? n : 0,
                                  }
                                : l
                            )
                          );
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="text-xs block">
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                School notes
              </span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm min-h-[64px]"
                value={notesSchool}
                onChange={(e) => setNotesSchool(e.target.value)}
                placeholder="Optional — condition, short delivery, etc."
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doReceive()}
              className="w-full min-h-[52px] rounded-2xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              Confirm receive &amp; post GRN
            </button>
          </div>
        </div>
      ) : null}
    </SchoolsPage>
  );
}

const OFFLINE_POD_KEY = 'nsnp_offline_pod_queue_v1';

type OfflinePodItem = {
  id: string;
  companyId: number;
  deliveryId: number;
  fileName: string;
  dataUrl: string;
  createdAt: string;
};

/** Sprint C — queue POD photos when offline; flush when back online */
function OfflinePodQueue({ companyId }: { companyId: number }) {
  const [items, setItems] = useState<OfflinePodItem[]>([]);
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [flushing, setFlushing] = useState(false);
  const offlineRef = useRef<HTMLInputElement>(null);

  const readQueue = () => {
    try {
      const raw = localStorage.getItem(OFFLINE_POD_KEY);
      const all = raw ? (JSON.parse(raw) as OfflinePodItem[]) : [];
      setItems(all.filter((i) => i.companyId === companyId));
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    readQueue();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (online && items.length) void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const saveQueue = (next: OfflinePodItem[]) => {
    try {
      const raw = localStorage.getItem(OFFLINE_POD_KEY);
      const all = raw ? (JSON.parse(raw) as OfflinePodItem[]) : [];
      const others = all.filter((i) => i.companyId !== companyId);
      localStorage.setItem(
        OFFLINE_POD_KEY,
        JSON.stringify([...others, ...next])
      );
      setItems(next);
    } catch {
      toast.error('Could not save offline queue');
    }
  };

  const queueFile = async (file: File | null) => {
    if (!file) return;
    const deliveryId = Number(
      window.prompt('Delivery ID to attach this POD photo to?')
    );
    if (!Number.isFinite(deliveryId)) {
      toast.error('Valid delivery id required');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const next: OfflinePodItem[] = [
        ...items,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          companyId,
          deliveryId,
          fileName: file.name,
          dataUrl,
          createdAt: new Date().toISOString(),
        },
      ];
      saveQueue(next);
      toast.success(
        online
          ? 'Queued — will upload now'
          : 'Saved offline — will upload when you are back online'
      );
      if (online) void flush(next);
    };
    reader.readAsDataURL(file);
  };

  const flush = async (list?: OfflinePodItem[]) => {
    const queue = list || items;
    if (!queue.length || !navigator.onLine) return;
    setFlushing(true);
    const remaining: OfflinePodItem[] = [];
    for (const item of queue) {
      try {
        // Convert data URL to blob and upload
        const resBlob = await fetch(item.dataUrl);
        const blob = await resBlob.blob();
        const file = new File([blob], item.fileName || 'pod.jpg', {
          type: blob.type || 'image/jpeg',
        });
        const up = await uploadCompanyAssetServerFirst({
          file,
          companyId,
          kind: 'nsnp_pod',
        });
        if (!up.url) throw new Error(up.error || 'upload failed');
        const res = await fetch('/api/schools/deliveries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            companyId,
            action: 'attach',
            delivery_id: item.deliveryId,
            file_url: up.url,
            file_name: item.fileName,
            content_type: file.type,
            kind: 'pod',
            as_pod: true,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'attach failed');
        }
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    if (remaining.length < queue.length) {
      toast.success(
        `Uploaded ${queue.length - remaining.length} offline POD photo(s)`
      );
    }
    if (remaining.length) {
      toast.message(`${remaining.length} POD photo(s) still queued`);
    }
    setFlushing(false);
  };

  return (
    <div
      className={`mb-4 rounded-2xl border px-3 py-2.5 text-xs flex flex-wrap items-center gap-2 ${
        online
          ? 'border-slate-200 bg-white'
          : 'border-amber-300 bg-amber-50 text-amber-950'
      }`}
    >
      <span className="font-bold uppercase tracking-wide">
        {online ? 'Online' : 'Offline'} · POD photo queue
      </span>
      <span className="text-slate-500">
        {items.length} queued
        {flushing ? ' · uploading…' : ''}
      </span>
      <button
        type="button"
        className="btn-secondary !py-1 !px-2 text-[11px] ml-auto"
        onClick={() => offlineRef.current?.click()}
      >
        <Camera className="w-3 h-3 inline mr-1" />
        Queue POD photo
      </button>
      {items.length > 0 && online ? (
        <button
          type="button"
          className="btn-primary !py-1 !px-2 text-[11px]"
          disabled={flushing}
          onClick={() => void flush()}
        >
          Flush now
        </button>
      ) : null}
      <input
        ref={offlineRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void queueFile(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
    </div>
  );
}
