'use client';

/**
 * Temporary quarries, batching plants, GPS distances, resource allocation.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, MapPin } from 'lucide-react';
import {
  LoadingBlock,
  QuarrygraphWorkbench,
  useQuarrygraph,
} from '@/components/quarry/QuarrygraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/quarry/SimpleEntityForm';
import {
  ALLOCATION_RESOURCE_TYPES,
  OPERATION_KINDS,
  OPERATION_STATUSES,
  mapsPlaceUrl,
  type DistancePair,
  type LocationPoint,
} from '@/lib/quarry/quarrygraph';

type Tab = 'operations' | 'allocate' | 'distances';

export default function QuarryLocationsPage() {
  const { store, loading, saving, post, summary, analysis } = useQuarrygraph();
  const [tab, setTab] = useState<Tab>('operations');
  const today = new Date().toISOString().slice(0, 10);

  const [op, setOp] = useState({
    code: '',
    name: '',
    kind: 'temporary',
    status: 'active',
    project_code: '',
    project_name: '',
    client: '',
    start_date: today,
    end_date: '',
    address: '',
    lat: '',
    lng: '',
    target_daily_t: '',
    district: '',
    province: '',
  });

  const [alloc, setAlloc] = useState({
    resource_type: 'vehicle',
    resource_id: '',
    quarry_id: '',
    site_id: '',
    project_code: '',
    role: '',
    start_date: today,
    end_date: '',
  });

  const locations =
    (analysis?.locations as LocationPoint[]) ||
    [];
  const distances =
    (analysis?.distanceMatrix as DistancePair[]) || [];
  const openAlloc =
    (analysis?.openAllocations as Array<{
      id: string;
      resource_type: string;
      resource_label?: string;
      resource_id: string;
      quarry_id?: string | null;
      site_id?: string | null;
      project_code?: string;
      role?: string;
      start_date: string;
      end_date?: string | null;
    }>) ||
    [];

  const projectOps = useMemo(() => {
    if (!store) return [];
    return (store.quarries || []).filter(
      (q) =>
        q.kind === 'temporary' ||
        q.kind === 'batching_plant' ||
        q.kind === 'permanent'
    );
  }, [store]);

  const addOp = async () => {
    if (!op.code.trim() || !op.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'quarries',
      action: 'upsert',
      record: {
        ...op,
        lat: op.lat ? Number(op.lat) : null,
        lng: op.lng ? Number(op.lng) : null,
        target_daily_t: op.target_daily_t
          ? Number(op.target_daily_t)
          : null,
        end_date: op.end_date || null,
      },
    });
    toast.success(
      op.kind === 'batching_plant'
        ? 'Batching plant saved with GPS'
        : op.kind === 'temporary'
          ? 'Temporary quarry saved with GPS'
          : 'Operation saved'
    );
    setOp((f) => ({
      ...f,
      code: '',
      name: '',
      project_code: '',
      project_name: '',
      client: '',
      address: '',
      lat: '',
      lng: '',
      target_daily_t: '',
    }));
  };

  const addAlloc = async () => {
    if (!alloc.resource_id || (!alloc.quarry_id && !alloc.site_id)) {
      toast.error('Select a resource and a quarry or site');
      return;
    }
    await post({
      entity: 'allocations',
      action: 'upsert',
      record: {
        ...alloc,
        quarry_id: alloc.quarry_id || null,
        site_id: alloc.site_id || null,
        end_date: alloc.end_date || null,
      },
    });
    toast.success('Resource allocated to location / project');
    setAlloc((f) => ({
      ...f,
      resource_id: '',
      role: '',
      end_date: '',
    }));
  };

  const resourceOptions = useMemo(() => {
    if (!store) return [] as Array<{ id: string; label: string }>;
    if (alloc.resource_type === 'vehicle') {
      return store.vehicles.map((v) => ({
        id: v.id,
        label: `${v.code} · ${v.name}`,
      }));
    }
    if (alloc.resource_type === 'crew') {
      return store.crews.map((c) => ({
        id: c.id,
        label: `${c.code} · ${c.name}`,
      }));
    }
    return [
      { id: 'mobile_jaw_01', label: 'Mobile jaw crusher 01' },
      { id: 'mobile_cone_01', label: 'Mobile cone crusher 01' },
      { id: 'screen_plant_01', label: 'Screen plant 01' },
      { id: 'batch_plant_01', label: 'Batch plant unit 01' },
      { id: 'generator_01', label: 'Generator set 01' },
    ];
  }, [store, alloc.resource_type]);

  return (
    <QuarrygraphWorkbench
      title="Locations & projects"
      titleAccent="temp · batch · GPS"
      description="Permanent and temporary quarries, project batching plants, GPS coordinates for Google Maps distances, and allocate vehicles / crews / plant to each site."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Permanent',
                value: Number(summary?.permanentQuarries) || 0,
              },
              {
                label: 'Temporary quarries',
                value: Number(summary?.temporaryQuarries) || 0,
              },
              {
                label: 'Batching plants',
                value: Number(summary?.batchingPlants) || 0,
              },
              {
                label: 'With GPS',
                value: Number(summary?.locationsWithGps) || locations.length,
              },
              {
                label: 'Open allocations',
                value: Number(summary?.openAllocations) || openAlloc.length,
              },
            ]}
          />

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'operations' as const, label: 'Temp & batching ops' },
                { id: 'allocate' as const, label: 'Allocate resources' },
                { id: 'distances' as const, label: 'Distances · Maps' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold border ${
                  tab === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'operations' && (
            <>
              <p className="text-xs text-slate-600 rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3">
                Use <strong>temporary</strong> for borrow pits / project
                quarries with an end date. Use <strong>batching plant</strong>{' '}
                for ready-mix or project plants. Set <strong>lat / lng</strong>{' '}
                (WGS84) so haul distances and Google Maps directions work.
              </p>
              <FormCard
                title="Add temporary quarry or batching plant"
                onSubmit={() => void addOp()}
                saving={saving}
                submitLabel="Save operation"
              >
                <select
                  className={fieldClass()}
                  value={op.kind}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, kind: e.target.value }))
                  }
                >
                  {OPERATION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={op.status}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  {OPERATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass()}
                  placeholder="Code"
                  value={op.code}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Name"
                  value={op.name}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Project code"
                  value={op.project_code}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, project_code: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Project name"
                  value={op.project_name}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, project_name: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Client"
                  value={op.client}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, client: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="date"
                  value={op.start_date}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="date"
                  value={op.end_date}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Address"
                  value={op.address}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, address: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  step="0.000001"
                  placeholder="Latitude (e.g. -25.87)"
                  value={op.lat}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, lat: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  step="0.000001"
                  placeholder="Longitude (e.g. 29.23)"
                  value={op.lng}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, lng: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Target t / day"
                  value={op.target_daily_t}
                  onChange={(e) =>
                    setOp((f) => ({
                      ...f,
                      target_daily_t: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="District"
                  value={op.district}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, district: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Province"
                  value={op.province}
                  onChange={(e) =>
                    setOp((f) => ({ ...f, province: e.target.value }))
                  }
                />
              </FormCard>

              <DataTable
                headers={[
                  'Code',
                  'Name',
                  'Kind',
                  'Status',
                  'Project',
                  'Client',
                  'Start',
                  'End',
                  'GPS',
                  'Maps',
                ]}
                rows={projectOps.map((q) => ({
                  id: q.id,
                  cells: [
                    q.code,
                    q.name,
                    q.kind || 'permanent',
                    q.status || 'active',
                    q.project_code || '—',
                    q.client || '—',
                    q.start_date || '—',
                    q.end_date || '—',
                    q.lat != null && q.lng != null
                      ? `${Number(q.lat).toFixed(4)}, ${Number(q.lng).toFixed(4)}`
                      : '—',
                    q.lat != null && q.lng != null ? (
                      <a
                        key="m"
                        href={mapsPlaceUrl(Number(q.lat), Number(q.lng))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-700 font-bold text-xs"
                      >
                        <MapPin className="w-3 h-3" /> Open
                      </a>
                    ) : (
                      '—'
                    ),
                  ],
                }))}
                onDelete={(id) =>
                  void post({ entity: 'quarries', action: 'delete', id })
                }
              />
            </>
          )}

          {tab === 'allocate' && (
            <>
              <FormCard
                title="Allocate vehicle / crew / plant to location"
                onSubmit={() => void addAlloc()}
                saving={saving}
                submitLabel="Allocate"
              >
                <select
                  className={fieldClass()}
                  value={alloc.resource_type}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      resource_type: e.target.value,
                      resource_id: '',
                    }))
                  }
                >
                  {ALLOCATION_RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={alloc.resource_id}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      resource_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Resource…</option>
                  {resourceOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={alloc.quarry_id}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      quarry_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Quarry / plant…</option>
                  {(store.quarries || []).map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.code} · {q.name} ({q.kind || 'permanent'})
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={alloc.site_id}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      site_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Site / pad (optional)…</option>
                  {store.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                      {s.is_temporary ? ' · temp' : ''}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass()}
                  placeholder="Project code"
                  value={alloc.project_code}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      project_code: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Role (e.g. Haul to plant)"
                  value={alloc.role}
                  onChange={(e) =>
                    setAlloc((f) => ({ ...f, role: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="date"
                  value={alloc.start_date}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      start_date: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="date"
                  value={alloc.end_date}
                  onChange={(e) =>
                    setAlloc((f) => ({
                      ...f,
                      end_date: e.target.value,
                    }))
                  }
                />
              </FormCard>

              <DataTable
                headers={[
                  'Resource',
                  'Type',
                  'Location',
                  'Site',
                  'Project',
                  'Role',
                  'From',
                  'To',
                ]}
                rows={(store.allocations || []).map((a) => {
                  const q = (store.quarries || []).find(
                    (x) => x.id === a.quarry_id
                  );
                  const s = store.sites.find((x) => x.id === a.site_id);
                  return {
                    id: a.id,
                    cells: [
                      a.resource_label || a.resource_id,
                      a.resource_type,
                      q?.code || '—',
                      s?.code || '—',
                      a.project_code || '—',
                      a.role || '—',
                      a.start_date,
                      a.end_date || 'open',
                    ],
                  };
                })}
                onDelete={(id) =>
                  void post({
                    entity: 'allocations',
                    action: 'delete',
                    id,
                  })
                }
              />
            </>
          )}

          {tab === 'distances' && (
            <>
              <p className="text-xs text-slate-600 rounded-2xl border border-sky-100 bg-sky-50/40 px-4 py-3">
                <strong>Straight km</strong> is great-circle (haversine).{' '}
                <strong>Road km (est.)</strong> ≈ straight × 1.3 for planning.
                Open <strong>Directions</strong> in Google Maps for live
                driving distance / traffic. Add lat/lng on quarries and sites
                to populate this matrix.
              </p>

              <h3 className="text-sm font-black">Geocoded locations</h3>
              {locations.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center border border-dashed rounded-2xl">
                  No GPS points yet. Add latitude and longitude on operations
                  or sites.
                </p>
              ) : (
                <DataTable
                  headers={[
                    'Code',
                    'Name',
                    'Source',
                    'Kind',
                    'Project',
                    'Lat',
                    'Lng',
                    'Map',
                  ]}
                  rows={locations.map((p) => ({
                    id: p.id,
                    cells: [
                      p.code,
                      p.name,
                      p.source,
                      p.kind,
                      p.project_code || '—',
                      p.lat.toFixed(5),
                      p.lng.toFixed(5),
                      <a
                        key="p"
                        href={mapsPlaceUrl(p.lat, p.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-700 font-bold text-xs"
                      >
                        <ExternalLink className="w-3 h-3" /> Maps
                      </a>,
                    ],
                  }))}
                />
              )}

              <h3 className="text-sm font-black">Distance matrix</h3>
              <DataTable
                headers={[
                  'From',
                  'To',
                  'Straight km',
                  'Road km (est.)',
                  'Google Maps',
                ]}
                rows={distances.map((d, i) => ({
                  id: String(i),
                  cells: [
                    `${d.from_code} · ${d.from_name}`,
                    `${d.to_code} · ${d.to_name}`,
                    d.straight_km,
                    d.road_km_est,
                    <a
                      key="d"
                      href={d.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-violet-700 font-bold text-xs"
                    >
                      <ExternalLink className="w-3 h-3" /> Directions
                    </a>,
                  ],
                }))}
              />
            </>
          )}
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
