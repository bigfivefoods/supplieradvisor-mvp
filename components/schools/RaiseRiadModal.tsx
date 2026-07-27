'use client';

/**
 * DBE modal: raise a RIAD against a school or service provider.
 */
import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  SCHOOL_RIAD_CATEGORIES,
  SP_RIAD_CATEGORIES,
  SCHOOL_RIAD_TYPES,
  RIAD_PRIORITIES,
} from '@/lib/schools/riad';

export type RaiseRiadTarget = {
  type: 'school' | 'isp';
  /** school_profiles.id for school; company id for SP */
  id: number;
  /** company profile_id for school (optional) */
  companyId?: number | null;
  name: string;
  subtitle?: string | null;
};

type Props = {
  agencyCompanyId: number;
  target: RaiseRiadTarget;
  onClose: () => void;
  onSaved?: () => void;
};

const empty = {
  entry_type: 'risk',
  title: '',
  description: '',
  priority: 'medium',
  category: '',
  owner_name: '',
  due_date: '',
  mitigation_plan: '',
  notes: '',
};

export default function RaiseRiadModal({
  agencyCompanyId,
  target,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const categories =
    target.type === 'school' ? SCHOOL_RIAD_CATEGORIES : SP_RIAD_CATEGORIES;

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId: agencyCompanyId,
        target_type: target.type,
        title: form.title.trim(),
        description: form.description || null,
        entry_type: form.entry_type,
        riad_type: form.entry_type,
        priority: form.priority,
        severity: form.priority,
        category: form.category || null,
        owner_name: form.owner_name || null,
        due_date: form.due_date || null,
        mitigation_plan: form.mitigation_plan || null,
        notes: form.notes || null,
        status: 'open',
      };
      if (target.type === 'school') {
        body.school_profile_id = target.id;
      } else {
        body.isp_profile_id = target.id;
      }

      const res = await fetch('/api/schools/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to raise RIAD');
      toast.success(data.message || `RIAD raised against ${target.name}`);
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Raise RIAD · {target.type === 'school' ? 'School' : 'Service provider'}
            </p>
            <h2 className="font-black text-slate-900 mt-0.5">{target.name}</h2>
            {target.subtitle ? (
              <p className="text-xs text-slate-500 mt-0.5">{target.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {SCHOOL_RIAD_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, entry_type: t.value }))}
                className={`rounded-full px-3 py-1 text-xs font-bold border ${
                  form.entry_type === t.value
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Title *
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Short description of the risk / issue / action / decision"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Detail
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What was observed, impact, evidence…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Priority
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
              >
                {RIAD_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Category
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Owner
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.owner_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owner_name: e.target.value }))
                }
                placeholder="Responsible person"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Due date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.due_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, due_date: e.target.value }))
                }
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Mitigation / next step
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[60px]"
              value={form.mitigation_plan}
              onChange={(e) =>
                setForm((f) => ({ ...f, mitigation_plan: e.target.value }))
              }
            />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary !py-2 !px-4 text-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Raise RIAD
          </button>
        </div>
      </div>
    </div>
  );
}
