'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import { MovementLibraryBrowse } from '@/components/fitness/MovementLibraryBrowse';
import {
  CLINIC_MOVEMENT_CATEGORIES,
  isSystemClinicMovement,
  listedClinicMovements,
} from '@/lib/clinic/clinic-movements';
import type { FitMovement } from '@/lib/fitness/movements';

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
  const { companyId, store, loading, saving, post, summary } = usePhysiograph();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blank);

  const movements = store ? listedClinicMovements(store) : [];
  const customCount = movements.filter((m) => !isSystemClinicMovement(m)).length;

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

  const saveMedia = async (
    m: FitMovement,
    patch: { image_url?: string | null; video_url?: string | null }
  ) => {
    await post({
      entity: 'movements',
      action: 'upsert',
      record: {
        id: m.id,
        code: m.code,
        name: m.name,
        system: m.system === true,
        ...patch,
      },
    });
  };

  return (
    <PhysiographWorkbench
      title="Movements"
      titleAccent="floor"
      description="2,520-exercise catalogue plus physio rehab extras. Every movement has a still and a 5-second clip — replace either, then share from a visit to the client PWA."
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

          <MovementLibraryBrowse
            movements={movements as FitMovement[]}
            allowSystemEdit
            companyId={companyId}
            onSaveImage={(m, url) => saveMedia(m, { image_url: url })}
            onSaveVideo={(m, url) => saveMedia(m, { video_url: url })}
            onDelete={(m) => {
              if (isSystemClinicMovement(m)) {
                toast.error('Catalog movements cannot be deleted');
                return;
              }
              void post({ entity: 'movements', action: 'delete', id: m.id });
            }}
          />

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
