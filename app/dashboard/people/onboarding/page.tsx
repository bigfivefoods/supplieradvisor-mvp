'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import {
  defaultOnboardingChecklist,
  statusBadgeClass,
} from '@/lib/hr/types';

type ChecklistItem = { id: string; label: string; done: boolean };

type Emp = {
  id: number;
  full_name: string;
  job_title?: string | null;
  status?: string | null;
  onboarding_status?: string | null;
  onboarding_checklist?: ChecklistItem[] | null;
  start_date?: string | null;
};

export default function OnboardingPage() {
  const companyId = getSelectedCompanyId()!;
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/employees?companyId=${companyId}`);
      const data = await res.json();
      const rows = (data.employees || []).filter(
        (e: Emp) => e.status !== 'terminated'
      );
      setEmployees(rows);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function checklistOf(e: Emp): ChecklistItem[] {
    if (Array.isArray(e.onboarding_checklist) && e.onboarding_checklist.length) {
      return e.onboarding_checklist as ChecklistItem[];
    }
    return defaultOnboardingChecklist();
  }

  async function toggle(emp: Emp, itemId: string) {
    const list = checklistOf(emp).map((i) =>
      i.id === itemId ? { ...i, done: !i.done } : i
    );
    const allDone = list.every((i) => i.done);
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          id: emp.id,
          onboarding_checklist: list,
          onboarding_status: allDone
            ? 'complete'
            : list.some((i) => i.done)
              ? 'in_progress'
              : 'not_started',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      void load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const open = employees.filter((e) => e.onboarding_status !== 'complete');

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="Onboarding"
        titleAccent="checklists"
        description="Track every new hire from contract signature to system access and SHEQ induction."
        action={
          <Link
            href="/dashboard/people/directory?new=1"
            className="btn-primary !py-2.5 !px-4 text-sm"
          >
            Add hire
          </Link>
        }
      />

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : open.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              All employees are fully onboarded — or none added yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {open.map((e) => {
              const list = checklistOf(e);
              const done = list.filter((i) => i.done).length;
              return (
                <div
                  key={e.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="font-bold text-slate-900">
                        {e.full_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {e.job_title || '—'}
                        {e.start_date ? ` · start ${e.start_date}` : ''}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(e.onboarding_status || 'not_started')}`}
                    >
                      {e.onboarding_status || 'not_started'} · {done}/
                      {list.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white border border-slate-100 mb-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#00b4d8]"
                      style={{
                        width: `${Math.round((done / Math.max(1, list.length)) * 100)}%`,
                      }}
                    />
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {list.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void toggle(e, item.id)}
                          className={`w-full text-left rounded-xl border px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            item.done
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                              item.done
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {item.done ? '✓' : ''}
                          </span>
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </RelationshipPage>
  );
}
