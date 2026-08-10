'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, Copy, Link2 } from 'lucide-react';
import Link from 'next/link';
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
    specialties: ['General'] as string[],
    public_bio: '',
    bio: '',
    photo_url: '',
  });

  const toggleSpecialty = (s: string) => {
    setForm((f) => {
      const has = f.specialties.includes(s);
      if (has) {
        const next = f.specialties.filter((x) => x !== s);
        return { ...f, specialties: next.length ? next : ['General'] };
      }
      return {
        ...f,
        specialties: [...f.specialties.filter((x) => x !== 'General'), s],
      };
    });
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'coaches',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        public_bio: form.public_bio,
        bio: form.bio || form.public_bio,
        photo_url: form.photo_url || undefined,
        specialties: form.specialties.length
          ? form.specialties
          : ['General'],
        can_manage_classes: true,
      },
    });
    toast.success('Coach saved — they can update bio on their portal');
    setForm({
      code: '',
      name: '',
      email: '',
      phone: '',
      specialties: ['General'],
      public_bio: '',
      bio: '',
      photo_url: '',
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
      description="Register coaches, issue portal links, and open each coach’s calendar for planned classes, member rosters, and actual attendance."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/fitgraph/coach-calendar"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 dark:!border-amber-400 dark:!bg-amber-950 dark:text-amber-200"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Open coach calendar
            </Link>
          </div>
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
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                Specialties (select all that apply)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COACH_SPECIALTIES.map((s) => {
                  const on = form.specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        on
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-amber-200 bg-white text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              className={fc()}
              placeholder="Photo URL (optional)"
              value={form.photo_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, photo_url: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[3.5rem] resize-y sm:col-span-2'}
              placeholder="Public bio (members see this on website)"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
              placeholder="Internal notes / full bio (gym office)"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
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
