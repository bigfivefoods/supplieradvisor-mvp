'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { MovementMediaFields } from '@/components/fitness/MovementMediaFields';
import { MovementLibraryBrowse } from '@/components/fitness/MovementLibraryBrowse';
import { isSystemMovement } from '@/lib/fitness/movement-catalog';
import { MOVEMENT_CATEGORIES } from '@/lib/fitness/movements';
import type { FitMovement } from '@/lib/fitness/movements';

const blank = () => ({
  name: '',
  category: 'Other',
  equipment: '',
  muscles: '',
  level: 'beginner',
  overview: '',
  details: '',
  video_description: '',
  image_url: '',
  video_url: '',
  coach_id: '',
  active: true,
});

export default function MovementsPage() {
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);

  const movements = store?.movements || [];
  const customCount = movements.filter((m) => !isSystemMovement(m)).length;

  const editing = useMemo(
    () =>
      editingId ? movements.find((m) => m.id === editingId) || null : null,
    [movements, editingId]
  );

  const startEdit = (m: FitMovement) => {
    setEditingId(m.id);
    setShowForm(true);
    setForm({
      name: m.name || '',
      category: m.category || 'Other',
      equipment: m.equipment || '',
      muscles: m.muscles || '',
      level: String(m.level || 'beginner'),
      overview: m.overview || '',
      details: m.details || m.description || '',
      video_description: m.video_description || '',
      image_url: m.image_url || '',
      video_url: m.video_url || '',
      coach_id: m.coach_id || '',
      active: m.active !== false,
    });
    requestAnimationFrame(() =>
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    );
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const existing = editingId
      ? movements.find((m) => m.id === editingId)
      : null;
    await post({
      entity: 'movements',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        category: form.category || undefined,
        equipment: form.equipment.trim() || undefined,
        muscles: form.muscles.trim() || undefined,
        level: form.level || undefined,
        overview: form.overview.trim() || undefined,
        details: form.details.trim() || undefined,
        description: form.details.trim() || form.overview.trim() || undefined,
        video_description: form.video_description.trim() || undefined,
        image_url: form.image_url.trim() || null,
        video_url: form.video_url.trim() || null,
        coach_id: form.coach_id || null,
        active: form.active,
        system: existing ? existing.system === true : false,
        code: existing?.code,
      },
    });
    toast.success(
      editingId ? 'Movement updated' : 'Added to the gym library'
    );
    setEditingId(null);
    setForm(blank());
    setShowForm(false);
  };

  return (
    <FitgraphWorkbench
      title="Movement library"
      titleAccent="catalog + your own"
      description="Every movement has a 3D instructional photo plus overview and coaching details. Open a card to replace the photo — or restore the catalog plate. Add your own movements on top."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'In library',
                value: Number(summary?.movementCount) || movements.length,
              },
              { label: 'Gym-added', value: customCount },
              {
                label: 'Programmes',
                value:
                  Number(summary?.programmeCount) ||
                  (store.programmes || []).length,
              },
            ]}
          />
          <p className="text-xs text-slate-500">
            Use these in a{' '}
            <Link
              href="/dashboard/fitgraph/programmes"
              className="font-bold text-yellow-700 underline"
            >
              programme
            </Link>
            , then allocate it to a class or personal training. Catalog items
            stay in the library — add your own instead of deleting them.
          </p>

          <MovementLibraryBrowse
            movements={movements}
            allowSystemEdit
            companyId={companyId}
            onSaveImage={async (m, url) => {
              await post({
                entity: 'movements',
                action: 'upsert',
                record: {
                  id: m.id,
                  image_url: url,
                  system: m.system === true,
                  code: m.code,
                },
              });
            }}
            onEdit={startEdit}
            onDelete={(m) => {
              if (isSystemMovement(m)) {
                toast.error('Catalog movements cannot be deleted');
                return;
              }
              void post({ entity: 'movements', action: 'delete', id: m.id });
            }}
          />

          <div ref={formAnchorRef}>
            {!showForm ? (
              <button
                type="button"
                className="rounded-xl border border-yellow-300 bg-white px-3 py-2 text-xs font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100"
                onClick={() => {
                  setEditingId(null);
                  setForm(blank());
                  setShowForm(true);
                }}
              >
                + Add your own movement
              </button>
            ) : (
              <FormCard
                tone="owner"
                title={
                  editingId
                    ? `${isSystemMovement(editing || { id: '' }) ? 'Customise' : 'Edit'} · ${editing?.name || form.name}`
                    : 'Add your own movement'
                }
                description={
                  editingId && isSystemMovement(editing || { id: '' })
                    ? 'You can add media or tweak notes for this gym. The catalog name stays available to every coach.'
                    : 'This sits in the same library as the catalog. Pick a category so coaches can find it.'
                }
                onSubmit={() => void save()}
                saving={saving}
                submitLabel={editingId ? 'Save movement' : 'Add to library'}
              >
                <input
                  className={fc()}
                  placeholder="Name (e.g. Landmine squat)"
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
                  {MOVEMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className={fc()}
                  value={form.level}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, level: e.target.value }))
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <input
                  className={fc()}
                  placeholder="Equipment"
                  value={form.equipment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, equipment: e.target.value }))
                  }
                />
                <input
                  className={fc()}
                  placeholder="Primary muscles"
                  value={form.muscles}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, muscles: e.target.value }))
                  }
                />
                <select
                  className={fc()}
                  value={form.coach_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, coach_id: e.target.value }))
                  }
                >
                  <option value="">Gym-wide (all coaches)</option>
                  {store.coaches
                    .filter((c) => c.active !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}’s library
                      </option>
                    ))}
                </select>
                <textarea
                  className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
                  placeholder="Overview — one or two sentences"
                  value={form.overview}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, overview: e.target.value }))
                  }
                />
                <textarea
                  className={fc() + ' min-h-[5rem] resize-y sm:col-span-2 lg:col-span-3'}
                  placeholder="Details — setup, cues, common faults, how to scale"
                  value={form.details}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, details: e.target.value }))
                  }
                />
                <MovementMediaFields
                  companyId={companyId}
                  imageUrl={form.image_url}
                  videoUrl={form.video_url}
                  videoDescription={form.video_description}
                  onChange={(patch) =>
                    setForm((f) => ({
                      ...f,
                      image_url: patch.image_url ?? f.image_url,
                      video_url: patch.video_url ?? f.video_url,
                      video_description:
                        patch.video_description ?? f.video_description,
                    }))
                  }
                />
                <label className="flex items-center gap-2 text-sm px-1">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                  />
                  Active in library
                </label>
                <button
                  type="button"
                  className="text-xs font-bold text-slate-500 underline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blank());
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              </FormCard>
            )}
          </div>
        </div>
      )}
    </FitgraphWorkbench>
  );
}
