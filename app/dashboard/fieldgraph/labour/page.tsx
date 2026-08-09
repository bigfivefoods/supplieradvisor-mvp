'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

export default function FieldgraphLabourPage() {
  const { store, loading, saving, post } = useFieldgraph();
  const [form, setForm] = useState({
    field_id: '',
    date: new Date().toISOString().slice(0, 10),
    gang_or_person: '',
    activity: '',
    headcount: '',
    hours: '',
  });

  const add = async () => {
    if (!form.gang_or_person.trim()) {
      toast.error('Gang / person required');
      return;
    }
    await post({
      entity: 'labour_logs',
      action: 'upsert',
      record: {
        ...form,
        field_id: form.field_id || null,
        headcount: form.headcount ? Number(form.headcount) : null,
        hours: form.hours ? Number(form.hours) : null,
      },
    });
    toast.success('Labour log saved');
  };

  return (
    <FieldgraphWorkbench
      title="Labour"
      titleAccent="by field"
      description="Field gangs, headcount and hours — calendar-friendly activity capture. Pair with People for full payroll when you need it."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            For statutory payroll and leave, also use{' '}
            <Link
              href="/dashboard/people"
              className="font-bold text-emerald-700 underline"
            >
              People
            </Link>
            .
          </p>
          <div className="rounded-3xl border border-rose-100 bg-rose-50/30 p-4 grid sm:grid-cols-3 gap-2">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.field_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, field_id: e.target.value }))
              }
            >
              <option value="">Field…</option>
              {store.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Gang / person"
              value={form.gang_or_person}
              onChange={(e) =>
                setForm((f) => ({ ...f, gang_or_person: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Activity"
              value={form.activity}
              onChange={(e) =>
                setForm((f) => ({ ...f, activity: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Headcount"
              type="number"
              value={form.headcount}
              onChange={(e) =>
                setForm((f) => ({ ...f, headcount: e.target.value }))
              }
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Hours"
              type="number"
              value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void add()}
              className="btn-primary !py-2 text-sm sm:col-span-3 inline-flex justify-center gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Log labour
            </button>
          </div>
          <ul className="space-y-2">
            {store.labour_logs.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex justify-between text-sm"
              >
                <div>
                  <div className="font-bold">
                    {l.gang_or_person} · {l.activity}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {l.date}
                    {l.headcount != null ? ` · ${l.headcount} people` : ''}
                    {l.hours != null ? ` · ${l.hours}h` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void post({
                      entity: 'labour_logs',
                      action: 'delete',
                      id: l.id,
                    })
                  }
                  className="text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
