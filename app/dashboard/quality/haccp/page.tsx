'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Loader2,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Plan = {
  id: number;
  name: string;
  product_scope?: string | null;
  process_step?: string | null;
  status?: string;
  ccp_count?: number;
  notes?: string | null;
};

type Ccp = {
  id: number;
  plan_id: number;
  code: string;
  name: string;
  hazard?: string | null;
  critical_limit?: string | null;
  frequency?: string | null;
  control_measure?: string | null;
  corrective_action?: string | null;
};

type Log = {
  id: number;
  plan_id?: number | null;
  ccp_id?: number | null;
  lot_number?: string | null;
  measured_value?: string | null;
  result?: string;
  within_limit?: boolean | null;
  operator_name?: string | null;
  recorded_at?: string;
};

export default function HaccpPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ccps, setCcps] = useState<Ccp[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showCcp, setShowCcp] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    product_scope: '',
    process_step: '',
  });
  const [ccpForm, setCcpForm] = useState({
    code: 'CCP-1',
    name: '',
    hazard: '',
    critical_limit: '',
    frequency: '',
    control_measure: '',
    corrective_action: '',
  });
  const [logForm, setLogForm] = useState({
    ccp_id: '',
    lot_number: '',
    measured_value: '',
    within_limit: true,
    operator_name: '',
    notes: '',
  });

  const authBody = { companyId, privyUserId };

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const base = `companyId=${companyId}&privyUserId=${encodeURIComponent(privyUserId || '')}`;
      const [pRes, lRes] = await Promise.all([
        fetch(`/api/quality/haccp?${base}&kind=plans`),
        fetch(`/api/quality/haccp?${base}&kind=logs`),
      ]);
      const pJson = await pRes.json();
      const lJson = await lRes.json();
      setPlans(pJson.plans || []);
      setLogs(lJson.logs || []);
      setWarning(pJson.warning || pJson.migration || null);
      if (!selectedPlan && (pJson.plans || [])[0]) {
        setSelectedPlan(pJson.plans[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, selectedPlan]);

  const loadCcps = useCallback(async () => {
    if (!companyId || !selectedPlan) {
      setCcps([]);
      return;
    }
    const params = new URLSearchParams({
      companyId: String(companyId),
      kind: 'ccps',
      planId: String(selectedPlan),
    });
    if (privyUserId) params.set('privyUserId', privyUserId);
    const res = await fetch(`/api/quality/haccp?${params}`);
    const json = await res.json();
    setCcps(json.ccps || []);
  }, [companyId, selectedPlan, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCcps();
  }, [loadCcps]);

  const createPlan = async () => {
    if (!planForm.name.trim()) {
      toast.error('Plan name required');
      return;
    }
    const res = await fetch('/api/quality/haccp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authBody, action: 'plan', ...planForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('HACCP plan created');
    setShowPlan(false);
    setPlanForm({ name: '', product_scope: '', process_step: '' });
    await load();
  };

  const createCcp = async () => {
    if (!selectedPlan) {
      toast.error('Select a plan');
      return;
    }
    const res = await fetch('/api/quality/haccp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authBody,
        action: 'ccp',
        plan_id: selectedPlan,
        ...ccpForm,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('CCP added');
    setShowCcp(false);
    await loadCcps();
    await load();
  };

  const createLog = async () => {
    const res = await fetch('/api/quality/haccp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...authBody,
        action: 'log',
        plan_id: selectedPlan,
        ccp_id: logForm.ccp_id ? Number(logForm.ccp_id) : null,
        lot_number: logForm.lot_number || null,
        measured_value: logForm.measured_value,
        within_limit: logForm.within_limit,
        result: logForm.within_limit ? 'ok' : 'breach',
        operator_name: logForm.operator_name,
        notes: logForm.notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success(logForm.within_limit ? 'Monitoring OK logged' : 'Breach logged');
    setShowLog(false);
    await load();
  };

  const approvePlan = async (id: number) => {
    const res = await fetch('/api/quality/haccp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authBody, id, entity: 'plan', status: 'approved' }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Failed');
      return;
    }
    toast.success('Plan approved');
    await load();
  };

  const breaches = logs.filter((l) => l.result === 'breach' || l.within_limit === false);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="Food safety system"
        title="HACCP"
        titleAccent="live"
        description="Hazard analysis plans, critical control points, and monitoring logs — linked to lots for release discipline."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPlan(true)} className="btn-primary !py-2 !px-4 text-sm">
              <Plus className="w-4 h-4" /> New plan
            </button>
            <button type="button" onClick={() => setShowLog(true)} className="btn-secondary !py-2 !px-4 text-sm">
              Log monitoring
            </button>
          </div>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {String(warning).includes('migration') || String(warning).includes('does not exist')
            ? 'Run supabase/migrations/20260711_haccp_esg_pm_suite.sql in Supabase.'
            : warning}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Plans', n: plans.length, icon: ShieldCheck, c: 'text-emerald-600' },
          { label: 'CCPs', n: ccps.length, icon: CheckCircle2, c: 'text-sky-600' },
          { label: 'Logs', n: logs.length, icon: ShieldCheck, c: 'text-[#00b4d8]' },
          { label: 'Breaches', n: breaches.length, icon: AlertTriangle, c: 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white border rounded-2xl p-4">
            <k.icon className={`w-4 h-4 ${k.c} mb-2`} />
            <div className="text-2xl font-black">{k.n}</div>
            <div className="text-[11px] text-neutral-500">{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-white border rounded-3xl overflow-hidden">
            <div className="px-4 py-3 border-b font-bold text-sm">Plans</div>
            {plans.length === 0 ? (
              <div className="p-8 text-sm text-neutral-500 text-center">No plans yet.</div>
            ) : (
              <ul className="divide-y">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(p.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-neutral-50 ${
                        selectedPlan === p.id ? 'bg-[#00b4d8]/5' : ''
                      }`}
                    >
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {p.status} · {p.ccp_count || 0} CCPs
                        {p.product_scope ? ` · ${p.product_scope}` : ''}
                      </div>
                    </button>
                    {p.status !== 'approved' && (
                      <div className="px-4 pb-3">
                        <button
                          type="button"
                          onClick={() => void approvePlan(p.id)}
                          className="text-xs font-semibold text-emerald-700"
                        >
                          Mark approved
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <span className="font-bold text-sm">Critical control points</span>
                <button
                  type="button"
                  disabled={!selectedPlan}
                  onClick={() => setShowCcp(true)}
                  className="text-xs font-semibold text-[#00b4d8] disabled:opacity-40"
                >
                  + Add CCP
                </button>
              </div>
              {ccps.length === 0 ? (
                <div className="p-8 text-sm text-neutral-500 text-center">
                  Select a plan and add CCPs (limits, monitoring, corrective action).
                </div>
              ) : (
                <ul className="divide-y">
                  {ccps.map((c) => (
                    <li key={c.id} className="px-4 py-3">
                      <div className="font-semibold text-sm">
                        <span className="font-mono text-[#0077b6]">{c.code}</span> · {c.name}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {c.hazard && <span>Hazard: {c.hazard}. </span>}
                        {c.critical_limit && <span>Limit: {c.critical_limit}. </span>}
                        {c.frequency && <span>Freq: {c.frequency}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b font-bold text-sm">Recent monitoring</div>
              {logs.length === 0 ? (
                <div className="p-8 text-sm text-neutral-500 text-center">No logs yet.</div>
              ) : (
                <ul className="divide-y max-h-72 overflow-y-auto">
                  {logs.slice(0, 30).map((l) => (
                    <li key={l.id} className="px-4 py-2.5 flex justify-between gap-2 text-sm">
                      <div>
                        <span
                          className={
                            l.result === 'breach' || l.within_limit === false
                              ? 'text-red-600 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }
                        >
                          {l.result === 'breach' || l.within_limit === false ? 'BREACH' : 'OK'}
                        </span>
                        {l.lot_number && (
                          <span className="ml-2 font-mono text-xs">Lot {l.lot_number}</span>
                        )}
                        {l.measured_value && (
                          <span className="text-neutral-500 text-xs ml-2">= {l.measured_value}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400 shrink-0">
                        {l.recorded_at ? new Date(l.recorded_at).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {showPlan && (
        <Modal title="New HACCP plan" onClose={() => setShowPlan(false)}>
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Plan name *"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Product scope"
            value={planForm.product_scope}
            onChange={(e) => setPlanForm({ ...planForm, product_scope: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-3"
            placeholder="Process step"
            value={planForm.process_step}
            onChange={(e) => setPlanForm({ ...planForm, process_step: e.target.value })}
          />
          <button type="button" onClick={() => void createPlan()} className="btn-primary w-full !py-3">
            Create plan
          </button>
        </Modal>
      )}

      {showCcp && (
        <Modal title="Add CCP" onClose={() => setShowCcp(false)}>
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Code (CCP-1)"
            value={ccpForm.code}
            onChange={(e) => setCcpForm({ ...ccpForm, code: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Name *"
            value={ccpForm.name}
            onChange={(e) => setCcpForm({ ...ccpForm, name: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Hazard"
            value={ccpForm.hazard}
            onChange={(e) => setCcpForm({ ...ccpForm, hazard: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Critical limit"
            value={ccpForm.critical_limit}
            onChange={(e) => setCcpForm({ ...ccpForm, critical_limit: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Monitoring frequency"
            value={ccpForm.frequency}
            onChange={(e) => setCcpForm({ ...ccpForm, frequency: e.target.value })}
          />
          <textarea
            className="input w-full !p-3 !text-sm mb-2 min-h-[60px]"
            placeholder="Control measure"
            value={ccpForm.control_measure}
            onChange={(e) => setCcpForm({ ...ccpForm, control_measure: e.target.value })}
          />
          <textarea
            className="input w-full !p-3 !text-sm mb-3 min-h-[60px]"
            placeholder="Corrective action"
            value={ccpForm.corrective_action}
            onChange={(e) => setCcpForm({ ...ccpForm, corrective_action: e.target.value })}
          />
          <button type="button" onClick={() => void createCcp()} className="btn-primary w-full !py-3">
            Add CCP
          </button>
        </Modal>
      )}

      {showLog && (
        <Modal title="Monitoring log" onClose={() => setShowLog(false)}>
          <select
            className="input w-full !p-3 !text-sm mb-2"
            value={logForm.ccp_id}
            onChange={(e) => setLogForm({ ...logForm, ccp_id: e.target.value })}
          >
            <option value="">CCP (optional)</option>
            {ccps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input
            className="input w-full !p-3 !text-sm mb-2 font-mono"
            placeholder="Lot number"
            value={logForm.lot_number}
            onChange={(e) => setLogForm({ ...logForm, lot_number: e.target.value })}
          />
          <input
            className="input w-full !p-3 !text-sm mb-2"
            placeholder="Measured value"
            value={logForm.measured_value}
            onChange={(e) => setLogForm({ ...logForm, measured_value: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={logForm.within_limit}
              onChange={(e) => setLogForm({ ...logForm, within_limit: e.target.checked })}
            />
            Within critical limit
          </label>
          <input
            className="input w-full !p-3 !text-sm mb-3"
            placeholder="Operator"
            value={logForm.operator_name}
            onChange={(e) => setLogForm({ ...logForm, operator_name: e.target.value })}
          />
          <button type="button" onClick={() => void createLog()} className="btn-primary w-full !py-3">
            Save log
          </button>
        </Modal>
      )}
    </RelationshipPage>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
