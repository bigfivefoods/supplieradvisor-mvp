'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Building2,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronRight,
  Network,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { statusBadgeClass } from '@/lib/hr/types';

type OrgPerson = {
  id: number;
  full_name: string;
  job_title?: string | null;
  department?: string | null;
  status?: string | null;
  manager_id?: number | null;
  business_unit_id?: number | null;
  work_center_id?: number | null;
  employee_number?: string | null;
  last_performance_rating?: string | null;
  last_performance_score?: number | null;
  disciplinary_status?: string | null;
  children: OrgPerson[];
};

type BuNode = {
  id: number;
  code?: string | null;
  name: string;
  headcount: number;
  unallocatedInBu: number;
  workCenters: Array<{
    id: number;
    code?: string | null;
    name: string;
    headcount: number;
    people: OrgPerson[];
  }>;
  tree: OrgPerson[];
};

type Stats = {
  totalPeople: number;
  allocated: number;
  unallocated: number;
  businessUnits: number;
  withManager: number;
  withoutManager: number;
  openDisciplinary: number;
};

function PersonCard({
  person,
  depth = 0,
}: {
  person: OrgPerson;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = person.children?.length > 0;
  return (
    <div className={depth > 0 ? 'ml-4 sm:ml-6 border-l-2 border-slate-200 pl-3 sm:pl-4' : ''}>
      <div className="mb-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm hover:border-[#00b4d8]/40 transition-colors">
        <div className="flex items-start gap-2">
          {hasKids ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-0.5 p-0.5 rounded text-slate-400 hover:text-slate-700"
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              {open ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{person.full_name}</span>
              <span
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusBadgeClass(person.status)}`}
              >
                {person.status}
              </span>
              {person.disciplinary_status &&
                person.disciplinary_status !== 'clear' && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-800">
                    Disc · {person.disciplinary_status}
                  </span>
                )}
              {person.last_performance_score != null && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800">
                  Perf {person.last_performance_score}
                  {person.last_performance_rating
                    ? ` · ${person.last_performance_rating}`
                    : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {person.job_title || 'Role TBC'}
              {person.department ? ` · ${person.department}` : ''}
              {person.employee_number ? ` · ${person.employee_number}` : ''}
              {hasKids ? ` · ${person.children.length} report(s)` : ''}
            </div>
          </div>
        </div>
      </div>
      {open &&
        hasKids &&
        person.children.map((c) => (
          <PersonCard key={c.id} person={c} depth={depth + 1} />
        ))}
    </div>
  );
}

export default function OrgChartPage() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BuNode[]>([]);
  const [unallocated, setUnallocated] = useState<OrgPerson[]>([]);
  const [view, setView] = useState<'bu' | 'company'>('bu');
  const [allTree, setAllTree] = useState<OrgPerson[]>([]);
  const [expandedBu, setExpandedBu] = useState<Record<number, boolean>>({});
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/organogram?companyId=${companyId}`);
      const data = await res.json();
      setStats(data.stats || null);
      setBusinessUnits(data.businessUnits || []);
      setUnallocated(data.unallocated || []);
      setAllTree(data.allTree || []);
      setWarning(data.warning || null);
      const exp: Record<number, boolean> = {};
      for (const b of data.businessUnits || []) exp[b.id] = true;
      setExpandedBu(exp);
    } catch {
      setBusinessUnits([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Organogram"
        titleAccent="structure"
        description="Business units, work centres, and who reports to whom. Every person should sit under a business unit."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView('bu')}
              className={`!py-2 !px-3 text-xs font-bold rounded-full border ${
                view === 'bu'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-slate-200'
              }`}
            >
              By business unit
            </button>
            <button
              type="button"
              onClick={() => setView('company')}
              className={`!py-2 !px-3 text-xs font-bold rounded-full border ${
                view === 'company'
                  ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                  : 'bg-white border-slate-200'
              }`}
            >
              Full company tree
            </button>
            <Link
              href="/dashboard/people/directory?new=1"
              className="btn-primary !py-2 !px-3 text-xs"
            >
              Add person
            </Link>
          </div>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { l: 'People', v: stats.totalPeople, icon: Users },
            {
              l: 'On business units',
              v: stats.allocated,
              sub: `${stats.unallocated} unallocated`,
              warn: stats.unallocated > 0,
            },
            {
              l: 'With manager',
              v: stats.withManager,
              sub: `${stats.withoutManager} without`,
            },
            {
              l: 'Business units',
              v: stats.businessUnits,
              icon: Building2,
            },
          ].map((c) => (
            <div
              key={c.l}
              className={`rounded-2xl border bg-white px-4 py-3 ${
                c.warn ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {c.l}
              </div>
              <div className="text-2xl font-black text-slate-900">{c.v}</div>
              {c.sub && (
                <div
                  className={`text-[11px] ${c.warn ? 'text-amber-800 font-semibold' : 'text-neutral-500'}`}
                >
                  {c.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {stats && stats.unallocated > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-amber-950">
              {stats.unallocated} people not allocated to a business unit
            </div>
            <p className="text-sm text-amber-900/80 mt-0.5">
              Open Directory and set Business unit for each person so payroll and
              cost centres allocate correctly.
            </p>
            <Link
              href="/dashboard/people/directory"
              className="inline-block mt-2 text-sm font-bold text-[#0077b6] underline"
            >
              Fix in directory →
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : view === 'company' ? (
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-4 h-4 text-[#00b4d8]" />
            <h3 className="font-bold">Company reporting tree</h3>
          </div>
          {allTree.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              No active people yet.
            </p>
          ) : (
            allTree.map((p) => <PersonCard key={p.id} person={p} />)
          )}
        </Panel>
      ) : (
        <div className="space-y-4">
          {businessUnits.length === 0 && (
            <Panel>
              <p className="text-sm text-neutral-600 py-6 text-center">
                No business units yet.{' '}
                <Link
                  href="/dashboard/manufacturing/cost-centres"
                  className="font-bold text-[#00b4d8] underline"
                >
                  Create business units
                </Link>{' '}
                then allocate people in the directory.
              </p>
            </Panel>
          )}

          {businessUnits.map((bu) => {
            const open = expandedBu[bu.id] !== false;
            return (
              <div
                key={bu.id}
                className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBu((prev) => ({
                      ...prev,
                      [bu.id]: !open,
                    }))
                  }
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-violet-50/80 to-white text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-2xl bg-violet-100 text-violet-800 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-slate-900">
                        {bu.code ? `${bu.code} · ` : ''}
                        {bu.name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {bu.headcount} people
                        {bu.workCenters.length
                          ? ` · ${bu.workCenters.length} work centre(s)`
                          : ''}
                      </div>
                    </div>
                  </div>
                  {open ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                {open && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100">
                    {bu.headcount === 0 ? (
                      <p className="text-sm text-neutral-500 py-4">
                        No people allocated to this business unit yet.
                      </p>
                    ) : (
                      <>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Reporting lines in this BU
                        </div>
                        {bu.tree.map((p) => (
                          <PersonCard key={p.id} person={p} />
                        ))}
                        {bu.workCenters.some((w) => w.headcount > 0) && (
                          <div className="mt-6 space-y-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              By work centre
                            </div>
                            {bu.workCenters
                              .filter((w) => w.headcount > 0)
                              .map((wc) => (
                                <div
                                  key={wc.id}
                                  className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3"
                                >
                                  <div className="font-bold text-sm text-sky-950 mb-2">
                                    {wc.code ? `${wc.code} · ` : ''}
                                    {wc.name}
                                    <span className="ml-2 font-normal text-sky-800/70">
                                      ({wc.headcount})
                                    </span>
                                  </div>
                                  {wc.people.map((p) => (
                                    <PersonCard key={p.id} person={p} />
                                  ))}
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {unallocated.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <h3 className="font-bold text-amber-950">
                  Unallocated (no business unit)
                </h3>
              </div>
              <div className="px-5 py-4">
                {unallocated.map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </RelationshipPage>
  );
}
