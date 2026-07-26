'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Package,
  RefreshCw,
  Truck,
  Upload,
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
  DELIVERY_STATUSES,
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
  created_at?: string;
};

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
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'school' | 'isp'>('school');
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

  const openDetail = async (d: Delivery) => {
    setSelected(d);
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected && action !== 'create') return;
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      toast.success(
        action === 'receive'
          ? data.grn
            ? 'Received into kitchen (GRN posted)'
            : 'Delivery received'
          : action === 'create'
            ? 'Delivery created'
            : `Status updated`
      );
      void load();
      if (data.delivery) void openDetail(data.delivery);
      else if (selected) void openDetail(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const createFromPo = async () => {
    if (!poId) return toast.error('Select a purchase order');
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          po_id: Number(poId),
          status: 'confirmed',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Delivery note created from PO');
      setPoId('');
      void load();
      if (data.delivery) void openDetail(data.delivery);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file || !selected) return;
    setBusy(true);
    try {
      const up = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: `nsnp_${fileKind}`,
      });
      if (!up.url) throw new Error(up.error || 'Upload failed');
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'attach',
          delivery_id: selected.id,
          file_url: up.url,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          kind: fileKind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Attach failed');
      toast.success(`${fileKindLabel(fileKind)} attached`);
      void openDetail(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const mode = role === 'isp' ? 'isp' : 'school';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Deliveries"
        titleAccent={role === 'isp' ? 'ISP supply' : 'Receive'}
        mode={mode}
        description={
          role === 'isp'
            ? 'Confirm school orders, dispatch food, upload POD & invoices. Schools confirm receipt into kitchen stock.'
            : 'Track ISP deliveries, attach school docs, and receive into kitchen (auto GRN).'
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'All', value: summary.total },
          { label: 'Awaiting receive', value: summary.awaitingReceive },
          { label: 'Received', value: summary.received },
          { label: 'Disputed', value: summary.disputed },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {k.label}
            </p>
            <p className="text-xl font-black tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Create from PO */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 mb-4 flex flex-wrap gap-2 items-end">
        <label className="text-xs flex-1 min-w-[12rem]">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Create delivery from open PO
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
          className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Truck className="w-3.5 h-3.5" />
          )}
          Create delivery note
        </button>
        <Link
          href="/dashboard/schools/orders"
          className="btn-secondary !py-2 !px-3 text-xs"
        >
          Orders
        </Link>
        <Link
          href="/dashboard/schools/kitchen"
          className="btn-secondary !py-2 !px-3 text-xs"
        >
          Kitchen
        </Link>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <ul className="space-y-2">
            {deliveries.length === 0 ? (
              <li className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
                <Package className="w-8 h-8 text-[#00b4d8] mx-auto mb-2" />
                <p className="font-bold">No deliveries yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  {role === 'isp'
                    ? 'When a school raises a PO to you, create a delivery note, dispatch, and attach POD + invoice.'
                    : 'Link an ISP, raise a PO, then create a delivery note to track receipt.'}
                </p>
              </li>
            ) : (
              deliveries.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(d)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      selected?.id === d.id
                        ? 'border-[#00b4d8] bg-sky-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-[#00b4d8]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm font-mono">
                          {d.delivery_number || `DN-${d.id}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {d.po_id ? `PO #${d.po_id} · ` : ''}
                          {(d.lines || []).length} line(s)
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${deliveryStatusClass(d.status)}`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 min-h-[320px]">
            {!selected ? (
              <p className="text-sm text-slate-500 text-center py-16">
                Select a delivery to manage status and documents.
              </p>
            ) : detailLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-black text-lg font-mono">
                    {selected.delivery_number || `DN-${selected.id}`}
                  </h3>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${deliveryStatusClass(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </div>

                {/* Lines */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Lines
                  </p>
                  <ul className="text-sm space-y-1">
                    {(selected.lines || []).map((l, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 border-b border-slate-50 py-1"
                      >
                        <span>
                          <span className="font-semibold">
                            {String(l.product_name)}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold ml-1">
                            {String(l.brand_name || '')}
                          </span>
                        </span>
                        <span className="tabular-nums font-bold shrink-0">
                          {Number(l.qty_delivered ?? l.qty_ordered ?? 0)}{' '}
                          {String(l.uom || '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Role actions */}
                <div className="flex flex-wrap gap-1.5">
                  {role === 'isp' &&
                  ['draft', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('dispatch')}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-900"
                    >
                      Mark dispatched
                    </button>
                  ) : null}
                  {role === 'isp' &&
                  ['dispatched', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('mark_delivered')}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-900"
                    >
                      Mark delivered
                    </button>
                  ) : null}
                  {role === 'school' &&
                  ['dispatched', 'delivered', 'confirmed'].includes(
                    String(selected.status)
                  ) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act('receive')}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Receive into kitchen
                    </button>
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
                          'Dispute reason (short)'
                        );
                        if (reason == null) return;
                        void act('dispute', { dispute_reason: reason });
                      }}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-900"
                    >
                      Dispute
                    </button>
                  ) : null}
                </div>

                {selected.grn_receipt_id ? (
                  <p className="text-xs text-emerald-700 font-bold">
                    Kitchen GRN #{selected.grn_receipt_id} posted
                  </p>
                ) : null}

                {/* Attachments */}
                <div className="border-t pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Documents (POD · invoice · photos)
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <select
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
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
                      onClick={() => fileRef.current?.click()}
                      className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Attach file
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) =>
                        void onUpload(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                  {files.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No files yet. ISP uploads POD & invoice; school can add
                      photos or signed notes.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {files.map((f) => (
                        <li key={f.id}>
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-xs rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:border-[#00b4d8]"
                          >
                            <FileUp className="w-3.5 h-3.5 text-[#0077b6] shrink-0" />
                            <span className="font-bold truncate flex-1">
                              {f.file_name || fileKindLabel(f.kind)}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize shrink-0">
                              {f.kind} · {f.uploaded_by_role}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="text-[10px] text-slate-400">
                  Status legend:{' '}
                  {DELIVERY_STATUSES.map((s) => s.label).join(' · ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}
