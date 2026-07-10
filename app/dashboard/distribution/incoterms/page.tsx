'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, Globe2, Loader2, Save, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { INCOTERMS_2020 } from '@/lib/distribution/types';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
  SchemaHint,
  TelemetryCard,
} from '@/components/distribution/DistributionShell';

export default function IncotermsPage() {
  return (
    <CompanyRequired>
      <IncotermsInner />
    </CompanyRequired>
  );
}

function IncotermsInner() {
  const companyId = getSelectedCompanyId();
  const [defaultIncoterm, setDefaultIncoterm] = useState('DAP');
  const [defaultMode, setDefaultMode] = useState('road');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string>();
  const [selected, setSelected] = useState<string | null>('DAP');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/distribution/settings?companyId=${companyId}`);
      const data = await res.json();
      setWarning(data.warning);
      if (data.settings?.default_incoterm) {
        setDefaultIncoterm(data.settings.default_incoterm);
        setSelected(data.settings.default_incoterm);
      }
      if (data.settings?.default_mode) setDefaultMode(data.settings.default_mode);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          default_incoterm: defaultIncoterm,
          default_mode: defaultMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Distribution defaults saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const active = INCOTERMS_2020.find((i) => i.code === selected) || INCOTERMS_2020[4];
  const anyMode = INCOTERMS_2020.filter((i) => i.group === 'Any mode');
  const sea = INCOTERMS_2020.filter((i) => i.group !== 'Any mode');

  return (
    <DistributionPage>
      <DistributionHeader
        title="Incoterms®"
        titleAccent="2020"
        description="International commercial terms — who pays, who risks, who insures. Pick a company default and educate every lane."
        action={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save defaults
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Rules" value={INCOTERMS_2020.length} accent="violet" icon={Scale} />
        <TelemetryCard label="Any mode" value={anyMode.length} accent="cyan" icon={Globe2} />
        <TelemetryCard label="Sea / waterway" value={sea.length} accent="sky" />
        <TelemetryCard
          label="Company default"
          value={defaultIncoterm}
          accent="emerald"
          icon={FileText}
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400 mb-3">
                Any mode of transport
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {anyMode.map((term) => (
                  <button
                    key={term.code}
                    type="button"
                    onClick={() => setSelected(term.code)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      selected === term.code
                        ? 'border-[#00b4d8] bg-sky-50 shadow-sm ring-1 ring-[#00b4d8]/20'
                        : 'border-neutral-200 bg-white hover:border-cyan-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-lg font-black text-[#0077b6]">
                        {term.code}
                      </span>
                      {defaultIncoterm === term.code && (
                        <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-800 text-sm mb-1">{term.name}</div>
                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                      {term.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400 mb-3">
                Sea and inland waterway
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {sea.map((term) => (
                  <button
                    key={term.code}
                    type="button"
                    onClick={() => setSelected(term.code)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      selected === term.code
                        ? 'border-[#00b4d8] bg-sky-50 shadow-sm ring-1 ring-[#00b4d8]/20'
                        : 'border-neutral-200 bg-white hover:border-cyan-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-lg font-black text-[#0077b6]">
                        {term.code}
                      </span>
                      {defaultIncoterm === term.code && (
                        <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-800 text-sm mb-1">{term.name}</div>
                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                      {term.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm">
              <div className="font-mono text-3xl font-black text-[#00b4d8] mb-1">{active.code}</div>
              <div className="font-black text-slate-800 text-lg mb-2">{active.name}</div>
              <p className="text-sm text-neutral-600 leading-relaxed mb-3">{active.summary}</p>
              <div className="rounded-2xl bg-white border border-cyan-50 px-3 py-2.5 text-xs text-slate-600">
                <span className="font-bold text-neutral-400 uppercase tracking-wider text-[10px] block mb-1">
                  Risk transfer
                </span>
                {active.risk}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDefaultIncoterm(active.code);
                  toast.message(`${active.code} set as default — click Save defaults`);
                }}
                className="mt-4 w-full btn-secondary !py-2.5 text-sm inline-flex items-center justify-center gap-2"
              >
                {defaultIncoterm === active.code ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" /> Company default
                  </>
                ) : (
                  <>Use as company default</>
                )}
              </button>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                Defaults
              </h3>
              <label className="block">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Incoterm</span>
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={defaultIncoterm}
                  onChange={(e) => {
                    setDefaultIncoterm(e.target.value);
                    setSelected(e.target.value);
                  }}
                >
                  {INCOTERMS_2020.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">
                  Default mode
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={defaultMode}
                  onChange={(e) => setDefaultMode(e.target.value)}
                >
                  <option value="road">Road</option>
                  <option value="rail">Rail</option>
                  <option value="ocean">Ocean</option>
                  <option value="air">Air</option>
                  <option value="multimodal">Multimodal</option>
                  <option value="last_mile">Last mile</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
    </DistributionPage>
  );
}
