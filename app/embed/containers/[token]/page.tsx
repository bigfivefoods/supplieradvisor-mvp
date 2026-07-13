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
} from 'lucide-react';
import type { MapPin as Pin } from '@/components/LocationMap';
import type { PublicNetworkPayload } from '@/lib/containers/public-share';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

export default function EmbedContainerNetworkPage() {
  const { token } = useParams() as { token: string };
  const [network, setNetwork] = useState<PublicNetworkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');

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

  const pins: Pin[] = useMemo(
    () =>
      (network?.pins || []).map((p) => ({
        id: p.id,
        position: [p.latitude, p.longitude] as [number, number],
        label: p.name,
        subtitle: [
          p.code,
          p.status,
          p.city,
          p.country,
          p.contractor,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [network]
  );

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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Compact header for iframe */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
              Live network
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

      {network.showMetrics && m && (
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

      <div className="px-3 sm:px-4 pb-4 grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 h-[420px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <LocationMap
            pins={pins}
            layer={layer}
            height="100%"
            interactive
            scrollWheelZoom
            zoom={pins.length <= 1 ? 10 : 6}
          />
        </div>

        {network.showList && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[520px] overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              Outlets ({network.outlets.length})
            </h2>
            {network.outlets.length === 0 ? (
              <p className="text-sm text-slate-500">No outlets published.</p>
            ) : (
              <ul className="space-y-2">
                {network.outlets.map((o) => (
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
        <Icon className="w-3 h-3 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-xl font-black tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}
