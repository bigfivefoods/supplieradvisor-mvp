'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type SeriesBlock = {
  label: string;
  history: { t: string; y: number }[];
  horizon: { period: string; forecast: number; lower: number; upper: number }[];
  metrics: {
    n: number;
    mean: number;
    rmse: number;
    mape: number | null;
    r2: number | null;
    trend: string;
    method: string;
  };
  insight: string;
};

export default function ForecastsPage() {
  return (
    <CompanyRequired>
      <ForecastsInner />
    </CompanyRequired>
  );
}

function ForecastsInner() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(6);
  const [series, setSeries] = useState<Record<string, SeriesBlock> | null>(null);
  const [pipeline, setPipeline] = useState<{
    quotes: number;
    won: number;
    win_rate: number | null;
  } | null>(null);
  const [quality, setQuality] = useState<Record<string, number> | null>(null);
  const [active, setActive] = useState<'revenue' | 'procurement' | 'demand_units'>('revenue');

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        horizon: String(horizon),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/intelligence/forecasts?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Forecast failed');
      setSeries(json.series || null);
      setPipeline(json.pipeline || null);
      setQuality(json.data_quality || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, horizon]);

  useEffect(() => {
    void load();
  }, [load]);

  const block = series?.[active];

  const chartData = useMemo(() => {
    if (!block) return null;
    const histLabels = block.history.map((h) => h.t);
    const futLabels = block.horizon.map((h) => h.period);
    const labels = [...histLabels, ...futLabels];
    const histYs = block.history.map((h) => h.y);
    const pad = histYs.map(() => null as number | null);
    const forecastYs = [
      ...pad.slice(0, -1),
      histYs[histYs.length - 1] ?? null,
      ...block.horizon.map((h) => h.forecast),
    ];
    const upper = [
      ...pad.slice(0, -1),
      histYs[histYs.length - 1] ?? null,
      ...block.horizon.map((h) => h.upper),
    ];
    const lower = [
      ...pad.slice(0, -1),
      histYs[histYs.length - 1] ?? null,
      ...block.horizon.map((h) => h.lower),
    ];
    return {
      labels,
      datasets: [
        {
          label: 'History',
          data: [...histYs, ...futLabels.map(() => null)],
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.1)',
          tension: 0.25,
          spanGaps: false,
        },
        {
          label: 'Forecast',
          data: forecastYs,
          borderColor: '#8b5cf6',
          borderDash: [6, 4],
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: 'Upper 95%',
          data: upper,
          borderColor: 'rgba(139,92,246,0.25)',
          backgroundColor: 'rgba(139,92,246,0.08)',
          fill: '+1',
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: 'Lower 95%',
          data: lower,
          borderColor: 'rgba(139,92,246,0.25)',
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    };
  }, [block]);

  const TrendIcon =
    block?.metrics.trend === 'up'
      ? TrendingUp
      : block?.metrics.trend === 'down'
        ? TrendingDown
        : Minus;

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="ML"
        titleAccent="forecasts"
        description="Ensemble model: linear regression + Holt exponential smoothing on your live POs, invoices, sales, and stock movements. Confidence bands from residual RMSE."
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="input !py-2 !text-sm"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              {[3, 6, 9, 12].map((h) => (
                <option key={h} value={h}>
                  {h} months
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void load()} className="btn-secondary !py-2.5 !px-4 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-900 flex gap-2">
        <Brain className="w-4 h-4 shrink-0 mt-0.5" />
        Statistical ML (not a black-box LLM). Method: ensemble_linear_regression_holt · transparent
        metrics (RMSE, MAPE, R²).
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ['revenue', 'Revenue'],
            ['procurement', 'Procurement'],
            ['demand_units', 'Demand units'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setActive(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              active === k
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white border-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : !block ? (
        <Panel title="No series">
          <div className="p-8 text-sm text-neutral-500">No forecast data available.</div>
        </Panel>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Points', v: block.metrics.n },
              { label: 'Mean', v: block.metrics.mean.toLocaleString() },
              { label: 'RMSE', v: block.metrics.rmse },
              {
                label: 'MAPE',
                v: block.metrics.mape != null ? `${block.metrics.mape}%` : '—',
              },
              {
                label: 'R²',
                v: block.metrics.r2 != null ? block.metrics.r2 : '—',
              },
            ].map((k) => (
              <div key={k.label} className="bg-white border rounded-2xl p-4">
                <div className="text-[11px] text-neutral-500">{k.label}</div>
                <div className="text-lg font-black tracking-tight">{k.v}</div>
              </div>
            ))}
          </div>

          <Panel title={`${block.label} · trend ${block.metrics.trend}`}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2 text-violet-700">
                <TrendIcon className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">{block.metrics.method}</span>
              </div>
              <p className="text-sm text-neutral-600 mb-4">{block.insight}</p>
              {chartData && (
                <div className="h-72">
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } },
                      scales: {
                        y: { beginAtZero: true },
                      },
                    }}
                  />
                </div>
              )}
            </div>
          </Panel>

          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {pipeline && (
              <div className="bg-white border rounded-3xl p-5">
                <div className="text-[11px] font-bold uppercase text-neutral-400">Quote pipeline</div>
                <div className="text-2xl font-black mt-1">
                  {pipeline.win_rate != null ? `${pipeline.win_rate}%` : '—'}
                </div>
                <div className="text-xs text-neutral-500">
                  Win rate · {pipeline.won}/{pipeline.quotes} quotes
                </div>
              </div>
            )}
            {quality && (
              <div className="bg-white border rounded-3xl p-5">
                <div className="text-[11px] font-bold uppercase text-neutral-400">Data quality</div>
                <div className="text-xs text-neutral-600 mt-2 space-y-1">
                  <div>PO rows: {quality.po_rows}</div>
                  <div>Invoices: {quality.invoice_rows}</div>
                  <div>Container sales: {quality.sales_rows}</div>
                  <div>Movements: {quality.movement_rows}</div>
                  <div>Revenue months: {quality.months_revenue}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </IntelligencePage>
  );
}
