'use client';

import { useCallback, useEffect, useState } from 'react';
import { Car, Loader2, Plus, Trash2, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
  EmptyMission,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/distribution/DistributionShell';

type Vehicle = {
  id: number;
  code: string;
  name?: string | null;
  vehicle_type?: string | null;
  plate_number?: string | null;
  capacity_kg?: number | null;
  status: string;
};

type Driver = {
  id: number;
  code: string;
  full_name: string;
  phone?: string | null;
  status: string;
  vehicle_id?: number | null;
};

export default function FleetPage() {
  return (
    <CompanyRequired>
      <FleetInner />
    </CompanyRequired>
  );
}

function FleetInner() {
  const companyId = getSelectedCompanyId();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [showForm, setShowForm] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    code: '',
    name: '',
    vehicle_type: 'van',
    plate_number: '',
    capacity_kg: '',
  });
  const [driverForm, setDriverForm] = useState({
    code: '',
    full_name: '',
    phone: '',
    license_class: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/distribution/fleet?companyId=${companyId}`);
      const data = await res.json();
      setVehicles(data.vehicles || []);
      setDrivers(data.drivers || []);
      setWarning(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createVehicle = async () => {
    if (!companyId || !vehicleForm.code) {
      toast.error('Code required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          kind: 'vehicle',
          ...vehicleForm,
          capacity_kg: vehicleForm.capacity_kg ? Number(vehicleForm.capacity_kg) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Vehicle added');
      setShowForm(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createDriver = async () => {
    if (!companyId || !driverForm.code || !driverForm.full_name) {
      toast.error('Code and name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          kind: 'driver',
          ...driverForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Driver added');
      setShowForm(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setVehicleStatus = async (id: number, status: string) => {
    if (!companyId) return;
    await fetch('/api/distribution/fleet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, kind: 'vehicle', id, status }),
    });
    void load();
  };

  const setDriverStatus = async (id: number, status: string) => {
    if (!companyId) return;
    await fetch('/api/distribution/fleet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, kind: 'driver', id, status }),
    });
    void load();
  };

  const remove = async (kind: 'vehicle' | 'driver', id: number) => {
    if (!companyId || !confirm('Remove?')) return;
    await fetch(
      `/api/distribution/fleet?companyId=${companyId}&id=${id}&kind=${kind}`,
      { method: 'DELETE' }
    );
    void load();
  };

  const vAvailable = vehicles.filter((v) => v.status === 'available').length;
  const dAvailable = drivers.filter((d) => d.status === 'available').length;

  return (
    <DistributionPage>
      <DistributionHeader
        title="Fleet &"
        titleAccent="drivers"
        description="Own assets and people — vans, reefers, trucks, and licensed drivers ready for last-mile and regional runs."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add {tab === 'vehicles' ? 'vehicle' : 'driver'}
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Vehicles" value={vehicles.length} accent="amber" icon={Car} />
        <TelemetryCard label="Available" value={vAvailable} accent="emerald" />
        <TelemetryCard label="Drivers" value={drivers.length} accent="sky" icon={User} />
        <TelemetryCard label="Ready" value={dAvailable} accent="cyan" />
      </div>

      <div className="flex gap-1.5 mb-5">
        {(['vehicles', 'drivers'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
              tab === t
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'vehicles' ? (
        vehicles.length === 0 ? (
          <EmptyMission
            title="No vehicles"
            body="Register vans, trucks, and reefers so outbound and inbound can assign capacity."
            action={
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="btn-primary !py-2.5 !px-6 text-sm"
              >
                Add vehicle
              </button>
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold text-[#00b4d8]">{v.code}</div>
                      <div className="font-bold text-slate-800">{v.name || v.vehicle_type}</div>
                    </div>
                  </div>
                  <StatusPill
                    label={v.status}
                    className={
                      v.status === 'available'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : v.status === 'in_use'
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                    }
                    pulse={v.status === 'in_use'}
                  />
                </div>
                <div className="text-xs text-neutral-500 space-y-0.5 mb-3">
                  {v.plate_number && <div>Plate {v.plate_number}</div>}
                  {v.capacity_kg != null && <div>{v.capacity_kg} kg capacity</div>}
                  <div className="capitalize">{v.vehicle_type}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['available', 'in_use', 'maintenance', 'offline'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => void setVehicleStatus(v.id, st)}
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${
                        v.status === st
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                          : 'border-neutral-200 text-neutral-500'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void remove('vehicle', v.id)}
                    className="ml-auto text-neutral-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : drivers.length === 0 ? (
        <EmptyMission
          title="No drivers"
          body="Add licensed drivers for assignment on road and last-mile shipments."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              Add driver
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold text-[#00b4d8]">{d.code}</div>
                    <div className="font-bold text-slate-800">{d.full_name}</div>
                  </div>
                </div>
                <StatusPill
                  label={d.status}
                  className={
                    d.status === 'available'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : d.status === 'on_route'
                        ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                  }
                  pulse={d.status === 'on_route'}
                />
              </div>
              {d.phone && <div className="text-xs text-neutral-500 mb-3">{d.phone}</div>}
              <div className="flex flex-wrap gap-1.5">
                {['available', 'on_route', 'off_duty', 'suspended'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void setDriverStatus(d.id, st)}
                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${
                      d.status === st
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-neutral-200 text-neutral-500'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void remove('driver', d.id)}
                  className="ml-auto text-neutral-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">
                Add {tab === 'vehicles' ? 'vehicle' : 'driver'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            {tab === 'vehicles' ? (
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-mono uppercase"
                  placeholder="CODE"
                  value={vehicleForm.code}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, code: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Name"
                  value={vehicleForm.name}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, name: e.target.value }))}
                />
                <select
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={vehicleForm.vehicle_type}
                  onChange={(e) =>
                    setVehicleForm((f) => ({ ...f, vehicle_type: e.target.value }))
                  }
                >
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                  <option value="reefer">Reefer</option>
                  <option value="trailer">Trailer</option>
                  <option value="bike">Bike</option>
                </select>
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Plate"
                  value={vehicleForm.plate_number}
                  onChange={(e) =>
                    setVehicleForm((f) => ({ ...f, plate_number: e.target.value }))
                  }
                />
                <input
                  type="number"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Capacity kg"
                  value={vehicleForm.capacity_kg}
                  onChange={(e) =>
                    setVehicleForm((f) => ({ ...f, capacity_kg: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createVehicle()}
                  className="btn-primary w-full !py-3 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save vehicle'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-mono uppercase"
                  placeholder="CODE"
                  value={driverForm.code}
                  onChange={(e) => setDriverForm((f) => ({ ...f, code: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Full name"
                  value={driverForm.full_name}
                  onChange={(e) => setDriverForm((f) => ({ ...f, full_name: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="Phone"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  placeholder="License class"
                  value={driverForm.license_class}
                  onChange={(e) =>
                    setDriverForm((f) => ({ ...f, license_class: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createDriver()}
                  className="btn-primary w-full !py-3 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save driver'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DistributionPage>
  );
}
