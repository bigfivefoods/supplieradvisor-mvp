'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { ClassDeskTable } from '@/components/fitness/ClassDeskTable';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { GymColorSwatch } from '@/components/fitness/GymColorSwatch';
import {
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
  color: '#E8E830',
  active: true,
});

export default function ClassesPage() {
  const search = useSearchParams();
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const rosterPlanId = search.get('roster');
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
      color: c.color || '#E8E830',
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
        color: form.color || null,
        active: form.active,
      },
    });
    toast.success(editingId ? 'Class type updated' : 'Class type saved');
    setEditingId(null);
    setForm(blankForm());
  };

  if (loading || !store) {
    return (
      <FitgraphWorkbench
        title="Classes"
        titleAccent="roster · coach · calendar"
        description="Class · coach · calendar · booked members."
      >
        <LoadingBlock />
      </FitgraphWorkbench>
    );
  }

  if (classSubscribe) {
    return (
      <FitgraphWorkbench
        title="Classes"
        titleAccent="roster · coach · calendar"
        description="The class list. Tap N booked to add or drop members. Open a row to set times, coach, calendar and shop bio."
      >
          <div className="space-y-6">
            <StatRow
              tone="owner"
              items={[
                {
                  label: 'Classes',
                  value:
                    Number(summary?.planCount) || store.membership_plans.length,
                },
                {
                  label: 'Active members',
                  value: Number(summary?.activeSubscriptions) || 0,
                },
                {
                  label: 'Coaches',
                  value: store.coaches.filter((c) => c.active !== false).length,
                },
              ]}
            />
            {store.settings?.public_token ? (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-800 dark:bg-yellow-950/40">
                <p className="font-black dark:text-white">New member onboarding</p>
                <p className="mt-1 text-[12px] text-slate-600 dark:text-yellow-100/80">
                  Send the group or private contract form. Answers save on their
                  profile for you only.
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-bold">
                  <a
                    className="underline"
                    href={`/join/fitgraph/${encodeURIComponent(store.settings.public_token)}?kind=group`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Group class form
                  </a>
                  <a
                    className="underline"
                    href={`/join/fitgraph/${encodeURIComponent(store.settings.public_token)}?kind=private`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Private form
                  </a>
                </div>
              </div>
            ) : null}
            {store.settings?.joining_fee_zar != null ? (
              <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
                Once-off joining R{store.settings.joining_fee_zar}
                {store.settings.joining_fee_waived
                  ? ' — currently waived (free).'
                  : '.'}{' '}
                {store.settings.joining_fee_note || VUKA_JOINING.note}
              </p>
            ) : null}
            <p className="rounded-2xl border border-yellow-100 bg-yellow-50/70 px-4 py-3 text-xs text-slate-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-100">
              Tick members on a class and press <strong>Save booked members</strong>{' '}
              — they stay booked on the calendar. Actual rates live on{' '}
              <a
                href="/dashboard/fitgraph/clients"
                className="font-bold text-yellow-800 underline dark:text-yellow-200"
              >
                Clients
              </a>
              .
            </p>
            <ClassDeskTable
              store={store}
              post={post}
              saving={saving}
              classSubscribe
              companyId={companyId}
              initialRosterId={rosterPlanId}
            />
          </div>
      </FitgraphWorkbench>
    );
  }

  return (
    <FitgraphWorkbench
      title="Class types"
      titleAccent="catalogue"
      description="Step 1 of the floor flow: define class types first (HIIT, strength, yoga…). Edit any type below, then Calendar → create a class → assign coach → add members."
    >
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Class types',
                value:
                  Number(summary?.classTypeCount) || store.class_types.length,
              },
              {
                label: 'Active types',
                value: store.class_types.filter((c) => c.active !== false)
                  .length,
              },
            ]}
          />

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
              <GymColorSwatch
                value={form.color}
                onChange={(hex) => setForm((f) => ({ ...f, color: hex }))}
                label="Calendar colour"
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
              'Colour',
              'Category',
              'Duration',
              'Capacity',
              'Status',
            ]}
            rows={store.class_types
              .filter((c) => c.active !== false)
              .map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.name,
                c.color || '—',
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
    </FitgraphWorkbench>
  );
}
