'use client';

/**
 * Self-serve family / household members on member & patient portals.
 * Parent email stays on the primary profile; kids and dependents listed here.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import {
  FAMILY_RELATIONSHIPS,
  ageFromDob,
  relationshipLabel,
} from '@/lib/services/family-members';

export type PortalFamilyRow = {
  id: string;
  name: string;
  relationship: string;
  date_of_birth?: string | null;
  id_number?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_minor?: boolean;
  active?: boolean;
  age?: number | null;
  relationship_label?: string;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  family: PortalFamilyRow[];
  onSave: (member: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  busy?: boolean;
  accentClass?: string;
  buttonClass?: string;
  /** gym | clinic | wallet wording */
  context?: 'gym' | 'clinic' | 'practice' | 'wallet';
};

const blank = () => ({
  name: '',
  relationship: 'child',
  date_of_birth: '',
  id_number: '',
  phone: '',
  notes: '',
  is_minor: true,
});

export function PortalFamilyMembers({
  family,
  onSave,
  onRemove,
  busy,
  accentClass = 'border-slate-200',
  buttonClass = 'bg-slate-900 hover:bg-slate-800',
  context = 'practice',
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(
    () =>
      (family || []).filter((m) => m.active !== false),
    [family]
  );

  const place =
    context === 'wallet'
      ? 'wallet'
      : context === 'gym'
        ? 'gym desk'
        : context === 'clinic'
          ? 'clinic'
          : 'practice';

  const startAdd = () => {
    setEditingId(null);
    setForm(blank());
    setOpen(true);
    setErr(null);
  };

  const startEdit = (m: PortalFamilyRow) => {
    setEditingId(m.id);
    setForm({
      name: m.name || '',
      relationship: String(m.relationship || 'child'),
      date_of_birth: (m.date_of_birth || '').slice(0, 10),
      id_number: m.id_number || '',
      phone: m.phone || '',
      notes: m.notes || '',
      is_minor: m.is_minor !== false,
    });
    setOpen(true);
    setErr(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setErr('Name is required');
      return;
    }
    setLocalBusy(true);
    setErr(null);
    try {
      await onSave({
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        relationship: form.relationship,
        date_of_birth: form.date_of_birth || null,
        id_number: form.id_number || '',
        phone: form.phone || '',
        notes: form.notes || '',
        is_minor: form.is_minor,
      });
      setOpen(false);
      setForm(blank());
      setEditingId(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setLocalBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your family list?`)) return;
    setLocalBusy(true);
    setErr(null);
    try {
      await onRemove(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not remove');
    } finally {
      setLocalBusy(false);
    }
  };

  const disabled = busy || localBusy;

  return (
    <div
      className={`rounded-2xl border ${accentClass} bg-slate-50/80 p-4 space-y-3`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">Family members</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {context === 'wallet'
              ? 'Add kids or household members once. Every gym and clinic you link uses this list — you should not have to recapture them.'
              : `Add kids or other household members. Your email stays as the parent/guardian contact for messages and invites; names sync to the ${place}.`}
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3">
          {context === 'wallet'
            ? 'No family members yet. Add a child or dependent here — every gym and clinic you link will pick them up.'
            : `No family members yet. Add a child or dependent so the ${place} knows who is in your household.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => {
            const age =
              m.age ?? ageFromDob(m.date_of_birth ?? undefined);
            return (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-start justify-between gap-2"
              >
                <button
                  type="button"
                  className="text-left min-w-0 flex-1"
                  onClick={() => startEdit(m)}
                  disabled={disabled}
                >
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {m.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {m.relationship_label ||
                      relationshipLabel(m.relationship)}
                    {age != null ? ` · age ${age}` : ''}
                    {m.is_minor || (age != null && age < 18)
                      ? ' · minor'
                      : ''}
                    {m.id_number ? ` · ID ${m.id_number}` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  className="text-rose-600 p-1.5 shrink-0 disabled:opacity-50"
                  title="Remove"
                  disabled={disabled}
                  onClick={() => void remove(m.id, m.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={startAdd}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add family member
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-black text-slate-800">
            {editingId ? 'Edit family member' : 'New family member'}
          </p>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Full name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={disabled}
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.relationship}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                relationship: e.target.value,
                is_minor:
                  e.target.value === 'child' || e.target.value === 'grandchild'
                    ? true
                    : f.is_minor,
              }))
            }
            disabled={disabled}
          >
            {FAMILY_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {relationshipLabel(r)}
              </option>
            ))}
          </select>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Date of birth
            </span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm((f) => ({ ...f, date_of_birth: e.target.value }))
              }
              disabled={disabled}
            />
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="ID number (optional)"
            value={form.id_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, id_number: e.target.value }))
            }
            disabled={disabled}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            disabled={disabled}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Notes (school, allergies, etc.)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            disabled={disabled}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.is_minor}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_minor: e.target.checked }))
              }
              disabled={disabled}
            />
            This person is a child / minor
          </label>
          {err ? (
            <p className="text-xs font-medium text-rose-600">{err}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                setEditingId(null);
              }}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submit()}
              className={`flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50 ${buttonClass}`}
            >
              {localBusy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : editingId ? (
                'Save'
              ) : (
                'Add'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
