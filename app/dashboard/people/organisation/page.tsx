'use client';

/**
 * Company organisation & cost placement — the lists behind
 * People → Directory “Business unit / work centre / station / asset”.
 * Same register as Manufacturing cost centres, without requiring that module.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import { suggestOrgCode } from '@/lib/people/org-code';

type Row = {
  id: number;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  cost_centre_code?: string | null;
  business_unit_id?: number | null;
  work_center_id?: number | null;
  serial_number?: string | null;
  asset_type?: string | null;
};

type Tab = 'units' | 'centres' | 'stations' | 'assets';

function asRows(raw: unknown): Row[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const id = Number(o.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        code: o.code != null ? String(o.code) : null,
        name: o.name != null ? String(o.name) : null,
        description: o.description != null ? String(o.description) : null,
        cost_centre_code:
          o.cost_centre_code != null ? String(o.cost_centre_code) : null,
        business_unit_id:
          o.business_unit_id != null ? Number(o.business_unit_id) : null,
        work_center_id:
          o.work_center_id != null ? Number(o.work_center_id) : null,
        serial_number:
          o.serial_number != null ? String(o.serial_number) : null,
        asset_type: o.asset_type != null ? String(o.asset_type) : null,
      } satisfies Row;
    })
    .filter((x): x is Row => !!x);
}

export default function PeopleOrganisationPage() {
  const companyId = getSelectedCompanyId();
  const [tab, setTab] = useState<Tab>('units');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bus, setBus] = useState<Row[]>([]);
  const [wcs, setWcs] = useState<Row[]>([]);
  const [stations, setStations] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [addOpen, setAddOpen] = useState(true);
  const [form, setForm] = useState({
    name: '',
    code: '',
    notes: '',
    business_unit_id: '',
    work_center_id: '',
    serial_number: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const qs = `companyId=${companyId}`;
    try {
      const [buR, wcR, wsR, asR] = await Promise.all([
        fetch(`/api/manufacturing/business-units?${qs}`),
        fetch(`/api/manufacturing/work-centers?${qs}`),
        fetch(`/api/manufacturing/work-stations?${qs}`),
        fetch(`/api/manufacturing/assets?${qs}`),
      ]);
      const [buJ, wcJ, wsJ, asJ] = await Promise.all([
        buR.json(),
        wcR.json(),
        wsR.json(),
        asR.json(),
      ]);
      setBus(asRows(buJ.businessUnits));
      setWcs(asRows(wcJ.workCenters));
      setStations(asRows(wsJ.workStations));
      setAssets(asRows(asJ.assets));
      const warn = buJ.warning || wcJ.warning || wsJ.warning || asJ.warning;
      if (warn) toast.message(String(warn), { description: buJ.hint || asJ.hint });
    } catch {
      toast.error('Could not load organisation lists');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () =>
    setForm({
      name: '',
      code: '',
      notes: '',
      business_unit_id: '',
      work_center_id: '',
      serial_number: '',
    });

  const create = async () => {
    if (!companyId) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Name required');
      return;
    }
    setBusy(true);
    try {
      const prefix =
        tab === 'units'
          ? 'BU'
          : tab === 'centres'
            ? 'WC'
            : tab === 'stations'
              ? 'ST'
              : 'AST';
      const path =
        tab === 'units'
          ? '/api/manufacturing/business-units'
          : tab === 'centres'
            ? '/api/manufacturing/work-centers'
            : tab === 'stations'
              ? '/api/manufacturing/work-stations'
              : '/api/manufacturing/assets';
      const body: Record<string, unknown> = {
        companyId,
        name,
        code: form.code.trim() || suggestOrgCode(name, prefix),
        description: form.notes.trim() || null,
      };
      if (tab === 'centres' && form.business_unit_id) {
        body.business_unit_id = Number(form.business_unit_id);
      }
      if (tab === 'stations') {
        if (form.business_unit_id)
          body.business_unit_id = Number(form.business_unit_id);
        if (form.work_center_id)
          body.work_center_id = Number(form.work_center_id);
      }
      if (tab === 'assets') {
        body.asset_type = 'equipment';
        if (form.serial_number.trim())
          body.serial_number = form.serial_number.trim();
        if (form.business_unit_id)
          body.business_unit_id = Number(form.business_unit_id);
        if (form.work_center_id)
          body.work_center_id = Number(form.work_center_id);
      }
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not save');
        return;
      }
      toast.success(
        tab === 'units'
          ? 'Business unit added'
          : tab === 'centres'
            ? 'Work centre added'
            : tab === 'stations'
              ? 'Work station added'
              : 'Asset added'
      );
      resetForm();
      setAddOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (
    kind: 'business-units' | 'work-centers' | 'work-stations' | 'assets',
    id: number
  ) => {
    if (!companyId) return;
    if (!confirm('Remove this record? People already allocated keep the old id until you reassign them.')) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/manufacturing/${kind}?companyId=${companyId}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not remove');
        return;
      }
      toast.success('Removed');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'units', label: 'Business units', count: bus.length },
    { id: 'centres', label: 'Work centres', count: wcs.length },
    { id: 'stations', label: 'Work stations', count: stations.length },
    { id: 'assets', label: 'Assets', count: assets.length },
  ];

  const rows =
    tab === 'units'
      ? bus
      : tab === 'centres'
        ? wcs
        : tab === 'stations'
          ? stations
          : assets;

  const buName = new Map(bus.map((b) => [b.id, b.name || b.code || `#${b.id}`]));
  const wcName = new Map(wcs.map((w) => [w.id, w.name || w.code || `#${w.id}`]));

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Organisation"
        titleAccent="cost allocation"
        description="Add the business units, work centres, work stations and assets that appear when you add a staff member. Medical Advisor rooms can also assign these assets to a consult room."
        action={
          <Link
            href="/dashboard/people/directory?new=1"
            className="btn-secondary !py-2 !px-4 text-sm"
          >
            Add staff
          </Link>
        }
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setAddOpen(t.count === 0);
              resetForm();
            }}
            className={`rounded-2xl border px-4 py-3 text-left ${
              tab === t.id
                ? 'border-[#00b4d8] bg-sky-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              {t.label}
            </p>
            <p className="text-2xl font-black text-slate-900">{t.count}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-4">
          <Panel>
            {rows.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                {tab === 'units'
                  ? 'No business units yet — add Consulting, Admin, Procedures…'
                  : tab === 'centres'
                    ? 'No work centres yet — add Outpatients, Theatre, Reception…'
                    : tab === 'stations'
                      ? 'No work stations yet — a desk, chair or bay inside a centre.'
                      : 'No assets yet — ECG, autoclave, exam couch. Rooms can also add these.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {r.name || r.code}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {[
                          r.code,
                          r.cost_centre_code && r.cost_centre_code !== r.code
                            ? r.cost_centre_code
                            : null,
                          r.asset_type,
                          r.serial_number ? `SN ${r.serial_number}` : null,
                          r.business_unit_id
                            ? buName.get(r.business_unit_id)
                            : null,
                          r.work_center_id
                            ? wcName.get(r.work_center_id)
                            : null,
                          r.description,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void remove(
                          tab === 'units'
                            ? 'business-units'
                            : tab === 'centres'
                              ? 'work-centers'
                              : tab === 'stations'
                                ? 'work-stations'
                                : 'assets',
                          r.id
                        )
                      }
                      className="text-xs font-bold text-rose-600"
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <AdvisorExpandablePanel
            title={
              tab === 'units'
                ? 'Add a business unit'
                : tab === 'centres'
                  ? 'Add a work centre'
                  : tab === 'stations'
                    ? 'Add a work station'
                    : 'Add an asset'
            }
            description={
              tab === 'units'
                ? 'Required when you add staff. Example: Consulting, Admin, Pharmacy.'
                : tab === 'centres'
                  ? 'Optional team or function under a business unit.'
                  : tab === 'stations'
                    ? 'Optional desk, chair or procedure bay.'
                    : 'Equipment on the company register. Assign to rooms in Medical Advisor → Rooms.'
            }
            open={addOpen}
            onToggle={() => setAddOpen((v) => !v)}
            accentClass="border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30"
            titleClass="text-sky-950 dark:text-sky-50"
            hintClass="text-sky-800/80 dark:text-sky-200/80"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input w-full !py-2 text-sm"
                placeholder="Name *"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <input
                className="input w-full !py-2 text-sm"
                placeholder="Code (optional — we generate one)"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
              {tab !== 'units' ? (
                <select
                  className="input w-full !py-2 text-sm"
                  value={form.business_unit_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      business_unit_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Business unit (optional)</option>
                  {bus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code ? `${b.code} · ` : ''}
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {tab === 'stations' || tab === 'assets' ? (
                <select
                  className="input w-full !py-2 text-sm"
                  value={form.work_center_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      work_center_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Work centre (optional)</option>
                  {wcs.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code ? `${w.code} · ` : ''}
                      {w.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {tab === 'assets' ? (
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Serial number (optional)"
                  value={form.serial_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serial_number: e.target.value }))
                  }
                />
              ) : null}
              <input
                className="input w-full !py-2 text-sm sm:col-span-2"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="btn-primary !py-2 text-sm inline-flex items-center justify-center gap-1.5 sm:col-span-2"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </AdvisorExpandablePanel>

          <p className="text-[11px] text-slate-500">
            These lists fill the Organisation & cost allocation fields on{' '}
            <Link
              href="/dashboard/people/directory"
              className="font-bold text-[#0077b6] underline"
            >
              People → Directory
            </Link>
            . Equipment can also be added from{' '}
            <Link
              href="/dashboard/medicalgraph/rooms"
              className="font-bold text-[#0077b6] underline"
            >
              Medical Advisor → Rooms
            </Link>
            .
          </p>
        </div>
      )}
    </RelationshipPage>
  );
}
