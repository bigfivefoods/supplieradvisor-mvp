'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { VukaClassBoard } from '@/components/fitness/VukaClassBoard';
import {
  listSubscribeClasses,
  storeUsesClassSubscribe,
  VUKA_JOINING,
} from '@/lib/fitness/vuka-class-catalog';

const blankForm = () => ({
  code: '',
  name: '',
  category: 'HIIT',
  default_duration_min: '45',
  capacity: '16',
  description: '',
  active: true,
});

export default function ClassesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const subscribeClasses = store ? listSubscribeClasses(store) : [];
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);

  const editing = useMemo(
    () =>
      editingId && store
        ? store.class_types.find((c) => c.id === editingId) || null
        : null,
    [store, editingId]
  );

  const startEdit = (id: string) => {
    const c = store?.class_types.find((x) => x.id === id);
    if (!c) {
      toast.error('Class type not found');
      return;
    }
    setEditingId(c.id);
    setForm({
      code: c.code || '',
      name: c.name || '',
      category: c.category || '',
      default_duration_min: String(c.default_duration_min ?? 45),
      capacity: String(c.capacity ?? 16),
      description: c.description || '',
      active: c.active !== false,
    });
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm());
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'class_types',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        default_duration_min: Number(form.default_duration_min) || 45,
        capacity: Number(form.capacity) || 16,
        description: form.description.trim() || undefined,
        active: form.active,
      },
    });
    toast.success(editingId ? 'Class type updated' : 'Class type saved');
    setEditingId(null);
    setForm(blankForm());
  };

  return (
    <FitgraphWorkbench
      title={classSubscribe ? 'Classes' : 'Class types'}
      titleAccent={classSubscribe ? 'subscribe' : 'catalogue'}
      description={
        classSubscribe
          ? 'These are the VUKA classes members subscribe to. Their monthly fee is the sum of the classes they pick. Then you or a coach book them into each session.'
          : 'Step 1 of the floor flow: define class types first (HIIT, strength, yoga…). Edit any type below, then Calendar → create a class → assign coach → add members.'
      }
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: classSubscribe ? 'Subscribe classes' : 'Class types',
                value: classSubscribe
                  ? subscribeClasses.length
                  : Number(summary?.classTypeCount) || store.class_types.length,
              },
              {
                label: 'Active types',
                value: store.class_types.filter((c) => c.active !== false)
                  .length,
              },
              ...(classSubscribe
                ? [
                    {
                      label: 'Class subscribers',
                      value: subscribeClasses.reduce(
                        (n, c) => n + c.subscribers,
                        0
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {classSubscribe ? (
            <VukaClassBoard
              classes={subscribeClasses}
              joining={
                store.settings?.joining_fee_zar != null
                  ? {
                      fee_zar: store.settings.joining_fee_zar,
                      waived: store.settings.joining_fee_waived,
                      note: store.settings.joining_fee_note || VUKA_JOINING.note,
                    }
                  : null
              }
            />
          ) : null}

          <div ref={formAnchorRef}>
            <FormCard
              tone="owner"
              title={
                editingId
                  ? `Edit class type · ${editing?.name || form.name || '…'}`
                  : 'Add class type'
              }
              description={
                editingId
                  ? 'Update the catalogue entry. Existing calendar classes keep this type; name/duration/capacity defaults apply to new bookings.'
                  : undefined
              }
              onSubmit={() => void save()}
              saving={saving}
              submitLabel={editingId ? 'Save changes' : 'Add class type'}
            >
              {editingId ? (
                <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Editing <strong>{editing?.code || editingId}</strong>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold underline"
                    onClick={cancelEdit}
                  >
                    Cancel · new type
                  </button>
                </p>
              ) : null}
              <input
                className={fc()}
                placeholder="Code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
              <input
                className={fc()}
                placeholder="Name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <input
                className={fc()}
                placeholder="Category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
              <input
                className={fc()}
                type="number"
                min={5}
                placeholder="Duration min"
                value={form.default_duration_min}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    default_duration_min: e.target.value,
                  }))
                }
              />
              <input
                className={fc()}
                type="number"
                min={1}
                placeholder="Capacity"
                value={form.capacity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value }))
                }
              />
              <textarea
                className={fc() + ' min-h-[4rem] resize-y sm:col-span-2'}
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm font-medium px-1 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Active (available when scheduling classes)
              </label>
            </FormCard>
          </div>

          <DataTable
            tone="owner"
            headers={[
              'Code',
              'Name',
              'Category',
              'Duration',
              'Capacity',
              'Status',
            ]}
            rows={store.class_types.map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.name,
                c.category || '—',
                c.default_duration_min ?? '—',
                c.capacity ?? '—',
                c.active === false ? 'Inactive' : 'Active',
              ],
            }))}
            onEdit={(id) => startEdit(id)}
            onDelete={(id) => {
              if (editingId === id) cancelEdit();
              void post({ entity: 'class_types', action: 'delete', id });
            }}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
