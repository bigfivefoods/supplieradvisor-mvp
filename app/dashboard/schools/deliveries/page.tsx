'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  Circle,
  FileUp,
  Loader2,
  Package,
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
  deliveryStatusClass,
  fileKindLabel,
} from '@/lib/schools/deliveries';

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
      setDriverName(String(data.delivery?.driver_name || ''));
      setVehicleReg(String(data.delivery?.vehicle_reg || ''));
      setNotesIsp(String(data.delivery?.notes_isp || ''));
      setNotesSchool(String(data.delivery?.notes_school || ''));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDetailLoading(false);
    }
  };

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
      const data = await postAction('dispatch', {
        driver_name: driverName || null,
        vehicle_reg: vehicleReg || null,
        expected_date: expectedDate || null,
        notes_isp: notesIsp || null,
      });
      if (!data) return;
      toast.success('On the way — attach POD when delivered');
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

                {/* Lines */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Product lines · DBE-approved earn full SP points
                  </p>
                  <ul className="rounded-2xl border border-slate-100 divide-y text-sm">
                    {(selected.lines || []).length === 0 ? (
                      <li className="px-3 py-4 text-slate-500 text-center">
                        No lines
                      </li>
                    ) : (
                      (selected.lines || []).map((l, i) => {
                        const other =
                          l.other_item === true ||
                          l.approved === false ||
                          !l.approved_product_id;
                        return (
                          <li
                            key={i}
                            className="px-3 py-2.5 flex justify-between gap-2"
                          >
                            <div>
                              <p className="font-semibold">
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
                              </p>
                            </div>
                            <div className="text-right tabular-nums shrink-0">
                              <p className="font-black">
                                {Number(
                                  l.qty_received ??
                                    l.qty_delivered ??
                                    l.qty_ordered ??
                                    0
                                )}{' '}
                                {String(l.uom || '')}
                              </p>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
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
                        if (reason == null) return;
                        void postAction('dispute', {
                          dispute_reason: reason,
                        })
                          .then((data) => {
                            if (!data) return;
                            toast.message('Disputed — SP will be notified');
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
                      Dispute quantities
                    </button>
                  ) : null}
                </div>

                {selected.grn_receipt_id ? (
                  <p className="text-sm text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Kitchen GRN #{selected.grn_receipt_id} posted to stock
                  </p>
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
              {receiveLines.map((line, idx) => (
                <li
                  key={idx}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="font-bold text-sm">{line.product_name}</p>
                  <p className="text-[10px] font-bold text-emerald-700 mb-2">
                    {line.brand_name} · ordered {line.qty_ordered}{' '}
                    {line.uom}
                  </p>
                  <label className="text-xs block">
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Qty received
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 text-lg font-black tabular-nums bg-white"
                      value={line.qty_received}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setReceiveLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  qty_received: Number.isFinite(v) ? v : 0,
                                }
                              : l
                          )
                        );
                      }}
                    />
                  </label>
                </li>
              ))}
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
