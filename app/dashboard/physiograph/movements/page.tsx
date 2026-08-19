'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import {
  CLINIC_MOVEMENT_CATEGORIES,
  isSystemClinicMovement,
  type ClinicMovement,
} from '@/lib/clinic/clinic-movements';

const blank = () => ({
  name: '',
  category: 'Knee',
  equipment: '',
  muscles: '',
  level: 'beginner',
  overview: '',
  details: '',
  active: true,
});

export default function PhysioMovementsPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [openId, setOpenId] = useState<string | null>(null);

  const movements = store?.movements || [];
  const customCount = movements.filter((m) => !isSystemClinicMovement(m)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (m.active === false) return false;
      if (category && m.category !== category) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        String(m.overview || '')
          .toLowerCase()
          .includes(q) ||
        String(m.muscles || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [movements, query, category]);

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'movements',
      action: 'upsert',
      record: {
        name: form.name.trim(),
        category: form.category,
        equipment: form.equipment.trim() || undefined,
        muscles: form.muscles.trim() || undefined,
        level: form.level,
        overview: form.overview.trim() || undefined,
        details: form.details.trim() || undefined,
        active: form.active,
        system: false,
      },
    });
    toast.success('Added to the clinic movement library');
    setForm(blank());
    setAddOpen(false);
  };

  return (
    <PhysiographWorkbench
      title="Movements"
      titleAccent="floor"
      description="Exhaustive rehab movement library. Share from a calendar visit — the client sees the movement, sets and notes on their PWA profile."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'In library',
                value: Number(summary?.movementCount) || movements.length,
              },
              { label: 'Clinic-added', value: customCount },
              { label: 'Categories', value: CLINIC_MOVEMENT_CATEGORIES.length },
            ]}
          />

          <div className="grid sm:grid-cols-2 gap-2">
            <input
              className={fc()}
              placeholder="Search (e.g. chin tuck, clamshell, heel slide)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={fc()}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All regions</option>
              {CLINIC_MOVEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500">
            Showing {filtered.length} of {movements.length}. Open a calendar
            appointment to send a movement to a client.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m: ClinicMovement) => {
              const open = openId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOpenId(open ? null : m.id)}
                  className="rounded-2xl border border-teal-200 bg-white p-3 text-left hover:border-teal-400 dark:border-teal-800 dark:bg-teal-950/30"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    {m.category}
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-900 dark:text-teal-50">
                    {m.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-teal-200/80">
                    {m.overview}
                  </p>
                  {open && m.details ? (
                    <p className="mt-2 whitespace-pre-wrap text-[11px] text-slate-700 dark:text-teal-100">
                      {m.details}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] text-slate-400">
                    {[m.level, m.equipment, m.muscles]
                      .filter(Boolean)
                      .join(' · ')}
                    {isSystemClinicMovement(m) ? ' · catalogue' : ' · clinic'}
                  </p>
                </button>
              );
            })}
          </div>

          <AdvisorExpandablePanel
            title="Add a clinic movement"
            description="Your own exercise on top of the catalogue."
            open={addOpen}
            onToggle={() => setAddOpen((v) => !v)}
            accentClass="border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30"
            titleClass="text-teal-950 dark:text-teal-50"
            hintClass="text-teal-800/80 dark:text-teal-200/80"
          >
            <FormCard
              title="New movement"
              onSubmit={() => void add()}
              saving={saving}
              submitLabel="Add movement"
            >
              <input
                className={fc()}
                placeholder="Name *"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <select
                className={fc()}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {CLINIC_MOVEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className={fc()}
                placeholder="Equipment (optional)"
                value={form.equipment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, equipment: e.target.value }))
                }
              />
              <input
                className={fc()}
                placeholder="Muscles / tissues"
                value={form.muscles}
                onChange={(e) =>
                  setForm((f) => ({ ...f, muscles: e.target.value }))
                }
              />
              <textarea
                className={fc() + ' min-h-[3rem] sm:col-span-2'}
                placeholder="Short overview (client-facing)"
                value={form.overview}
                onChange={(e) =>
                  setForm((f) => ({ ...f, overview: e.target.value }))
                }
              />
              <textarea
                className={fc() + ' min-h-[4rem] sm:col-span-2'}
                placeholder="Coaching details / cues"
                value={form.details}
                onChange={(e) =>
                  setForm((f) => ({ ...f, details: e.target.value }))
                }
              />
            </FormCard>
          </AdvisorExpandablePanel>
        </div>
      )}
    </PhysiographWorkbench>
  );
}
