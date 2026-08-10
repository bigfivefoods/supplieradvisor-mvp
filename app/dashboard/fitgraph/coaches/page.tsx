'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Link2 } from 'lucide-react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  ListRowCard,
  StatRow,
  fc,
  toneLinkClass,
} from '@/components/fitness/FitForm';
import { COACH_SPECIALTIES } from '@/lib/fitness/fitgraph';

export default function CoachesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    specialty: 'General',
    public_bio: '',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        ...form,
        specialties: form.specialty ? [form.specialty] : [],
        can_manage_classes: true,
      },
    });
    toast.success('Coach saved');
    setForm({
      code: '',
      name: '',
      email: '',
      phone: '',
      specialty: 'General',
      public_bio: '',
    });
  };

  const issuePortal = async (coachId: string) => {
    const data = await post({
      action: 'issue_coach_portal',
      coachId,
    });
    const tok = data?.portal_token as string | undefined;
    if (tok && typeof window !== 'undefined') {
      const url = `${window.location.origin}/coach/fitgraph/${encodeURIComponent(tok)}`;
      await navigator.clipboard.writeText(url);
      toast.success('Coach portal link copied');
    } else {
      toast.success('Portal token issued');
    }
  };

  const copyPortal = async (tok: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/coach/fitgraph/${encodeURIComponent(tok)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Copied portal link');
  };

  return (
    <FitgraphWorkbench
      title="Coaches"
      titleAccent="trainers"
      description="Register coaches, assign them on the calendar, and issue portal links so they can share classes with customers and manage rosters."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="coach"
            items={[
              {
                label: 'Coaches',
                value: Number(summary?.coachCount) || store.coaches.length,
              },
              {
                label: 'With portal',
                value: store.coaches.filter((c) => c.portal_token).length,
              },
            ]}
          />
          <FormCard
            tone="coach"
            title="Add coach"
            onSubmit={() => void add()}
            saving={saving}
          >
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
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <select
              className={fc()}
              value={form.specialty}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialty: e.target.value }))
              }
            >
              {COACH_SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className={fc()}
              placeholder="Public bio (website)"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
          </FormCard>

          <div className="space-y-2">
            {store.coaches.map((c) => (
              <ListRowCard
                key={c.id}
                tone="coach"
                actions={
                  <>
                    {c.portal_token ? (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 text-xs font-bold ${toneLinkClass('coach')}`}
                        onClick={() => void copyPortal(c.portal_token!)}
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy portal link
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:bg-slate-50 dark:text-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-900/40"
                      onClick={() => void issuePortal(c.id)}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {c.portal_token ? 'Re-issue portal' : 'Issue portal'}
                    </button>
                    <button
                      type="button"
                      className="text-rose-600 dark:text-rose-400 text-xs font-bold"
                      onClick={() =>
                        void post({
                          entity: 'coaches',
                          action: 'delete',
                          id: c.id,
                        })
                      }
                    >
                      Remove
                    </button>
                  </>
                }
              >
                <div className="font-bold text-sm text-slate-900 dark:text-amber-50">
                  {c.code} · {c.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-amber-200/80">
                  {(c.specialties || []).join(', ') || '—'}
                  {c.email ? ` · ${c.email}` : ''}
                </div>
                {c.public_bio && (
                  <p className="text-[11px] text-slate-600 dark:text-amber-100/80 mt-1">
                    {c.public_bio}
                  </p>
                )}
                {c.portal_token && (
                  <p
                    className={`text-[10px] mt-1 font-mono truncate max-w-md ${toneLinkClass('coach')}`}
                  >
                    Portal active
                  </p>
                )}
              </ListRowCard>
            ))}
          </div>

          <DataTable
            tone="coach"
            headers={['Code', 'Name', 'Specialties', 'Email', 'Portal']}
            rows={store.coaches.map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.name,
                (c.specialties || []).join(', ') || '—',
                c.email || '—',
                c.portal_token ? 'Yes' : 'No',
              ],
            }))}
            onDelete={(id) =>
              void post({ entity: 'coaches', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
