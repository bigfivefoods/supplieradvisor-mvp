'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Landmark,
  Loader2,
  RefreshCw,
  School,
  Trophy,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

const REPORTS = [
  { id: 'overview', label: 'Overview' },
  { id: 'claims', label: 'Claims inbox' },
  { id: 'members', label: 'Organisations' },
  { id: 'province', label: 'By province' },
  { id: 'district', label: 'By district' },
  { id: 'quintile', label: 'By quintile' },
  { id: 'prizes', label: 'Prize board' },
  { id: 'feeding', label: 'Feeding' },
  { id: 'risks', label: 'Risks' },
  { id: 'map', label: 'Map list' },
] as const;

type Member = {
  school_profile_id: number;
  name: string;
  emis: string | null;
  province: string | null;
  district: string | null;
  quintile: number | null;
  lat: number | null;
  lng: number | null;
  link_status: string;
  learners_enrolled: number;
  learners_verified: number;
  learners_eligible: number;
  meals_served: number;
  meals_planned: number;
  meals_waste: number;
  feeding_days: number;
  po_spend: number;
  approved_brand_pct: number | null;
  prize_score: number | null;
  open_compliance: number;
  verify_pct: number;
  non_approved_receipts: number;
};

export default function AgencyReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [report, setReport] = useState<string>('overview');
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        report,
        status: 'active',
      });
      if (province) params.set('province', province);
      if (district) params.set('district', district);
      const res = await fetch(`/api/schools/agency/report?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warnings?.[0]) toast.message(String(json.warnings[0]));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to, report, province, district]);

  useEffect(() => {
    void load();
  }, [load]);

  const k = (data?.kpis || {}) as Record<string, number | null>;
  const agency = (data?.agency || {}) as Record<string, string>;
  const members = (data?.members || []) as Member[];
  const byProvince = (data?.byProvince || []) as Array<Record<string, unknown>>;
  const byDistrict = (data?.byDistrict || []) as Array<Record<string, unknown>>;
  const byQuintile = (data?.byQuintile || []) as Array<Record<string, unknown>>;
  const prizeBoard = (data?.prizeLeaderboard || []) as Array<
    Record<string, unknown>
  >;
  const feedingTrend = (data?.feedingTrend || []) as Array<{
    month: string;
    served: number;
    planned: number;
    waste: number;
  }>;
  const risks = (data?.risks || {}) as Record<string, Member[]>;
  const claims = (data?.claims || []) as Array<Record<string, unknown>>;
  const claimsInbox = (data?.claimsInbox || []) as Array<
    Record<string, unknown>
  >;
  const facets = (data?.facets || { provinces: [], districts: [] }) as {
    provinces: string[];
    districts: string[];
  };

  const reviewClaim = async (
    claimId: number,
    status: 'approved' | 'rejected' | 'paid'
  ) => {
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'review_claim',
          claim_id: claimId,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Review failed');
      toast.success(`Claim ${status}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const filteredMembers = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return members;
    return members.filter((m) => {
      const hay = `${m.name} ${m.emis || ''} ${m.province || ''} ${m.district || ''}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [members, q]);

  const exportCsv = () => {
    const lines = [
      'name,emis,province,district,quintile,learners,verified,eligible,verify_pct,meals_served,meals_waste,po_spend,approved_brand_pct,prize_score,open_compliance',
    ];
    for (const m of filteredMembers) {
      lines.push(
        [
          csv(m.name),
          m.emis || '',
          m.province || '',
          m.district || '',
          m.quintile ?? '',
          m.learners_enrolled,
          m.learners_verified,
          m.learners_eligible,
          m.verify_pct,
          m.meals_served,
          m.meals_waste,
          m.po_spend,
          m.approved_brand_pct ?? '',
          m.prize_score ?? '',
          m.open_compliance,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dbe-agency-report-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (forbidden) {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Agency reports"
          titleAccent="DBE only"
          description="Register this company as a DBE / PEU agency first."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <Landmark className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <p className="font-bold text-slate-900">Not registered as an agency</p>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Open DBE &amp; agencies, register as Department of Basic Education
            (or PEU), approve schools that join, then return for programme-wide
            reports.
          </p>
          <Link
            href="/dashboard/schools/agency"
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex"
          >
            Go to DBE / agencies →
          </Link>
        </div>
      </SchoolsPage>
    );
  }

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Agency reports"
        titleAccent={agency.name || 'DBE'}
        description={`Programme roll-up of approved schools/organisations · ${period.label} (${period.from} → ${period.to}). Hospitals & other orgs can join the same association model later.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/agency"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Approve members
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              report === r.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setDistrict('');
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All provinces</option>
          {facets.provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All districts</option>
          {facets.districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search school / EMIS…"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-52"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi
              icon={School}
              label="Approved orgs"
              value={String(k.organisations ?? 0)}
              sub={`${k.schools ?? 0} schools · ${k.hospitals ?? 0} hospitals`}
            />
            <Kpi
              icon={Users}
              label="Learners"
              value={String(k.totalLearners ?? 0)}
              sub={`${k.totalVerified ?? 0} verified · avg ${k.avgVerifyPct ?? '—'}%`}
            />
            <Kpi
              icon={UtensilsCrossed}
              label="Meals served"
              value={String(k.mealsServed ?? 0)}
              sub={`Waste ${k.wastePct ?? 0}%`}
              tone="emerald"
            />
            <Kpi
              icon={Trophy}
              label="Avg prize score"
              value={
                k.avgPrizeScore != null ? String(k.avgPrizeScore) : '—'
              }
              sub={`Approved brand avg ${k.avgApprovedBrandPct ?? '—'}%`}
              tone="amber"
            />
            <Kpi
              icon={Wallet}
              label="Claims inbox"
              value={String(k.submittedClaims ?? claimsInbox.length ?? 0)}
              sub={`${k.totalClaims ?? claims.length} total packs`}
              tone="amber"
            />
            <Kpi
              icon={Wallet}
              label="PO spend"
              value={formatMoney(Number(k.poSpend || 0))}
              sub={`${k.poCount ?? 0} orders`}
            />
            <Kpi
              icon={AlertTriangle}
              label="Open compliance"
              value={String(k.openCompliance ?? 0)}
              sub={`${k.nonApprovedReceipts ?? 0} non-approved GRNs`}
              tone="amber"
            />
            <Kpi
              icon={Landmark}
              label="GPS mapped"
              value={String(k.withGps ?? 0)}
              sub="Schools with coordinates"
            />
            <Kpi
              icon={Users}
              label="NSNP eligible"
              value={String(k.totalEligible ?? 0)}
              sub={`${k.totalStaff ?? 0} staff on books`}
            />
          </div>

          {(report === 'claims' ||
            (report === 'overview' && claimsInbox.length > 0)) && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-6">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  {report === 'claims'
                    ? 'All claim packs'
                    : `Claims awaiting review (${claimsInbox.length})`}
                </span>
                {report !== 'claims' ? (
                  <button
                    type="button"
                    onClick={() => setReport('claims')}
                    className="text-[11px] font-bold text-[#0077b6]"
                  >
                    Full inbox →
                  </button>
                ) : null}
              </div>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">School</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Meals</th>
                    <th className="px-3 py-3 text-right">Claim</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(report === 'claims' ? claims : claimsInbox).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No claim packs yet. Schools submit under Claims after
                        serve-day logging.
                      </td>
                    </tr>
                  ) : (
                    (report === 'claims' ? claims : claimsInbox).map((c) => (
                      <tr
                        key={String(c.id)}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-3 font-semibold">
                          {String(c.school_name || 'School')}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {String(c.period_from)} → {String(c.period_to)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          {String(c.meals_served ?? '—')}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          {formatMoney(Number(c.claim_amount || 0))}
                        </td>
                        <td className="px-3 py-3 capitalize text-xs font-bold">
                          {String(c.status)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {c.status === 'submitted' ? (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'approved')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'paid')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200"
                              >
                                Paid
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'rejected')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200"
                              >
                                Reject
                              </button>
                            </div>
                          ) : c.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void reviewClaim(Number(c.id), 'paid')
                              }
                              className="text-[10px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200"
                            >
                              Mark paid
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {(report === 'overview' || report === 'members') && (
            <MemberTable members={filteredMembers} />
          )}

          {report === 'province' && (
            <GroupTable
              title="By province"
              rows={byProvince}
              keyLabel="Province"
            />
          )}
          {report === 'district' && (
            <GroupTable
              title="By district"
              rows={byDistrict}
              keyLabel="District"
            />
          )}
          {report === 'quintile' && (
            <GroupTable
              title="By quintile"
              rows={byQuintile}
              keyLabel="Quintile"
            />
          )}

          {report === 'prizes' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Prize leaderboard (approved members)
              </div>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">School</th>
                    <th className="px-3 py-3">Province</th>
                    <th className="px-3 py-3 text-right">Learners</th>
                    <th className="px-3 py-3 text-right">Approved %</th>
                    <th className="px-3 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {prizeBoard.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No prize scores yet across approved members.
                      </td>
                    </tr>
                  ) : (
                    prizeBoard.map((b) => (
                      <tr
                        key={String(b.rank)}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-2 font-black">{String(b.rank)}</td>
                        <td className="px-3 py-2 font-semibold">
                          {String(b.name)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {[b.district, b.province]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(b.learners_enrolled || 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {b.approved_brand_pct != null
                            ? `${Number(b.approved_brand_pct).toFixed(0)}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-black tabular-nums">
                          {b.prize_score != null
                            ? Number(b.prize_score).toFixed(1)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {report === 'feeding' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Network feeding trend
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-3 py-3 text-right">Planned</th>
                    <th className="px-3 py-3 text-right">Served</th>
                    <th className="px-3 py-3 text-right">Waste</th>
                  </tr>
                </thead>
                <tbody>
                  {feedingTrend.map((t) => (
                    <tr key={t.month} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs font-bold">
                        {t.month}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.planned}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {t.served}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.waste}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report === 'risks' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <RiskCard
                title="Low learner verification"
                items={risks.lowVerify || []}
                primary={(m) => `${m.verify_pct}% verified`}
              />
              <RiskCard
                title="Low approved-brand compliance"
                items={risks.lowApprovedBrand || []}
                primary={(m) =>
                  m.approved_brand_pct != null
                    ? `${m.approved_brand_pct}%`
                    : '—'
                }
              />
              <RiskCard
                title="High waste"
                items={risks.highWaste || []}
                primary={(m) =>
                  m.meals_served
                    ? `${Math.round((m.meals_waste / m.meals_served) * 100)}% waste`
                    : '—'
                }
              />
              <RiskCard
                title="Open compliance items"
                items={risks.openCompliance || []}
                primary={(m) => `${m.open_compliance} open`}
              />
              <RiskCard
                title="No feeding logged in period"
                items={risks.noFeedingLogged || []}
                primary={() => '0 days'}
              />
            </div>
          )}

          {report === 'map' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Locations ({filteredMembers.filter((m) => m.lat != null).length}{' '}
                with GPS)
              </div>
              <ul className="divide-y max-h-[480px] overflow-y-auto">
                {filteredMembers.map((m) => (
                  <li
                    key={m.school_profile_id}
                    className="px-4 py-3 flex justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {[m.district, m.province].filter(Boolean).join(' · ')}
                        {' · '}
                        {m.learners_enrolled} learners
                      </p>
                    </div>
                    {m.lat != null && m.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#0077b6] hover:underline shrink-0"
                      >
                        Map →
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400">No GPS</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </SchoolsPage>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'amber';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40'
        : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
        <Icon className="w-3.5 h-3.5 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-xl font-black tabular-nums mt-0.5 break-all">
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

function MemberTable({ members }: { members: Member[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
        Approved organisations · {members.length}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">Organisation</th>
              <th className="px-3 py-3">EMIS</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3 text-right">Learners</th>
              <th className="px-3 py-3 text-right">Verified %</th>
              <th className="px-3 py-3 text-right">Meals</th>
              <th className="px-3 py-3 text-right">PO spend</th>
              <th className="px-3 py-3 text-right">Approved %</th>
              <th className="px-3 py-3 text-right">Prize</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No approved organisations in this filter. Approve schools
                  under DBE → associations first.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.school_profile_id}
                  className="border-b border-slate-50 hover:bg-sky-50/40"
                >
                  <td className="px-4 py-2.5 font-semibold">{m.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {m.emis || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {[m.district, m.province].filter(Boolean).join(', ') ||
                      '—'}
                    {m.quintile != null ? ` · Q${m.quintile}` : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.learners_enrolled}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.verify_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                    {m.meals_served}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(m.po_spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.approved_brand_pct != null
                      ? `${m.approved_brand_pct}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black tabular-nums">
                    {m.prize_score != null ? m.prize_score.toFixed(1) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupTable({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  keyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
            <th className="px-4 py-3">{keyLabel}</th>
            <th className="px-3 py-3 text-right">Orgs</th>
            <th className="px-3 py-3 text-right">Learners</th>
            <th className="px-3 py-3 text-right">Verified</th>
            <th className="px-3 py-3 text-right">Meals</th>
            <th className="px-3 py-3 text-right">PO spend</th>
            <th className="px-3 py-3 text-right">Avg prize</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.key)} className="border-b border-slate-50">
              <td className="px-4 py-2 font-semibold">{String(r.key)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(r.organisations || 0)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(r.learners || 0)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(r.verified || 0)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(r.meals_served || 0)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold">
                {formatMoney(Number(r.po_spend || 0))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.avg_prize != null ? Number(r.avg_prize).toFixed(1) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskCard({
  title,
  items,
  primary,
}: {
  title: string;
  items: Member[];
  primary: (m: Member) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-black flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None flagged</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {items.map((m, i) => (
            <li
              key={m.school_profile_id}
              className="flex justify-between gap-2 border-b border-slate-50 pb-1.5"
            >
              <span className="font-semibold truncate">
                {i + 1}. {m.name}
              </span>
              <span className="text-xs font-bold tabular-nums shrink-0">
                {primary(m)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
