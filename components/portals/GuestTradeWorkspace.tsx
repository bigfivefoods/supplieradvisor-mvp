'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CUSTOMER_DIMS,
  SUPPLIER_DIMS,
} from '@/lib/ratings/company-rating';
import { StarRating } from '@/components/ratings/StarRating';
import { formatMoney } from '@/lib/customers/types';
import { OtifefKpiCard } from '@/components/portals/OtifefKpiCard';
import type {
  PortalPersonPublic,
  PortalProjectTask,
  PortalRiadView,
  PublicPortalPayload,
} from '@/lib/portals/trade-portal';
import { portalPersonKey } from '@/lib/portals/trade-portal-people';
import {
  RIAD_PRIORITIES,
  RIAD_TYPES,
  type RiadType,
} from '@/lib/containers/riad';
import type {
  BookProfile,
  PortalCatalogueItem,
} from '@/lib/portals/trade-portal-workspace';
import {
  addDays,
  clampDayRange,
  dateEnvelope,
  daysBetween,
  isoDay,
} from '@/lib/projects/waterfall';
import {
  buildWbsTree,
  flattenWbs,
  rollupWbsDates,
  type WbsNode,
} from '@/lib/projects/wbs';
import { WaterfallGantt } from '@/components/projects/WaterfallGantt';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PortalRiadPanel } from '@/components/portals/PortalRiadPanel';

export type GuestPortalTab =
  | 'profile'
  | 'orders'
  | 'otifef'
  | 'statement'
  | 'stock'
  | 'riad'
  | 'messages'
  | 'reviews'
  | 'newpo'
  | 'projects'
  | 'people';

export function guestPortalTabs(opts: {
  kind: 'customer' | 'supplier';
  profileGaps?: number;
  isHost?: boolean;
}): Array<{ id: GuestPortalTab; label: string }> {
  const gaps = opts.profileGaps || 0;
  const profile = opts.isHost
    ? 'Their profile'
    : gaps
      ? `Profile (${gaps})`
      : 'Profile';
  const supplier = [
    { id: 'profile' as const, label: profile },
    { id: 'orders' as const, label: 'Purchase orders' },
    { id: 'otifef' as const, label: 'OTIFEF metrics' },
    { id: 'projects' as const, label: 'Projects' },
    { id: 'stock' as const, label: 'Stock' },
    { id: 'riad' as const, label: 'RIAD' },
    { id: 'messages' as const, label: 'Messages' },
    { id: 'people' as const, label: 'People' },
    { id: 'reviews' as const, label: 'Ratings' },
  ];
  const customer = [
    { id: 'profile' as const, label: profile },
    { id: 'orders' as const, label: 'Sales orders' },
    { id: 'otifef' as const, label: 'OTIFEF metrics' },
    { id: 'statement' as const, label: 'Statement' },
    { id: 'projects' as const, label: 'Projects' },
    { id: 'newpo' as const, label: 'Raise a PO' },
    { id: 'people' as const, label: 'People' },
    { id: 'riad' as const, label: 'RIAD' },
    { id: 'messages' as const, label: 'Messages' },
    { id: 'reviews' as const, label: 'Ratings' },
  ];
  const tabs = opts.kind === 'supplier' ? supplier : customer;
  if (opts.isHost) {
    return tabs.filter((t) => t.id !== 'newpo');
  }
  return tabs;
}

const EMPTY_PROFILE: BookProfile = {
  logo_url: '',
  trading_name: '',
  legal_name: '',
  contact_name: '',
  job_title: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  registration_number: '',
  address: '',
  city: '',
  country: '',
  payment_terms: '',
  industry: '',
};

function pct(n: number | null | undefined) {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

function taskAssigneeKey(t: PortalProjectTask): string {
  if (t.assignee_member_id) return `host:${t.assignee_member_id}`;
  if (t.assignee_viewer_id) return `guest:${t.assignee_viewer_id}`;
  return '';
}

function PersonPicker({
  people,
  hostName,
  accountLabel,
  value,
  disabled,
  emptyLabel = 'Unassigned',
  onChange,
}: {
  people: PortalPersonPublic[];
  hostName?: string;
  accountLabel?: string | null;
  value: string;
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (key: string, person: PortalPersonPublic | null) => void;
}) {
  const host = people.filter((p) => p.side === 'host');
  const guests = people.filter((p) => p.side !== 'host');
  return (
    <select
      className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
      value={value}
      disabled={disabled || people.length === 0}
      onChange={(e) => {
        const key = e.target.value;
        onChange(key, people.find((p) => portalPersonKey(p) === key) || null);
      }}
    >
      <option value="">{emptyLabel}</option>
      {host.length ? (
        <optgroup label={hostName || 'Host team'}>
          {host.map((p) => (
            <option key={portalPersonKey(p)} value={portalPersonKey(p)}>
              {p.name}
              {p.you ? ' (you)' : ''}
              {p.job_title ? ` · ${p.job_title}` : ''}
            </option>
          ))}
        </optgroup>
      ) : null}
      {guests.length ? (
        <optgroup label={accountLabel || 'Portal people'}>
          {guests.map((p) => (
            <option key={portalPersonKey(p)} value={portalPersonKey(p)}>
              {p.name}
              {p.you ? ' (you)' : ''}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}

const HEAVY_ACTIONS = new Set([
  'project_create',
  'po_create',
  'profile',
  'rate',
]);
const REFRESH_ACTIONS = new Set([
  'project_create',
  'po_create',
  'profile',
  'rate',
  'po_update',
]);

function applyActLocally(
  prev: PublicPortalPayload,
  payload: Record<string, unknown>,
  data: Record<string, unknown>
): PublicPortalPayload {
  const action = String(payload.action || '');
  const ws0 = prev.workspace;
  if (action === 'message' && ws0) {
    const raw = (
      data.message && typeof data.message === 'object' ? data.message : null
    ) as { id?: number; author?: string; body?: string; created_at?: string } | null;
    const id = Number(raw?.id);
    if (Number.isFinite(id) && id > 0) {
      return {
        ...prev,
        workspace: {
          ...ws0,
          messages: [
            ...ws0.messages,
            {
              id,
              author: raw?.author === 'host' ? 'host' : 'guest',
              body: String(raw?.body || payload.body || ''),
              created_at: String(raw?.created_at || new Date().toISOString()),
            },
          ],
        },
      };
    }
  }
  const ws = prev.workspace;
  if (action === 'task_add' && ws) {
    const projectId = Number(payload.project_id);
    const raw = (data.task && typeof data.task === 'object'
      ? data.task
      : null) as Partial<PortalProjectTask> | null;
    const task: PortalProjectTask = {
      id: Number(raw?.id || data.id),
      title: String(raw?.title || payload.title || 'Task'),
      column_key: String(raw?.column_key || 'todo'),
      start_date: raw?.start_date
        ? String(raw.start_date).slice(0, 10)
        : payload.start_date
          ? String(payload.start_date).slice(0, 10)
          : null,
      due_date: raw?.due_date
        ? String(raw.due_date).slice(0, 10)
        : payload.due_date
          ? String(payload.due_date).slice(0, 10)
          : null,
      parent_task_id:
        raw?.parent_task_id != null
          ? Number(raw.parent_task_id)
          : payload.parent_task_id
            ? Number(payload.parent_task_id)
            : null,
      phase_key: raw?.phase_key != null ? String(raw.phase_key) : null,
      assignee: null,
      assignee_viewer_id: null,
      description: null,
    };
    if (!Number.isFinite(task.id) || task.id <= 0) return prev;
    return {
      ...prev,
      workspace: {
        ...ws,
        projects: (ws.projects || []).map((p) =>
          p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
        ),
      },
    };
  }
  if (action === 'task_update' && ws) {
    const id = Number(payload.id);
    return {
      ...prev,
      workspace: {
        ...ws,
        projects: (ws.projects || []).map((p) => ({
          ...p,
          tasks: p.tasks.map((t) => {
            if (t.id !== id) return t;
            return {
              ...t,
              title:
                typeof payload.title === 'string' && payload.title.trim()
                  ? payload.title.trim()
                  : t.title,
              column_key:
                typeof payload.column_key === 'string' && payload.column_key
                  ? String(payload.column_key)
                  : t.column_key,
              start_date:
                payload.start_date != null
                  ? String(payload.start_date).slice(0, 10)
                  : t.start_date,
              due_date:
                payload.due_date != null
                  ? String(payload.due_date).slice(0, 10)
                  : t.due_date,
              assignee:
                payload.assignee !== undefined
                  ? payload.assignee
                    ? String(payload.assignee)
                    : null
                  : t.assignee,
              assignee_viewer_id:
                payload.assignee_viewer_id !== undefined
                  ? Number(payload.assignee_viewer_id) || null
                  : t.assignee_viewer_id,
              assignee_member_id:
                payload.assignee_member_id !== undefined
                  ? Number(payload.assignee_member_id) || null
                  : t.assignee_member_id,
            };
          }),
        })),
      },
    };
  }
  if (action === 'project_update' && ws) {
    const id = Number(payload.id);
    return {
      ...prev,
      workspace: {
        ...ws,
        projects: (ws.projects || []).map((p) =>
          p.id === id
            ? {
                ...p,
                name:
                  typeof payload.name === 'string' && payload.name.trim()
                    ? payload.name.trim()
                    : p.name,
                description:
                  payload.description !== undefined
                    ? String(payload.description || '') || null
                    : p.description,
              }
            : p
        ),
      },
    };
  }
  if (action === 'riad_add' && ws) {
    const raw = (data.entry && typeof data.entry === 'object'
      ? data.entry
      : null) as Partial<PortalRiadView> | null;
    const id = Number(raw?.id || data.id);
    if (!Number.isFinite(id) || id <= 0) return prev;
    const entry: PortalRiadView = {
      id,
      entry_type: String(raw?.entry_type || payload.entry_type || 'issue'),
      title: String(raw?.title || payload.title || ''),
      description:
        raw?.description != null
          ? String(raw.description)
          : payload.description
            ? String(payload.description)
            : null,
      status: String(raw?.status || payload.status || 'open'),
      severity: String(raw?.severity || payload.severity || 'medium'),
      notes: raw?.notes != null ? String(raw.notes) : null,
      created_at: raw?.created_at != null ? String(raw.created_at) : new Date().toISOString(),
      owner_name: raw?.owner_name != null ? String(raw.owner_name) : null,
      due_date: raw?.due_date != null ? String(raw.due_date).slice(0, 10) : null,
      category: raw?.category != null ? String(raw.category) : null,
      related_task_id:
        raw?.related_task_id != null
          ? Number(raw.related_task_id)
          : payload.related_task_id
            ? Number(payload.related_task_id)
            : null,
      related_project_id:
        raw?.related_project_id != null ? Number(raw.related_project_id) : null,
    };
    return {
      ...prev,
      workspace: { ...ws, riad: [entry, ...(ws.riad || [])] },
    };
  }
  if (action === 'riad_delete' && ws) {
    const id = Number(payload.id);
    return {
      ...prev,
      workspace: {
        ...ws,
        riad: (ws.riad || []).filter((r) => r.id !== id),
      },
    };
  }
  if (action === 'riad_update' && ws) {
    const id = Number(payload.id);
    return {
      ...prev,
      workspace: {
        ...ws,
        riad: (ws.riad || []).map((r) =>
          r.id === id
            ? {
                ...r,
                status:
                  typeof payload.status === 'string' ? payload.status : r.status,
                severity:
                  typeof payload.severity === 'string'
                    ? payload.severity
                    : r.severity,
                resolution:
                  payload.resolution !== undefined
                    ? String(payload.resolution || '') || null
                    : r.resolution,
              }
            : r
        ),
      },
    };
  }
  return prev;
}

export function GuestTradeWorkspace({
  token,
  portal,
  onRefresh,
  tab,
  onTab,
}: {
  token: string;
  portal: PublicPortalPayload;
  onRefresh: () => void;
  tab: GuestPortalTab;
  onTab: (id: GuestPortalTab) => void;
}) {
  const [live, setLive] = useState(portal);
  useEffect(() => {
    setLive(portal);
  }, [portal]);
  const { authenticated, getAccessToken, user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const ws = live.workspace;
  const isSupplier = live.kind === 'supplier';
  const isHost = live.actor?.role === 'host';
  const gaps = ws?.profileGaps || [];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      if (authenticated && typeof getAccessToken === 'function') {
        const access = await getAccessToken();
        if (access) headers.Authorization = `Bearer ${access}`;
      }
    } catch {
      /* cookie fallback */
    }
    return headers;
  }, [authenticated, getAccessToken]);

  const act = async (payload: Record<string, unknown>) => {
    const action = String(payload.action || '');
    const heavy = HEAVY_ACTIONS.has(action);
    if (heavy) setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/public/portals/trade/act', {
        method: 'POST',
        headers: await authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          token,
          ...payload,
          ...(privyUserId ? { privyUserId } : {}),
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error || 'Failed'));
      setLive((prev) => applyActLocally(prev, payload, data));
      setNote(
        action === 'project_create'
          ? 'Project created — waterfall tasks span the full duration'
          : action === 'po_create'
            ? 'Purchase order sent'
            : action === 'task_add'
              ? 'Task added'
              : action === 'riad_add'
                ? 'RIAD logged'
                : action === 'riad_delete'
                  ? 'RIAD deleted'
                  : action === 'project_update'
                    ? 'Project heading saved'
                    : action === 'task_update'
                      ? 'Task saved'
                      : 'Saved'
      );
      if (REFRESH_ACTIONS.has(action)) onRefresh();
      return data;
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Failed');
      return null;
    } finally {
      if (heavy) setBusy(false);
    }
  };

  useEffect(() => {
    if (isHost && tab === 'newpo') onTab('orders');
  }, [isHost, tab, onTab]);

  const ot = ws?.otifef;
  const orders = isSupplier
    ? ws?.purchase_orders || live.purchase_orders
    : [...(ws?.inbound_pos || []), ...(live.orders || [])];

  return (
    <div className="space-y-4">
      {note ? (
        <p className="text-xs font-semibold text-[#0077b6]">{note}</p>
      ) : null}

      {isHost ? (
        <p className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Signed in as <strong>{live.actor?.name || 'you'}</strong> at{' '}
          <strong>{live.host.name}</strong>. Actions use your company
          credentials
          {live.accountLabel ? (
            <>
              , not <strong>{live.accountLabel}</strong>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {gaps.length > 0 && tab !== 'profile' && !isHost ? (
        <button
          type="button"
          onClick={() => onTab('profile')}
          className="w-full text-left rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Complete your profile so {live.host.name} has the right details on
          their books ({gaps.join(', ')}).
        </button>
      ) : null}

      {tab === 'profile' ? (
        <ProfilePanel
          profile={ws?.bookProfile || null}
          gaps={gaps}
          busy={busy}
          readOnly={isHost}
          accountLabel={live.accountLabel}
          hostName={live.host.name}
          onAct={act}
        />
      ) : null}

      {tab === 'orders' ? (
        <OrdersPanel
          isSupplier={isSupplier}
          orders={orders}
          busy={busy}
          onAct={act}
        />
      ) : null}
      {tab === 'otifef' ? (
        <div className="space-y-4">
          <OtifefKpiCard
            metrics={ot}
            kind={isSupplier ? 'supplier' : 'customer'}
          />
          <OtifefPanel orders={orders} />
        </div>
      ) : null}
      {tab === 'statement' && !isSupplier ? (
        <StatementPanel
          invoices={live.invoices || []}
          quotes={live.quotes || []}
          hostName={live.host.name}
        />
      ) : null}
      {tab === 'projects' ? (
        <ProjectsPanel
          items={ws?.projects || []}
          people={live.people || []}
          riad={ws?.riad || []}
          ownerName={live.actor?.name || live.viewer?.name || ''}
          hostName={live.host.name}
          accountLabel={live.accountLabel}
          busy={busy}
          onAct={act}
        />
      ) : null}
      {tab === 'stock' && isSupplier ? (
        <StockPanel lines={ws?.stock || []} busy={busy} onAct={act} />
      ) : null}
      {tab === 'newpo' && !isSupplier && !isHost ? (
        <NewPoPanel
          token={token}
          busy={busy}
          onAct={act}
          catalogue={ws?.catalogue || []}
          hostName={live.host.name}
        />
      ) : null}
      {tab === 'riad' ? (
        <PortalRiadPanel
          kind={live.kind}
          items={ws?.riad || []}
          busy={busy}
          ownerName={live.actor?.name || live.viewer?.name || ''}
          people={live.people || []}
          hostName={live.host.name}
          accountLabel={live.accountLabel}
          onAct={act}
        />
      ) : null}
      {tab === 'messages' ? (
        <MessagesPanel
          items={ws?.messages || []}
          busy={busy}
          isHost={isHost}
          accountLabel={live.accountLabel}
          onAct={act}
        />
      ) : null}
      {tab === 'people' ? (
        <PeoplePanel
          people={live.people || []}
          busy={busy}
          isHost={isHost}
          hostName={live.host.name}
          accountLabel={live.accountLabel}
          onAct={act}
          onPeople={(next) =>
            setLive((prev) => ({
              ...prev,
              people: next,
              kpis: { ...prev.kpis, people: next.length },
            }))
          }
          onNote={setNote}
        />
      ) : null}
      {tab === 'reviews' ? (
        <ReviewsPanel
          kind={live.kind}
          items={ws?.ratings || []}
          busy={busy}
          readOnly={isHost}
          onAct={act}
        />
      ) : null}
    </div>
  );
}

function PeoplePanel({
  people,
  busy,
  isHost,
  hostName,
  accountLabel,
  onAct,
  onPeople,
  onNote,
}: {
  people: PortalPersonPublic[];
  busy: boolean;
  isHost: boolean;
  hostName?: string;
  accountLabel?: string | null;
  onAct: (p: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onPeople: (next: PortalPersonPublic[]) => void;
  onNote: (v: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [job, setJob] = useState('');
  const [saving, setSaving] = useState(false);

  const invite = async () => {
    setSaving(true);
    onNote(null);
    try {
      const data = await onAct({
        action: 'invite_person',
        name,
        email,
        phone,
        job_title: job,
      });
      if (!data) return;
      if (data.url) {
        try {
          await navigator.clipboard.writeText(String(data.url));
        } catch {
          /* ignore */
        }
      }
      onNote(
        data.existing
          ? 'They already have access — link copied'
          : data.emailSent
            ? 'Invite sent and link copied'
            : 'Person added — link copied'
      );
      setName('');
      setEmail('');
      setPhone('');
      setJob('');
      const person = data.person as
        | { id: number; name: string; email?: string | null; job_title?: string | null }
        | undefined;
      if (person?.id && !people.some((p) => p.id === person.id)) {
        onPeople([
          ...people,
          {
            id: Number(person.id),
            name: String(person.name || name),
            email: person.email != null ? String(person.email) : email || null,
            job_title:
              person.job_title != null ? String(person.job_title) : job || null,
            last_seen_at: null,
            you: false,
            side: 'guest',
          },
        ]);
      }
    } catch (e) {
      onNote(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: number) => {
    setSaving(true);
    onNote(null);
    try {
      const data = await onAct({ action: 'revoke_person', id });
      if (!data) return;
      onNote('Access removed');
      onPeople(people.filter((p) => p.id !== id));
    } catch (e) {
      onNote(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const blocked = busy || saving;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          People with access
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Host team and guest people can be assigned on projects and RIAD.
          Anyone you add sees the same live books for this account.
        </p>
        {(() => {
          const hostPeople = people.filter((p) => p.side === 'host');
          const guestPeople = people.filter((p) => p.side !== 'host');
          const row = (p: PortalPersonPublic) => (
            <li
              key={portalPersonKey(p)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {p.name}
                  {p.you ? (
                    <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-[#0077b6]">
                      You
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {[p.job_title, p.email].filter(Boolean).join(' · ') ||
                    'No contact yet'}
                </p>
              </div>
              {p.side === 'host' || p.you ? (
                p.side === 'host' ? (
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {hostName || 'Host'}
                  </span>
                ) : null
              ) : (
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => void revoke(p.id)}
                  className="text-xs font-bold text-rose-700"
                >
                  Remove
                </button>
              )}
            </li>
          );
          return (
            <div className="mt-4 space-y-4">
              {hostPeople.length ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">
                    {hostName || 'Host team'}
                  </p>
                  <ul className="space-y-2">{hostPeople.map(row)}</ul>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">
                  {accountLabel || 'Portal people'}
                </p>
                <ul className="space-y-2">
                  {guestPeople.length === 0 ? (
                    <li className="text-sm text-neutral-500">
                      {isHost
                        ? 'No guest people on this account yet.'
                        : 'Only you so far.'}
                    </li>
                  ) : (
                    guestPeople.map(row)
                  )}
                </ul>
              </div>
            </div>
          );
        })()}
      </section>
      <section className="rounded-[1.5rem] border border-white/70 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm font-black text-slate-900">Give someone access</p>
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="Role"
            value={job}
            onChange={(e) => setJob(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={blocked || !name.trim()}
          onClick={() => void invite()}
          className="min-h-11 w-full rounded-xl bg-[#0077b6] text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add person & copy link'}
        </button>
      </section>
    </div>
  );
}

function ProfilePanel({
  profile,
  gaps,
  busy,
  readOnly,
  accountLabel,
  hostName,
  onAct,
}: {
  profile: BookProfile | null;
  gaps: string[];
  busy: boolean;
  readOnly?: boolean;
  accountLabel?: string | null;
  hostName?: string;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<BookProfile>(profile || EMPTY_PROFILE);
  useEffect(() => {
    setForm(profile || EMPTY_PROFILE);
  }, [profile]);

  const set = (key: keyof BookProfile, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fields: Array<{ key: keyof BookProfile; label: string; required?: boolean; span?: boolean }> =
    [
      { key: 'trading_name', label: 'Trading name', required: true },
      { key: 'legal_name', label: 'Legal name' },
      { key: 'contact_name', label: 'Contact name', required: true },
      { key: 'job_title', label: 'Job title' },
      { key: 'email', label: 'Email', required: true },
      { key: 'phone', label: 'Phone', required: true },
      { key: 'website', label: 'Website', span: true },
      { key: 'vat_number', label: 'VAT number' },
      { key: 'registration_number', label: 'Registration number' },
      { key: 'address', label: 'Street address', span: true },
      { key: 'city', label: 'City', required: true },
      { key: 'country', label: 'Country', required: true },
      { key: 'payment_terms', label: 'Payment terms' },
      { key: 'industry', label: 'Industry' },
    ];

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          On our books
        </p>
        {profile?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.logo_url}
            alt=""
            className="mb-3 h-16 w-16 rounded-2xl border border-slate-200 bg-white object-contain"
          />
        ) : null}
        <h2 className="text-lg font-black text-slate-900">
          {readOnly
            ? `${accountLabel || 'Their'} credentials`
            : 'Complete your profile'}
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          {readOnly
            ? `These are ${accountLabel || 'the account'}’s details on ${hostName || 'your'} books — not yours. Edit them in CRM / SRM.`
            : 'These fields write straight into our customer / supplier record. Keep them accurate so quotes, POs, and invoices match your legal entity.'}
        </p>
      </div>
      {gaps.length ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
          Still needed: {gaps.join(', ')}
        </p>
      ) : (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          Profile is complete on our books.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <label
            key={f.key}
            className={`text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${
              f.span ? 'sm:col-span-2' : ''
            }`}
          >
            {f.label}
            {f.required ? <span className="text-rose-500"> *</span> : null}
            {f.key === 'address' ? (
              <textarea
                className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[64px] font-medium normal-case tracking-normal"
                value={form[f.key]}
                disabled={readOnly}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                type={f.key === 'email' ? 'email' : 'text'}
                value={form[f.key]}
                disabled={readOnly}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      {readOnly ? null : (
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAct({ action: 'profile', ...form })}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Save to our books
      </button>
      )}
    </div>
  );
}

function TaskRiadForm({
  taskId,
  taskTitle,
  ownerName,
  people,
  hostName,
  accountLabel,
  busy,
  onAct,
}: {
  taskId: number;
  taskTitle: string;
  ownerName: string;
  people: PortalPersonPublic[];
  hostName?: string;
  accountLabel?: string | null;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [entryType, setEntryType] = useState<RiadType>('issue');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState('medium');
  const defaultOwner = people.find((p) => p.name === ownerName);
  const [ownerKey, setOwnerKey] = useState(
    defaultOwner ? portalPersonKey(defaultOwner) : ''
  );
  return (
    <div className="rounded-2xl border border-cyan-100 bg-white p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
        RIAD for {taskTitle}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="input !py-1.5 !px-2 !text-xs"
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as RiadType)}
        >
          {RIAD_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="input !py-1.5 !px-2 !text-xs"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {RIAD_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <input
        className="input w-full !py-1.5 !px-2 !text-sm"
        placeholder="Title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input w-full !py-1.5 !px-2 !text-sm min-h-[56px]"
        placeholder="What happened on this task"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <label className="text-[10px] font-bold uppercase text-neutral-400 block">
        Owner
        <PersonPicker
          people={people}
          hostName={hostName}
          accountLabel={accountLabel}
          value={ownerKey}
          disabled={busy}
          emptyLabel={ownerName || 'Owner'}
          onChange={(key) => setOwnerKey(key)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !title.trim()}
        onClick={() => {
          const t = title.trim();
          setTitle('');
          setDesc('');
          void onAct({
            action: 'riad_add',
            entry_type: entryType,
            title: t,
            description: desc || undefined,
            severity,
            owner_name:
              people.find((p) => portalPersonKey(p) === ownerKey)?.name ||
              ownerName ||
              undefined,
            related_task_id: taskId,
          });
        }}
        className="btn-primary w-full !py-2 text-xs"
      >
        Log on this task
      </button>
    </div>
  );
}

function datedTasks(
  tasks: NonNullable<PublicPortalPayload['workspace']>['projects'][number]['tasks'],
  projectStart: string
) {
  let cursor = projectStart;
  return tasks.map((t, i) => {
    const rawStart = t.start_date || (i === 0 ? projectStart : cursor);
    const rawEnd = t.due_date || addDays(rawStart, 6);
    const range = clampDayRange(rawStart.slice(0, 10), rawEnd.slice(0, 10));
    cursor = range.end;
    return { ...t, start_date: range.start, due_date: range.end };
  });
}

function ProjectsPanel({
  items,
  people,
  riad,
  ownerName,
  hostName,
  accountLabel,
  busy,
  onAct,
}: {
  items: NonNullable<PublicPortalPayload['workspace']>['projects'];
  people: PortalPersonPublic[];
  riad: PortalRiadView[];
  ownerName: string;
  hostName?: string;
  accountLabel?: string | null;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [title, setTitle] = useState('');
  const [taskStart, setTaskStart] = useState(isoDay(new Date()));
  const [taskEnd, setTaskEnd] = useState(addDays(isoDay(new Date()), 7));
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState(isoDay(new Date()));
  const [newEnd, setNewEnd] = useState(addDays(isoDay(new Date()), 28));
  const [projectId, setProjectId] = useState<number | null>(items[0]?.id || null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [heading, setHeading] = useState('');
  const [brief, setBrief] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(
    () => new Set()
  );
  const [collapsedTasks, setCollapsedTasks] = useState<Set<number>>(
    () => new Set()
  );
  const [subParent, setSubParent] = useState<number | null>(null);
  const [subTitle, setSubTitle] = useState('');
  const [subStart, setSubStart] = useState(isoDay(new Date()));
  const [subEnd, setSubEnd] = useState(addDays(isoDay(new Date()), 7));
  useEffect(() => {
    if (!projectId && items[0]?.id) setProjectId(items[0].id);
  }, [items, projectId]);
  const selected = items.find((p) => p.id === projectId) || items[0] || null;
  useEffect(() => {
    setHeading(selected?.name || '');
    setBrief(selected?.description || '');
  }, [selected?.id, selected?.name, selected?.description]);

  const planned = useMemo(() => {
    return items.map((p) => {
      const fallbackStart = p.start_date || isoDay(new Date());
      const fallbackEnd = p.target_date || addDays(fallbackStart, 28);
      const dated = datedTasks(p.tasks, fallbackStart);
      const tree = rollupWbsDates(
        buildWbsTree(
          dated.map((t) => ({
            ...t,
            parent_task_id: t.parent_task_id || null,
          }))
        )
      );
      const tasks = flattenWbs(tree);
      const env =
        dateEnvelope(
          tasks.map((t) => ({ start: t.start_date, end: t.due_date }))
        ) || {
          start: fallbackStart,
          end: fallbackEnd,
        };
      return { ...p, tree, tasks, envelope: env };
    });
  }, [items]);

  const selectedPlanned =
    planned.find((p) => p.id === selected?.id) || planned[0] || null;

  useEffect(() => {
    if (!selectedPlanned) return;
    const last = selectedPlanned.tasks[selectedPlanned.tasks.length - 1];
    const start = last?.due_date || selectedPlanned.envelope.start;
    setTaskStart(start);
    setTaskEnd(addDays(start, 7));
  }, [selectedPlanned?.id, selectedPlanned?.tasks.length]);

  useEffect(() => {
    if (!openTaskId) return;
    const el = document.getElementById(`portal-task-${openTaskId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openTaskId]);

  const chartEnv =
    dateEnvelope(
      planned.flatMap((p) => [
        { start: p.envelope.start, end: p.envelope.end },
        ...p.tasks.map((t) => ({ start: t.start_date, end: t.due_date })),
      ])
    ) || {
      start: isoDay(new Date()),
      end: addDays(isoDay(new Date()), 56),
    };
  const from = chartEnv.start;
  const to = chartEnv.end;
  const groups = planned.map((p) => {
    const span = daysBetween(p.envelope.start, p.envelope.end) + 1;
    const projectOpen = !collapsedProjects.has(p.id);
    const visible = projectOpen
      ? flattenWbs(p.tree, collapsedTasks)
      : [];
    const taskBars = visible.map((t) => ({
      id: String(t.id),
      label: t.title,
      start: String(t.start_date),
      end: String(t.due_date),
      depth: t.depth + 1,
      expandable: t.children.length > 0,
      expanded: t.children.length > 0 && !collapsedTasks.has(t.id),
      subtitle: t.assignee || undefined,
      tone:
        t.children.length
          ? ('slate' as const)
          : t.column_key === 'done'
            ? ('emerald' as const)
            : t.column_key === 'in_progress'
              ? ('cyan' as const)
              : t.assignee
                ? ('amber' as const)
                : ('violet' as const),
    }));
    return {
      id: String(p.id),
      title: p.name,
      subtitle: `${p.status} · ${p.envelope.start} → ${p.envelope.end} · ${span} day${
        span === 1 ? '' : 's'
      } · ${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'}`,
      bars: [
        {
          id: `summary-${p.id}`,
          label: p.name,
          start: p.envelope.start,
          end: p.envelope.end,
          depth: 0,
          expandable: true,
          expanded: projectOpen,
          tone: 'slate' as const,
          subtitle: 'Project',
        },
        ...taskBars,
      ],
    };
  });

  const createForm = (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 space-y-3 dark:border-white/10 dark:bg-neutral-900">
      <p className="text-sm font-black text-slate-900 dark:text-white">
        New project
      </p>
      <p className="text-xs text-slate-500">
        Opens a joint waterfall on both our books. Initiate → Close tasks are
        dated so they add up to the project duration. Add more tasks with their
        own start and end dates.
      </p>
      <input
        className="input w-full !p-3 !text-sm"
        placeholder="Project name *"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
      />
      <textarea
        className="input w-full !p-3 !text-sm min-h-[64px]"
        placeholder="What we are delivering together"
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-slate-500">
          Start
          <input
            type="date"
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
        </label>
        <label className="text-[11px] font-bold text-slate-500">
          Target
          <input
            type="date"
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !newName.trim()}
        onClick={() => {
          const n = newName.trim();
          void onAct({
            action: 'project_create',
            name: n,
            description: newDesc,
            start_date: newStart,
            target_date: newEnd,
          });
          setNewName('');
          setNewDesc('');
        }}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Create project
      </button>
    </div>
  );

  if (!items.length) {
    return (
      <div className="space-y-4">
        {createForm}
        <p className="text-sm text-slate-500">
          No projects yet. Create the first one above — it shows on this portal
          and on our Projects desk.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {createForm}
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-slate-700">
        <p className="font-bold text-slate-900">Work this plan together</p>
        <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
          Expand or collapse the project and any task with sub-tasks. Click a
          bar to assign people and log RIAD. Add sub-tasks under any task.
        </p>
      </div>
      <WaterfallGantt
        groups={groups}
        from={from}
        to={to}
        onToggle={(gid, barId) => {
          const pid = Number(gid);
          if (!barId || barId.startsWith('summary-') || barId.startsWith('p-')) {
            setCollapsedProjects((prev) => {
              const next = new Set(prev);
              if (next.has(pid)) next.delete(pid);
              else next.add(pid);
              return next;
            });
            return;
          }
          const tid = Number(barId);
          if (!Number.isFinite(tid)) return;
          setCollapsedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(tid)) next.delete(tid);
            else next.add(tid);
            return next;
          });
        }}
        onSelect={(gid, barId) => {
          setProjectId(Number(gid));
          if (!barId || barId.startsWith('summary-') || barId.startsWith('p-')) {
            setOpenTaskId(null);
            return;
          }
          const tid = Number(barId);
          setOpenTaskId(Number.isFinite(tid) && tid > 0 ? tid : null);
        }}
      />
      {selected ? (
        <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 space-y-3">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
              {selected.status}
            </p>
            <label className="text-[10px] font-bold uppercase text-neutral-400 block">
              Project heading
              <input
                className="input mt-0.5 w-full !p-2.5 !text-base font-black text-slate-900"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                onBlur={() => {
                  const next = heading.trim();
                  if (next && next !== selected.name) {
                    void onAct({
                      action: 'project_update',
                      id: selected.id,
                      name: next,
                      description: brief,
                    });
                  }
                }}
              />
            </label>
            <textarea
              className="input w-full !p-2.5 !text-sm min-h-[64px]"
              placeholder="Project description"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onBlur={() => {
                if ((brief || '') !== (selected.description || '')) {
                  void onAct({
                    action: 'project_update',
                    id: selected.id,
                    name: heading.trim() || selected.name,
                    description: brief,
                  });
                }
              }}
            />
          </div>
          {selectedPlanned ? (
            <p className="text-xs text-neutral-500">
              Project duration is the envelope of every task (
              {selectedPlanned.envelope.start} → {selectedPlanned.envelope.end},{' '}
              {daysBetween(
                selectedPlanned.envelope.start,
                selectedPlanned.envelope.end
              ) + 1}{' '}
              days) — same as Microsoft Project.
            </p>
          ) : null}
          {(selectedPlanned?.tree || []).map((node) =>
            renderPortalTask(node)
          )}
          <div className="rounded-2xl border border-dashed border-slate-200 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Add a top-level task
            </p>
            <input
              className="input w-full !py-2 !px-2.5 !text-sm"
              placeholder="Task name *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold uppercase text-neutral-400">
                Start
                <input
                  type="date"
                  className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                  value={taskStart}
                  onChange={(e) => setTaskStart(e.target.value)}
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-neutral-400">
                End
                <input
                  type="date"
                  className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                  value={taskEnd}
                  onChange={(e) => setTaskEnd(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !title.trim() || !taskStart || !taskEnd}
              onClick={() => {
                const t = title;
                setTitle('');
                void onAct({
                  action: 'task_add',
                  project_id: selected.id,
                  title: t,
                  start_date: taskStart,
                  due_date: taskEnd,
                });
              }}
              className="btn-primary w-full !py-2 !px-3 text-xs"
            >
              Add task
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  function renderPortalTask(
    t: WbsNode<
      NonNullable<
        PublicPortalPayload['workspace']
      >['projects'][number]['tasks'][number] & {
        start_date: string;
        due_date: string;
      }
    >
  ): ReactNode {
            const open = openTaskId === t.id;
            const taskRiad = riad.filter((r) => r.related_task_id === t.id);
            const kidsOpen = t.children.length > 0 && !collapsedTasks.has(t.id);
            return (
            <div
              key={t.id}
              id={`portal-task-${t.id}`}
              className="space-y-2"
              style={{ marginLeft: t.depth * 14 }}
            >
            <div
              className={`rounded-2xl px-3 py-2.5 space-y-2 ${
                open
                  ? 'bg-cyan-50 border border-cyan-200 ring-2 ring-[#00b4d8]/30'
                  : 'bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    className="input w-full !py-1.5 !px-2 !text-sm font-bold"
                    defaultValue={t.title}
                    key={`${t.id}-${t.title}`}
                    disabled={busy}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== t.title) {
                        void onAct({
                          action: 'task_update',
                          id: t.id,
                          title: next,
                        });
                      }
                    }}
                  />
                  {t.phase_key ? (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6] mt-0.5">
                      {t.phase_key}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  {['todo', 'in_progress', 'done'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void onAct({
                          action: 'task_update',
                          id: t.id,
                          column_key: col,
                        })
                      }
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        t.column_key === col
                          ? 'bg-[#00b4d8] border-[#00b4d8] text-white'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {col.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  Start
                  <input
                    type="date"
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={t.start_date}
                    disabled={busy}
                    onChange={(e) =>
                      void onAct({
                        action: 'task_update',
                        id: t.id,
                        start_date: e.target.value,
                        due_date: t.due_date,
                      })
                    }
                  />
                </label>
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  End
                  <input
                    type="date"
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={t.due_date}
                    disabled={busy}
                    onChange={(e) =>
                      void onAct({
                        action: 'task_update',
                        id: t.id,
                        start_date: t.start_date,
                        due_date: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 block">
                Assign
                {people.length === 0 ? (
                  <p className="mt-0.5 text-[11px] font-medium normal-case tracking-normal text-amber-800">
                    Host team and portal people appear here.
                  </p>
                ) : null}
                <PersonPicker
                  people={people}
                  hostName={hostName}
                  accountLabel={accountLabel}
                  value={taskAssigneeKey(t)}
                  disabled={busy || people.length === 0}
                  onChange={(key, person) => {
                    void onAct({
                      action: 'task_update',
                      id: t.id,
                      assignee_key: key || null,
                      assignee: person?.name || null,
                      assignee_viewer_id:
                        person?.side === 'guest' ? person.id : null,
                      assignee_member_id:
                        person?.side === 'host' ? person.id : null,
                    });
                  }}
                />
              </label>
              {t.assignee && !t.assignee_viewer_id ? (
                <p className="text-[11px] text-neutral-500">
                  Currently: {t.assignee}
                </p>
              ) : null}

              {taskRiad.length > 0 ? (
                <ul className="space-y-1">
                  {taskRiad.map((r) => (
                    <li
                      key={r.id}
                      className="text-xs rounded-xl bg-white border border-slate-100 px-2.5 py-1.5"
                    >
                      <span className="font-bold uppercase tracking-wide text-[#0077b6]">
                        {r.entry_type}
                      </span>{' '}
                      · {r.title}
                      <span className="text-neutral-400">
                        {' '}
                        · {String(r.status || 'open').replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className="text-xs font-bold text-[#0077b6]"
                onClick={() => setOpenTaskId(open ? null : t.id)}
              >
                {open ? 'Hide RIAD' : 'Log RIAD on this task'}
              </button>
              {open ? (
                <TaskRiadForm
                  taskId={t.id}
                  taskTitle={t.title}
                  ownerName={t.assignee || ownerName}
                  people={people}
                  hostName={hostName}
                  accountLabel={accountLabel}
                  busy={busy}
                  onAct={onAct}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {t.children.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                    onClick={() =>
                      setCollapsedTasks((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      })
                    }
                  >
                    {kidsOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {t.children.length} sub-task
                    {t.children.length === 1 ? '' : 's'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-bold text-[#0077b6]"
                  onClick={() => {
                    setSubParent(subParent === t.id ? null : t.id);
                    setSubTitle('');
                    setSubStart(String(t.start_date));
                    setSubEnd(String(t.due_date));
                  }}
                >
                  {subParent === t.id ? 'Cancel sub-task' : 'Add sub-task'}
                </button>
              </div>
              {subParent === t.id ? (
                <div className="rounded-2xl border border-dashed border-cyan-200 bg-white p-3 space-y-2">
                  <input
                    className="input w-full !py-1.5 !px-2 !text-sm"
                    placeholder="Sub-task name *"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className="input !py-1.5 !px-2 !text-sm"
                      value={subStart}
                      onChange={(e) => setSubStart(e.target.value)}
                    />
                    <input
                      type="date"
                      className="input !py-1.5 !px-2 !text-sm"
                      value={subEnd}
                      onChange={(e) => setSubEnd(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !subTitle.trim() || !subStart || !subEnd}
                    onClick={() => {
                      const name = subTitle.trim();
                      setSubTitle('');
                      setSubParent(null);
                      setCollapsedTasks((prev) => {
                        const next = new Set(prev);
                        next.delete(t.id);
                        return next;
                      });
                      void onAct({
                        action: 'task_add',
                        project_id: selected!.id,
                        parent_task_id: t.id,
                        title: name,
                        start_date: subStart,
                        due_date: subEnd,
                      });
                    }}
                    className="btn-primary w-full !py-2 text-xs"
                  >
                    Create sub-task
                  </button>
                </div>
              ) : null}
            </div>
            {kidsOpen
              ? t.children.map((child) => renderPortalTask(child))
              : null}
            </div>
            );
  }
}

function OrdersPanel({
  isSupplier,
  orders,
  busy,
  onAct,
}: {
  isSupplier: boolean;
  orders: PublicPortalPayload['purchase_orders'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  if (!orders.length) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        No orders on this account yet.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li
          key={`${o.kind}-${o.id}`}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">{o.number}</p>
              <p className="text-[11px] text-neutral-500">
                {[o.date, o.due ? `expected ${o.due}` : null, o.status]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {o.amount != null ? (
              <p className="font-black tabular-nums text-slate-900">
                {formatMoney(o.amount, o.currency)}
              </p>
            ) : null}
          </div>
          {o.otifef ? (
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
              {[
                ['OTIFEF', o.otifef.pending ? '—' : pct(o.otifef.overall)],
                ['On time', o.otifef.pending ? '—' : pct(o.otifef.onTime)],
                ['In full', o.otifef.pending ? '—' : pct(o.otifef.inFull)],
                ['Error-free', o.otifef.pending ? '—' : pct(o.otifef.errorFree)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 py-1.5">
                  <div className="font-bold uppercase tracking-wider text-neutral-400">
                    {k}
                  </div>
                  <div className="font-black text-slate-800">{v}</div>
                </div>
              ))}
            </div>
          ) : null}
          {isSupplier ? (
            <SupplierOrderActions order={o} busy={busy} onAct={onAct} />
          ) : (
            <CustomerOrderActions order={o} busy={busy} onAct={onAct} />
          )}
        </li>
      ))}
    </ul>
  );
}

function SupplierOrderActions({
  order,
  busy,
  onAct,
}: {
  order: PublicPortalPayload['purchase_orders'][number];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [delivered, setDelivered] = useState(String(order.delivered ?? ''));
  const [stock, setStock] = useState('');
  const st = order.status.toLowerCase();
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-end">
      {st === 'sent' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAct({ action: 'po_update', id: order.id, status: 'accepted' })}
          className="btn-primary !py-1.5 !px-3 text-xs"
        >
          Accept order
        </button>
      ) : null}
      {st === 'accepted' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAct({ action: 'po_update', id: order.id, status: 'invoiced' })}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Mark shipped / invoiced
        </button>
      ) : null}
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Delivered qty
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={delivered}
          onChange={(e) => setDelivered(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Stock on hand
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: order.id,
            delivered_quantity: delivered ? Number(delivered) : undefined,
            stock_on_hand: stock ? Number(stock) : undefined,
          })
        }
        className="btn-secondary !py-1.5 !px-3 text-xs"
      >
        Update qty
      </button>
    </div>
  );
}

function CustomerOrderActions({
  order,
  busy,
  onAct,
}: {
  order: PublicPortalPayload['purchase_orders'][number];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [url, setUrl] = useState(order.attachment_url || '');
  const [date, setDate] = useState(order.due || '');
  const [qty, setQty] = useState(String(order.ordered ?? ''));
  if (order.kind !== 'purchase_order') {
    return (
      <p className="mt-2 text-[11px] text-neutral-500">
        Status is updated by {order.status ? `us · ${order.status}` : 'us'}.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-end">
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Expected date
        <input
          type="date"
          className="input mt-0.5 !py-1 !px-2 !text-xs"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400">
        Volume
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <label className="text-[10px] font-bold uppercase text-neutral-400 grow min-w-[10rem]">
        Attach PO URL
        <input
          className="input mt-0.5 !py-1 !px-2 !text-xs w-full"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: order.id,
            promised_date: date || undefined,
            order_quantity: qty ? Number(qty) : undefined,
            attachment_url: url || undefined,
          })
        }
        className="btn-secondary !py-1.5 !px-3 text-xs"
      >
        Save
      </button>
    </div>
  );
}

function StockPanel({
  lines,
  busy,
  onAct,
}: {
  lines: NonNullable<PublicPortalPayload['workspace']>['stock'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  if (!lines.length) {
    return (
      <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
        Stock lines appear from open purchase orders. Accept an order, then confirm
        what you have on hand.
      </p>
    );
  }
  return (
    <ul className="rounded-[1.5rem] border border-white/70 bg-white/90 divide-y divide-slate-100 overflow-hidden">
      {lines.map((l, i) => (
        <li key={`${l.po_id}-${l.sku}-${i}`} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">{l.name}</p>
              <p className="text-[11px] text-neutral-500">
                {[l.sku, l.po_id ? `PO #${l.po_id}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {l.po_id ? (
              <StockQuick poId={l.po_id} current={l.qty_on_hand} busy={busy} onAct={onAct} />
            ) : (
              <span className="text-sm font-black tabular-nums">
                {l.qty_on_hand ?? '—'}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StockQuick({
  poId,
  current,
  busy,
  onAct,
}: {
  poId: number;
  current: number | null;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [v, setV] = useState(current != null ? String(current) : '');
  return (
    <div className="flex items-center gap-1.5">
      <input
        className="input !py-1 !px-2 !text-xs w-20"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void onAct({
            action: 'po_update',
            id: poId,
            stock_on_hand: Number(v),
          })
        }
        className="btn-secondary !py-1 !px-2 text-xs"
      >
        Set
      </button>
    </div>
  );
}

function NewPoPanel({
  token,
  busy,
  onAct,
  catalogue,
  hostName,
}: {
  token: string;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
  catalogue: PortalCatalogueItem[];
  hostName: string;
}) {
  type Line = {
    key: string;
    product_id: number | null;
    name: string;
    sku: string | null;
    qty: number;
    unit_price: number;
    uom: string | null;
  };
  const [lines, setLines] = useState<Line[]>([]);
  const [poNumber, setPoNumber] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [freeName, setFreeName] = useState('');
  const [freeQty, setFreeQty] = useState('1');
  const [freePrice, setFreePrice] = useState('');
  const [chipQty, setChipQty] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const branded = catalogue.filter((c) => c.customer_brand);
  const shown = branded.length ? branded : catalogue;
  const total = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0),
        0
      ),
    [lines]
  );

  const addFromCatalogue = (c: PortalCatalogueItem) => {
    const qty = Math.max(1, Number(chipQty) || 1);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product_id === c.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + qty };
        return next;
      }
      return [
        ...prev,
        {
          key: `p-${c.id}-${Date.now()}`,
          product_id: c.id,
          name: c.name,
          sku: c.sku,
          qty,
          unit_price: Number(c.unit_price) || 0,
          uom: c.uom || 'ea',
        },
      ];
    });
  };

  const addFreeLine = () => {
    const name = freeName.trim();
    if (!name) return;
    const qty = Math.max(1, Number(freeQty) || 1);
    setLines((prev) => [
      ...prev,
      {
        key: `f-${Date.now()}`,
        product_id: null,
        name,
        sku: null,
        qty,
        unit_price: Number(freePrice) || 0,
        uom: 'ea',
      },
    ]);
    setFreeName('');
    setFreeQty('1');
    setFreePrice('');
  };

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const send = async () => {
    setErr(null);
    let attachment_url: string | undefined;
    let attachment_name: string | undefined;
    try {
      if (file) {
        setUploading(true);
        try {
          const fd = new FormData();
          fd.set('token', token);
          fd.set('file', file);
          const res = await fetch('/api/public/portals/trade/upload', {
            method: 'POST',
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          attachment_url = data.url;
          attachment_name = data.name || file.name;
        } finally {
          setUploading(false);
        }
      }
      await onAct({
        action: 'po_create',
        po_number: poNumber || undefined,
        promised_date: date || undefined,
        description: notes || undefined,
        total_amount: total,
        attachment_url,
        attachment_name,
        items: lines.map((l) => ({
          name: l.name,
          sku: l.sku,
          qty: l.qty,
          quantity: l.qty,
          unit_price: l.unit_price,
          product_id: l.product_id,
          uom: l.uom,
          line_total: Math.round(Number(l.qty) * Number(l.unit_price) * 100) / 100,
        })),
      });
      setLines([]);
      setPoNumber('');
      setNotes('');
      setFile(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send PO');
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-4 dark:border-white/10 dark:bg-neutral-900">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Raise a PO
        </p>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Order from {hostName}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
          Select products, set quantities and delivery date, then send. This
          lands as a purchase order and a sales order on our books. Attach your
          own PO if you have one.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input w-full !p-3 !text-sm"
          placeholder="Your PO number *"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
        />
        <input
          type="date"
          className="input !p-3 !text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {shown.length > 0 ? (
        <div className="rounded-2xl border border-cyan-100 bg-sky-50/60 p-3 space-y-2 dark:border-cyan-400/20 dark:bg-cyan-400/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
              {branded.length ? 'Your branded products' : 'Catalogue'} ·{' '}
              {shown.length} item{shown.length === 1 ? '' : 's'}
            </p>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-white/80">
              Qty
              <input
                type="number"
                min={1}
                step={1}
                className="input !py-1 !px-2 !text-xs w-16 tabular-nums"
                value={chipQty}
                onChange={(e) =>
                  setChipQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => addFromCatalogue(c)}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:border-[#00b4d8] hover:bg-[#e0f7fc] text-left dark:border-white/15 dark:bg-white/10 dark:text-white"
                title={c.short_description || c.name}
              >
                <span>{c.name}</span>
                {c.sku ? (
                  <span className="font-normal text-neutral-400">{c.sku}</span>
                ) : null}
                <span className="font-normal text-neutral-500 tabular-nums dark:text-white/60">
                  {formatMoney(Number(c.unit_price || 0), c.currency)}
                  {c.uom ? `/${c.uom}` : ''}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-neutral-500 dark:text-white/50">
            Tap a product to add it (qty above). Same product merges quantity.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          No sellable catalogue published yet — use free-text lines below, or
          ask us to tag your SKUs in Inventory → Customer brand.
        </p>
      )}

      {lines.length > 0 ? (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li
              key={l.key}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2 dark:border-white/10 dark:bg-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {l.name}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {[l.sku, l.product_id ? `ID ${l.product_id}` : 'Free-text', l.uom]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeLine(l.key)}
                  className="text-[11px] font-bold text-rose-600"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  Qty
                  <input
                    type="number"
                    min={1}
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={l.qty}
                    onChange={(e) =>
                      updateLine(l.key, {
                        qty: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </label>
                <label className="text-[10px] font-bold uppercase text-neutral-400">
                  Unit price
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input mt-0.5 w-full !py-1.5 !px-2 !text-sm"
                    value={l.unit_price}
                    onChange={(e) =>
                      updateLine(l.key, {
                        unit_price: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>
              <p className="text-xs font-semibold text-slate-700 tabular-nums text-right dark:text-white/80">
                Line:{' '}
                {formatMoney(Number(l.qty) * Number(l.unit_price))}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-200 p-3 space-y-2 dark:border-white/15">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          Free-text line (optional)
        </p>
        <input
          className="input w-full !p-2.5 !text-sm"
          placeholder="Item name"
          value={freeName}
          onChange={(e) => setFreeName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input !p-2.5 !text-sm"
            placeholder="Qty"
            value={freeQty}
            onChange={(e) => setFreeQty(e.target.value)}
          />
          <input
            className="input !p-2.5 !text-sm"
            placeholder="Unit price"
            value={freePrice}
            onChange={(e) => setFreePrice(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy || !freeName.trim()}
          onClick={addFreeLine}
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Add line
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
          Total {formatMoney(total)}
        </p>
        <p className="text-[11px] text-slate-500">
          Delivery date applies to the whole PO
        </p>
      </div>
      <textarea
        className="input w-full !p-3 !text-sm min-h-[64px]"
        placeholder="Notes / delivery instructions (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm dark:border-white/15 dark:bg-black/20">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Attach your PO (PDF, image, Word)
        </span>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf"
          className="mt-2 block w-full text-xs"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {file ? (
          <p className="mt-1 text-xs font-semibold text-[#0077b6]">{file.name}</p>
        ) : null}
      </label>
      {err ? (
        <p className="text-sm font-semibold text-rose-700">{err}</p>
      ) : null}
      <button
        type="button"
        disabled={
          busy || uploading || lines.length === 0 || !poNumber.trim() || !date
        }
        onClick={() => void send()}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        {uploading
          ? 'Uploading attachment…'
          : `Send purchase order${
              lines.length
                ? ` · ${lines.length} line${lines.length === 1 ? '' : 's'}`
                : ''
            }`}
      </button>
    </div>
  );
}

function MessagesPanel({
  items,
  busy,
  isHost,
  accountLabel,
  onAct,
}: {
  items: NonNullable<PublicPortalPayload['workspace']>['messages'];
  busy: boolean;
  isHost?: boolean;
  accountLabel?: string | null;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [body, setBody] = useState('');
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 space-y-3">
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No messages yet.</p>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl px-3 py-2 text-sm ${
                m.author === (isHost ? 'host' : 'guest')
                  ? 'bg-cyan-50 text-slate-900 ml-8'
                  : 'bg-slate-50 text-slate-800 mr-8'
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {isHost
                  ? m.author === 'host'
                    ? 'You'
                    : accountLabel || 'Them'
                  : m.author === 'guest'
                    ? 'You'
                    : 'Us'}
              </p>
              <p>{m.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 !p-2.5 !text-sm"
          placeholder="Message the team"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => {
            const t = body;
            setBody('');
            void onAct({ action: 'message', body: t });
          }}
          className="btn-primary !py-2 !px-3 text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}


function OtifefPanel({
  orders,
}: {
  orders: PublicPortalPayload['purchase_orders'];
}) {
  const lined = orders.filter((o) => o.otifef);
  if (!lined.length) return null;
  return (
    <ul className="space-y-2">
      {lined.map((o) => (
        <li
          key={`${o.kind}-${o.id}`}
          className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">{o.number}</p>
            <p className="text-[11px] text-neutral-500">{o.status}</p>
          </div>
          <div className="flex gap-2 text-[10px] font-bold tabular-nums">
            <span className="rounded-full bg-slate-50 px-2 py-0.5">
              OTIFEF {o.otifef?.pending ? '—' : pct(o.otifef?.overall)}
            </span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5">
              OT {o.otifef?.pending ? '—' : pct(o.otifef?.onTime)}
            </span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5">
              IF {o.otifef?.pending ? '—' : pct(o.otifef?.inFull)}
            </span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5">
              EF {o.otifef?.pending ? '—' : pct(o.otifef?.errorFree)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatementPanel({
  invoices,
  quotes,
  hostName,
}: {
  invoices: PublicPortalPayload['invoices'];
  quotes: PublicPortalPayload['quotes'];
  hostName: string;
}) {
  const open = invoices.filter((i) => {
    const st = i.status.toLowerCase();
    return st !== 'paid' && st !== 'void' && st !== 'cancelled';
  });
  const due = open.reduce(
    (n, i) => n + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)),
    0
  );
  const currency = open[0]?.currency || invoices[0]?.currency || 'ZAR';

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Statement · {hostName}
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-slate-900">
          {formatMoney(due, currency)}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Open balance · {open.length} invoice{open.length === 1 ? '' : 's'} outstanding
        </p>
      </section>

      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-500">No invoices on this account yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((r) => {
              const remaining = Math.max(
                0,
                Number(r.amount || 0) - Number(r.paid || 0)
              );
              return (
                <li
                  key={`inv-${r.id}`}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{r.number}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {[r.date, r.due ? `due ${r.due}` : null, r.status]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-slate-900">
                      {formatMoney(r.amount, r.currency)}
                    </p>
                    {remaining > 0 && remaining !== Number(r.amount || 0) ? (
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Open {formatMoney(remaining, r.currency)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {quotes.length > 0 ? (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900">Quotes</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {quotes.map((r) => (
              <li
                key={`q-${r.id}`}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-900 text-sm">{r.number}</p>
                  <p className="text-[11px] text-neutral-500">
                    {[r.date, r.status].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {r.amount != null ? (
                  <p className="text-sm font-black tabular-nums">
                    {formatMoney(r.amount, r.currency)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReviewsPanel({
  kind,
  items,
  busy,
  readOnly,
  onAct,
}: {
  kind: PublicPortalPayload['kind'];
  items: NonNullable<PublicPortalPayload['workspace']>['ratings'];
  busy: boolean;
  readOnly?: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const dims = kind === 'supplier' ? CUSTOMER_DIMS : SUPPLIER_DIMS;
  const [overall, setOverall] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const payload = useMemo(() => {
    const p: Record<string, unknown> = { action: 'rate', overall, comment };
    for (const d of dims) p[d.key] = scores[d.key] || null;
    return p;
  }, [overall, scores, comment, dims]);

  return (
    <div className="space-y-4">
      {readOnly ? null : (
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
        <p className="text-sm font-bold text-slate-900">Rate us</p>
        <p className="text-xs text-neutral-500">
          Same 1–5 stars and dimensions as the rest of SupplierAdvisor.
        </p>
        <StarRating value={overall} onChange={setOverall} size="md" label="Overall" />
        {dims.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-800">{d.label}</p>
              <p className="text-[11px] text-neutral-500">{d.hint}</p>
            </div>
            <StarRating
              value={scores[d.key] || 0}
              onChange={(n) => setScores((s) => ({ ...s, [d.key]: n }))}
              size="sm"
              label={d.label}
            />
          </div>
        ))}
        <textarea
          className="input w-full !p-2 !text-sm min-h-[64px]"
          placeholder="Comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || overall < 1}
          onClick={() => void onAct(payload)}
          className="btn-primary !py-2 !px-4 text-sm"
        >
          Publish review
        </button>
      </div>
      )}
      {items.map((r) => (
        <div
          key={`${r.direction}-${r.id}`}
          className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-700">{r.author}</p>
            <StarRating value={r.overall} readOnly size="sm" />
          </div>
          {r.comment ? (
            <p className="text-sm text-neutral-600 mt-2">{r.comment}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
