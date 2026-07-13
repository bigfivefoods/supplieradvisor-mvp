'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  Loader2,
  MapPin,
  Package,
  Users,
  Globe,
  ExternalLink,
  Heart,
  Briefcase,
} from 'lucide-react';
import type { MapPin as Pin } from '@/components/LocationMap';
import type { PublicNetworkPayload } from '@/lib/containers/public-share';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

type MapMode = 'people' | 'jobs' | 'location';

export default function EmbedContainerNetworkPage() {
  const { token } = useParams() as { token: string };
  const [network, setNetwork] = useState<PublicNetworkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');
  const [mode, setMode] = useState<MapMode>('people');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/containers/network?token=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Failed to load network');
          return;
        }
        setNetwork(data.network);
        // Default to people mode when impact present, else locations
        if (data.network?.showImpact && data.network?.impact) {
          setMode('people');
        } else {
          setMode('location');
        }
      } catch {
        if (!cancelled) setError('Failed to load network');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const maxPeople = useMemo(
    () => Math.max(1, ...(network?.pins || []).map((p) => p.people_fed || 0)),
    [network]
  );

  const pins: Pin[] = useMemo(() => {
    return (network?.pins || []).map((p) => {
      let tone: Pin['tone'] = 'default';
      let detail = '';
      const people = p.people_fed ?? 0;
      const jobs = p.jobs_total ?? 0;

      if (network?.showImpact && mode === 'people') {
        const ratio = people / maxPeople;
        tone =
          ratio >= 0.66
            ? 'impact-high'
            : ratio >= 0.33
              ? 'impact-mid'
              : 'impact-low';
        detail = `~${people.toLocaleString('en-ZA')} people fed\n${jobs} jobs created`;
      } else if (network?.showImpact && mode === 'jobs') {
        tone = 'jobs';
        detail = `${jobs} jobs (${p.jobs_direct ?? 0} direct + ${p.jobs_support ?? 0} support)\n~${people.toLocaleString('en-ZA')} people fed`;
      } else if (p.contractor) {
        detail = `Operator: ${p.contractor}`;
      }

      return {
        id: p.id,
        position: [p.latitude, p.longitude] as [number, number],
        label: p.name,
        subtitle: [p.code, p.status, p.city, p.country].filter(Boolean).join(' · '),
        detail: detail || undefined,
        tone: mode === 'location' ? 'default' : tone,
      };
    });
  }, [network, mode, maxPeople]);

  const sortedOutlets = useMemo(() => {
    const list = [...(network?.outlets || [])];
    if (mode === 'jobs') {
      list.sort((a, b) => (b.jobs_total || 0) - (a.jobs_total || 0));
    } else if (mode === 'people') {
      list.sort((a, b) => (b.people_fed || 0) - (a.people_fed || 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [network, mode]);

  if (loading) {
    return (
      <div className="min-h-[480px] flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !network) {
    return (
      <div className="min-h-[480px] flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900 mb-1">
            Network unavailable
          </h1>
          <p className="text-sm text-slate-500">{error || 'Invalid share link'}</p>
        </div>
      </div>
    );
  }

  const m = network.metrics;
  const impact = network.impact;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
              Live network · food security & jobs
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
              {network.title}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {network.companyName}
              {network.brandName ? ` · ${network.brandName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLayer('street')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                layer === 'street'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setLayer('satellite')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                layer === 'satellite'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Satellite
            </button>
            {network.brandUrl && (
              <a
                href={network.brandUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#0077b6] hover:underline"
              >
                Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Impact KPIs — primary story for public sites */}
      {network.showImpact && impact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 pb-0">
          <Metric
            icon={Heart}
            label="People fed"
            value={impact.people_fed}
            sub="From food sales (12 mo)"
            tone="emerald"
          />
          <Metric
            icon={Briefcase}
            label="Jobs created"
            value={impact.jobs_total}
            sub={`${impact.jobs_direct} direct · ${impact.jobs_support} support`}
            tone="violet"
          />
          <Metric
            icon={Package}
            label="Outlets"
            value={impact.containers}
            sub={`${impact.staffed} staffed`}
          />
          <Metric
            icon={MapPin}
            label="Mapped"
            value={m?.mapped ?? network.pins.length}
            sub={m ? `${m.byCity.length} cities` : undefined}
          />
        </div>
      )}

      {network.showMetrics && m && !network.showImpact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4">
          <Metric icon={Package} label="Containers" value={m.total} sub={`${m.active} active`} />
          <Metric icon={MapPin} label="Mapped" value={m.mapped} sub={`${m.unmapped} unmapped`} />
          <Metric
            icon={Globe}
            label="Countries"
            value={m.byCountry.length}
            sub={m.byCountry[0]?.country || '—'}
          />
          <Metric
            icon={Users}
            label="Cities"
            value={m.byCity.length}
            sub={m.byCity[0] ? `${m.byCity[0].city} (${m.byCity[0].count})` : '—'}
          />
        </div>
      )}

      {network.showImpact && (
        <div className="flex flex-wrap gap-2 px-3 sm:px-4 pt-3">
          {(
            [
              { id: 'people' as const, label: 'People fed', icon: Heart },
              { id: 'jobs' as const, label: 'Jobs created', icon: Briefcase },
              { id: 'location' as const, label: 'Locations', icon: MapPin },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                mode === opt.id
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 sm:px-4 py-3 grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 h-[420px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-200 bg-white relative">
          <LocationMap
            pins={pins}
            layer={layer}
            height="100%"
            interactive
            scrollWheelZoom
            zoom={pins.length <= 1 ? 10 : 6}
          />
          {network.showImpact && mode !== 'location' && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs rounded-xl bg-white/95 border border-slate-200 shadow px-2.5 py-1.5 text-[10px] text-slate-600 z-[500]">
              {mode === 'people' ? (
                <span>
                  <strong className="text-emerald-700">Green</strong> higher people
                  fed · click pins for detail
                </span>
              ) : (
                <span>
                  <strong className="text-violet-700">Purple</strong> jobs per
                  outlet · click for split
                </span>
              )}
            </div>
          )}
        </div>

        {network.showList && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[520px] overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              {mode === 'people'
                ? 'Impact by outlet'
                : mode === 'jobs'
                  ? 'Jobs by outlet'
                  : `Outlets (${network.outlets.length})`}
            </h2>
            {impact && (
              <p className="text-[10px] text-slate-500 mb-3">
                Period {impact.period_from} → {impact.period_to}
              </p>
            )}
            {sortedOutlets.length === 0 ? (
              <p className="text-sm text-slate-500">No outlets published.</p>
            ) : (
              <ul className="space-y-2">
                {sortedOutlets.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <div className="font-semibold text-sm text-slate-900">
                      {o.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {o.code}
                    </div>
                    {network.showImpact && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          👥 {(o.people_fed ?? 0).toLocaleString('en-ZA')} fed
                        </span>
                        <span className="rounded-full bg-violet-50 border border-violet-100 text-violet-800 px-2 py-0.5 text-[10px] font-bold">
                          💼 {o.jobs_total ?? 0} jobs
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00b4d8]" />
                      {[o.city, o.province, o.country].filter(Boolean).join(', ') ||
                        (o.mapped ? 'Mapped' : 'No GPS')}
                    </div>
                    {o.contractor && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Operator: {o.contractor}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {impact?.methodology && (
        <p className="px-4 pb-2 text-[10px] text-slate-400 leading-relaxed max-w-3xl">
          {impact.methodology}
        </p>
      )}

      <footer className="border-t border-slate-200 bg-white px-4 py-2.5 text-[10px] text-slate-400 flex flex-wrap justify-between gap-2">
        <span>
          Powered by{' '}
          <a
            href="https://www.supplieradvisor.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#00b4d8] hover:underline"
          >
            SupplierAdvisor®
          </a>
        </span>
        <span>
          Updated{' '}
          {new Date(network.generatedAt).toLocaleString('en-ZA', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </footer>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'violet';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'violet'
        ? 'border-violet-100 bg-violet-50/40'
        : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border px-3 py-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
        <Icon className="w-3 h-3 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-xl font-black tabular-nums text-slate-900">
        {typeof value === 'number' ? value.toLocaleString('en-ZA') : value}
      </div>
      {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}
