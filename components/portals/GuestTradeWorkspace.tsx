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
  PortalDocSlot,
  PortalPersonPublic,
  PortalProjectTask,
  PortalRiadView,
  PublicPortalPayload,
} from '@/lib/portals/trade-portal';
import {
  applyPortalDocSlotUrl,
  emptyRequiredDocSlots,
  mergePortalDocSlots,
} from '@/lib/portals/portal-documents';
import { portalPersonKey } from '@/lib/portals/trade-portal-people';
import {
  RIAD_PRIORITIES,
  RIAD_TYPES,
  type RiadType,
} from '@/lib/containers/riad';
import type { BookProfile } from '@/lib/portals/trade-portal-workspace';
import GeoSelectFields from '@/components/geo/GeoSelectFields';
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
import { Building2, ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';
import { PortalRiadPanel } from '@/components/portals/PortalRiadPanel';
import { PortalPurchaseOrder } from '@/components/portals/PortalPurchaseOrder';
import { OrderChainPath } from '@/components/orders/OrderChainPath';
import {
  chainStepIndex,
  nextSupplierProductionAction,
} from '@/lib/orders/chain-path';
import { PortalJoinDemo } from '@/components/portals/PortalJoinDemo';
import {
  portalTimeAgo,
  portalWhen,
} from '@/lib/portals/portal-activity';
import type { GuestPortalTab } from '@/lib/portals/guest-portal-tabs';

export type { GuestPortalTab, GuestPortalTabGroup, GuestPortalTabItem } from '@/lib/portals/guest-portal-tabs';
export { guestPortalTabGroups, guestPortalTabs } from '@/lib/portals/guest-portal-tabs';

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
  continent: '',
  country: '',
  province: '',
  city: '',
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
  'document_save',
  'document_extra',
  'production_update',
]);
const REFRESH_ACTIONS = new Set([
  'project_create',
  'po_create',
  'profile',
  'rate',
  'po_update',
  'document_save',
  'document_extra',
  'production_update',
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
  if (
    (action === 'production_update' || action === 'po_update') &&
    prev.workspace
  ) {
    const id = Number(payload.id);
    const production_status =
      payload.production_status != null
        ? String(payload.production_status)
        : payload.status === 'accepted'
          ? 'released'
          : payload.status === 'invoiced' || payload.status === 'completed'
            ? 'completed'
            : undefined;
    const status =
      typeof payload.status === 'string' ? String(payload.status) : undefined;
    return {
      ...prev,
      workspace: {
        ...prev.workspace,
        purchase_orders: (prev.workspace.purchase_orders || []).map((o) =>
          o.id === id
            ? {
                ...o,
                status: status || o.status,
                production_status:
                  production_status ?? o.production_status,
              }
            : o
        ),
      },
    };
  }
  if (action === 'document_extra') {
    const extra = (
      data.extra && typeof data.extra === 'object' ? data.extra : null
    ) as { name?: string; url?: string; category?: string } | null;
    if (!extra?.url || !extra.name) return prev;
    const slot = {
      field: `extra:${extra.name}`,
      name: String(extra.name),
      url: String(extra.url),
      category: String(extra.category || 'Other'),
      extra: true,
    };
    if (String(payload.pack || 'account') === 'host') {
      return {
        ...prev,
        hostDocuments: [...(prev.hostDocuments || []), slot],
      };
    }
    return {
      ...prev,
      accountDocuments: [...(prev.accountDocuments || []), slot],
    };
  }
  if (action === 'document_save') {
    const field = String(payload.field || '');
    const url =
      payload.url != null && String(payload.url).trim()
        ? String(payload.url).trim()
        : null;
    const pack = String(payload.pack || 'account') === 'host' ? 'host' : 'account';
    if (pack === 'host') {
      return {
        ...prev,
        hostDocuments: applyPortalDocSlotUrl(prev.hostDocuments, field, url),
        documents: applyPortalDocSlotUrl(prev.hostDocuments, field, url)
          .filter((d) => d.url)
          .map((d) => ({
            name: d.name,
            url: d.url as string,
            category: d.category,
          })),
      };
    }
    return {
      ...prev,
      accountDocuments: applyPortalDocSlotUrl(prev.accountDocuments, field, url),
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
                      : action === 'document_save' || action === 'document_extra'
                        ? 'Document shared'
                        : action === 'production_update'
                          ? 'Production updated — customer sales order will follow'
                          : action === 'po_update'
                            ? 'Order updated'
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

  const ot = ws?.otifef;
  const orders = isSupplier
    ? ws?.purchase_orders || live.purchase_orders
    : [...(ws?.inbound_pos || []), ...(live.orders || [])];
  const listedOrders = (
    isSupplier
      ? ws?.purchase_orders || live.purchase_orders || []
      : [
          ...((ws?.purchase_orders || []).filter((o) => o.kind === 'order')),
          ...(live.orders || []),
        ]
  )
    .filter((o, i, all) => all.findIndex((x) => x.kind === o.kind && x.id === o.id) === i)
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return (
    <div className="space-y-4">
      {note ? (
        <p className="text-xs font-semibold text-[#0077b6]">{note}</p>
      ) : null}

      {isHost ? (
        <p className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Signed in as <strong>{live.actor?.name || 'you'}</strong> at{' '}
          <strong>{live.host.name}</strong>
          {live.accountLabel ? (
            <>
              {' '}
              — company profile and POs update{' '}
              <strong>{live.accountLabel}</strong> on {isSupplier ? 'SRM' : 'CRM'}
            </>
          ) : null}
          .
        </p>
      ) : null}

      {gaps.length > 0 && tab !== 'profile' && tab !== 'demo' ? (
        <button
          type="button"
          onClick={() => onTab('profile')}
          className="w-full text-left rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Complete the {live.accountLabel || 'company'} profile so it stays in
          sync with {isSupplier ? 'SRM' : 'CRM'} ({gaps.join(', ')}).
        </button>
      ) : null}

      {tab === 'profile' ? (
        <ProfilePanel
          profile={ws?.bookProfile || null}
          gaps={gaps}
          busy={busy}
          accountLabel={live.accountLabel}
          hostName={live.host.name}
          book={isSupplier ? 'SRM' : 'CRM'}
          onAct={act}
        />
      ) : null}

      {tab === 'quotes' && !isSupplier ? (
        <QuotesPanel
          quotes={live.quotes || []}
          hostName={live.host.name}
        />
      ) : null}

      {tab === 'orders' ? (
        <OrdersPanel
          isSupplier={isSupplier}
          isHost={isHost}
          orders={listedOrders}
          busy={busy}
          onAct={act}
          onFeedback={() => onTab('reviews')}
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
      {tab === 'newpo' && !isSupplier ? (
        <PortalPurchaseOrder
          token={token}
          busy={busy}
          onAct={act}
          catalogue={ws?.catalogue || []}
          hostName={live.host.name}
          hostLogo={live.host.logo_url}
          hostCountry={live.host.country}
          accountName={live.accountLabel}
          accountLogo={live.accountLogo || ws?.bookProfile?.logo_url}
          book={ws?.bookProfile}
          viewerName={live.actor?.name || live.viewer?.name}
          viewerEmail={live.viewer?.email}
          onViewOrders={() => onTab('orders')}
        />
      ) : null}
      {tab === 'docs' ? (
        <CompanyDocsPanel
          token={token}
          kind={live.kind}
          isHost={isHost}
          busy={busy}
          hostName={live.host.name}
          hostLogo={live.host.logo_url}
          hostDocs={live.hostDocuments || []}
          accountName={live.accountLabel}
          accountLogo={live.accountLogo}
          accountDocs={live.accountDocuments || []}
          onAct={act}
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
      {tab === 'demo' ? (
        <PortalJoinDemo
          hostName={live.host.name}
          hostLogo={live.host.logo_url}
          kind={live.kind}
          joinPath={live.joinPath}
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
                {p.side === 'host' ? null : p.last_seen_at ? (
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Last login {portalTimeAgo(p.last_seen_at)}
                    {portalWhen(p.last_seen_at)
                      ? ` · ${portalWhen(p.last_seen_at)}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Never logged in
                  </p>
                )}
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

function coercePortalDocSlots(docs: PortalDocSlot[]): PortalDocSlot[] {
  const required = docs.filter((d) => d.field && !d.extra);
  if (required.length >= 7) return docs.length ? docs : emptyRequiredDocSlots();
  return mergePortalDocSlots({
    metadata: { documents: docs },
  });
}

function CompanyDocsPanel({
  token,
  kind,
  isHost,
  busy,
  hostName,
  hostLogo,
  hostDocs,
  accountName,
  accountLogo,
  accountDocs,
  onAct,
}: {
  token: string;
  kind: PublicPortalPayload['kind'];
  isHost?: boolean;
  busy: boolean;
  hostName: string;
  hostLogo?: string | null;
  hostDocs: PortalDocSlot[];
  accountName?: string | null;
  accountLogo?: string | null;
  accountDocs: PortalDocSlot[];
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [docNote, setDocNote] = useState<string | null>(null);
  const hostSlots = coercePortalDocSlots(hostDocs);
  const accountSlots = coercePortalDocSlots(accountDocs);
  const packs: Array<{
    key: 'host' | 'account';
    name: string;
    logo?: string | null;
    docs: PortalDocSlot[];
    canEdit: boolean;
  }> = [
    {
      key: 'host',
      name: hostName,
      logo: hostLogo,
      docs: hostSlots,
      canEdit: !!isHost,
    },
    {
      key: 'account',
      name: accountName || (kind === 'supplier' ? 'Supplier' : 'Customer'),
      logo: accountLogo,
      docs: accountSlots,
      canEdit: true,
    },
  ];

  const saveSlot = async (
    pack: 'host' | 'account',
    field: string,
    file?: File | null,
    pasted?: string
  ) => {
    const key = `${pack}:${field}`;
    setUploading(key);
    setDocNote(null);
    try {
      let url = String(pasted || '').trim();
      if (file && file.size > 0) {
        const form = new FormData();
        form.append('token', token);
        form.append('file', file);
        form.append('purpose', 'company-doc');
        form.append('field', field);
        const res = await fetch('/api/public/portals/trade/upload', {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Upload failed');
        }
        url = data.url;
      }
      if (!url) throw new Error('Choose a file or paste a URL');
      await onAct({ action: 'document_save', pack, field, url });
    } catch (e) {
      setDocNote(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      {docNote ? (
        <p className="text-xs font-semibold text-rose-700">{docNote}</p>
      ) : null}
      <p className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-slate-700">
        Required documents for both companies — registration, VAT, B-BBEE, bank
        confirmation letter, import, export, and tax. Files saved here are
        shared on this portal
        {isHost
          ? ` and on ${kind === 'supplier' ? 'SRM' : 'CRM'} / My Business.`
          : '.'}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {packs.map((p) => {
          const required = p.docs.filter((d) => !d.extra);
          const extra = p.docs.filter((d) => d.extra);
          const filled = required.filter((d) => d.url).length;
          return (
            <section
              key={p.key}
              className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logo}
                    alt=""
                    className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                    <Building2 className="h-5 w-5 text-[#00b4d8]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                    {p.key === 'host'
                      ? 'Company'
                      : kind === 'supplier'
                        ? 'Supplier'
                        : 'Customer'}
                  </p>
                  <h2 className="text-sm font-black text-slate-900 truncate">
                    {p.name}
                  </h2>
                </div>
                <p className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                  {filled}/{required.length || 7}
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {required.map((d) => (
                  <DocSlotRow
                    key={`${p.key}-${d.field}`}
                    slot={d}
                    canEdit={p.canEdit && !d.extra}
                    busy={busy || uploading === `${p.key}:${d.field}`}
                    onFile={(file) => void saveSlot(p.key, d.field, file)}
                    onUrl={(url) => void saveSlot(p.key, d.field, null, url)}
                  />
                ))}
                {extra.map((d) => (
                  <li key={`${p.key}-extra-${d.name}-${d.url}`}>
                    <a
                      href={d.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-sky-50/60"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900 truncate">
                          {d.name}
                        </span>
                        <span className="block text-[11px] text-neutral-500">
                          {d.category} · additional
                        </span>
                      </span>
                      <FileText className="w-4 h-4 text-[#00b4d8] shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
              {p.canEdit ? (
                <ExtraDocForm
                  busy={busy || uploading === `${p.key}:extra`}
                  onAdd={async (name, category, file, url) => {
                    setUploading(`${p.key}:extra`);
                    setDocNote(null);
                    try {
                      let nextUrl = url;
                      if (file) {
                        const form = new FormData();
                        form.append('token', token);
                        form.append('file', file);
                        form.append('purpose', 'company-doc');
                        form.append('field', 'extra');
                        const res = await fetch(
                          '/api/public/portals/trade/upload',
                          {
                            method: 'POST',
                            body: form,
                            credentials: 'include',
                          }
                        );
                        const data = (await res.json()) as {
                          url?: string;
                          error?: string;
                        };
                        if (!res.ok || !data.url) {
                          throw new Error(data.error || 'Upload failed');
                        }
                        nextUrl = data.url;
                      }
                      await onAct({
                        action: 'document_extra',
                        pack: p.key,
                        name,
                        category,
                        url: nextUrl,
                      });
                    } catch (e) {
                      setDocNote(
                        e instanceof Error ? e.message : 'Save failed'
                      );
                    } finally {
                      setUploading(null);
                    }
                  }}
                />
              ) : null}
              {!p.canEdit ? (
                <p className="px-5 py-2 text-[11px] text-neutral-500">
                  Host company files are updated by {hostName}.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ExtraDocForm({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (
    name: string,
    category: string,
    file: File | null,
    url: string
  ) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50/60">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
        Add additional document
      </p>
      <p className="text-[11px] text-slate-500">
        Specs, contracts, certificates, or anything else you want shared on this
        portal.
      </p>
      <input
        className="input w-full !py-2 !px-3 !text-sm"
        placeholder="Document name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="input !py-2 !px-3 !text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {['Other', 'Legal', 'Financial', 'Quality', 'Spec', 'Contract'].map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            )
          )}
        </select>
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
          <Upload className="h-3.5 w-3.5" />
          {file ? file.name.slice(0, 18) : 'Upload'}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <input
        className="input w-full !py-2 !px-3 !text-xs"
        placeholder="or paste https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || !name.trim() || (!file && !url.trim())}
        onClick={() => {
          const n = name.trim();
          const u = url.trim();
          const f = file;
          setName('');
          setUrl('');
          setFile(null);
          void onAdd(n, category, f, u);
        }}
        className="btn-secondary w-full !py-2 text-xs"
      >
        {busy ? 'Saving…' : 'Add document'}
      </button>
    </div>
  );
}

function DocSlotRow({
  slot,
  canEdit,
  busy,
  onFile,
  onUrl,
}: {
  slot: PortalDocSlot;
  canEdit: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
}) {
  const [paste, setPaste] = useState('');
  return (
    <li className="px-5 py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">
            {slot.name}
          </span>
          <span className="block text-[11px] text-neutral-500">
            {slot.category}
            {slot.url ? ' · on file' : ' · not on file'}
          </span>
        </span>
        {slot.url ? (
          <a
            href={slot.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0077b6] shrink-0"
          >
            <FileText className="w-4 h-4" />
            View
          </a>
        ) : (
          <span className="text-[11px] font-semibold text-amber-800 shrink-0">
            Needed
          </span>
        )}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700">
            <Upload className="h-3.5 w-3.5" />
            {busy ? 'Saving…' : slot.url ? 'Replace' : 'Upload'}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onFile(file);
              }}
            />
          </label>
          <input
            className="input !py-1 !px-2 !text-xs min-w-[10rem] flex-1"
            placeholder="or paste https://…"
            value={paste}
            disabled={busy}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => {
              const u = paste.trim();
              setPaste('');
              onUrl(u);
            }}
            className="btn-secondary !py-1 !px-2 text-xs"
          >
            Share
          </button>
        </div>
      ) : null}
    </li>
  );
}

function ProfilePanel({
  profile,
  gaps,
  busy,
  accountLabel,
  hostName,
  book,
  onAct,
}: {
  profile: BookProfile | null;
  gaps: string[];
  busy: boolean;
  accountLabel?: string | null;
  hostName?: string;
  book: 'CRM' | 'SRM';
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<BookProfile>(profile || EMPTY_PROFILE);
  useEffect(() => {
    setForm(profile || EMPTY_PROFILE);
  }, [profile]);

  const set = (key: keyof BookProfile, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const beforeGeo: Array<{
    key: keyof BookProfile;
    label: string;
    required?: boolean;
    span?: boolean;
  }> = [
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
  ];
  const afterGeo: Array<{
    key: keyof BookProfile;
    label: string;
    required?: boolean;
    span?: boolean;
  }> = [
    { key: 'payment_terms', label: 'Payment terms' },
    { key: 'industry', label: 'Industry' },
  ];

  const renderField = (f: (typeof beforeGeo)[number]) => (
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
          onChange={(e) => set(f.key, e.target.value)}
        />
      ) : (
        <input
          className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
          type={f.key === 'email' ? 'email' : 'text'}
          value={form[f.key]}
          onChange={(e) => set(f.key, e.target.value)}
        />
      )}
    </label>
  );

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Profile · {book}
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
          {accountLabel || 'Profile'}
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          This is the same {accountLabel || 'account'} record as {book}
          {hostName ? ` on ${hostName}` : ''}. Saving here updates that book.
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
        {beforeGeo.map(renderField)}
        <div className="sm:col-span-2">
          <GeoSelectFields
            compact
            continentRequired
            countryRequired
            disabled={busy}
            value={{
              continent: form.continent || '',
              country: form.country || '',
              province: form.province || '',
              city: form.city || '',
            }}
            onChange={(g) =>
              setForm((prev) => ({
                ...prev,
                continent: g.continent,
                country: g.country,
                province: g.province,
                city: g.city,
              }))
            }
          />
        </div>
        {afterGeo.map(renderField)}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAct({ action: 'profile', ...form })}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Save to {book}
      </button>
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
  const [showCreate, setShowCreate] = useState(false);
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
          }).then((ok) => {
            if (ok) {
              setNewName('');
              setNewDesc('');
              setShowCreate(false);
            }
          });
        }}
        className="btn-primary w-full !py-2.5 text-sm"
      >
        Create project
      </button>
    </div>
  );

  const createToggle = (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowCreate((v) => !v)}
        className="btn-secondary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-2"
      >
        {showCreate ? (
          'Cancel'
        ) : (
          <>
            Add new project
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>
      {showCreate ? createForm : null}
    </div>
  );

  if (!items.length) {
    return (
      <div className="space-y-4">
        {createToggle}
        <p className="text-sm text-slate-500">
          No projects yet. Expand Add new project to open a joint waterfall on
          both our books.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {createToggle}
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
  isHost,
  orders,
  busy,
  onAct,
  onFeedback,
}: {
  isSupplier: boolean;
  isHost?: boolean;
  orders: PublicPortalPayload['purchase_orders'];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
  onFeedback?: () => void;
}) {
  const side = isSupplier ? 'supplier' : 'customer';
  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Golden path
        </p>
        <p className="text-sm font-black text-slate-900">
          {isSupplier
            ? 'Receive, produce, ship'
            : 'Order, produce, deliver, feedback'}
        </p>
        <p className="text-xs text-slate-500">
          {isSupplier
            ? 'Accept the PO, update production as you make it, then ship. Status is shared back to the sales order automatically — the customer never sees your costs.'
            : 'Your purchase order becomes a sales order, then production, delivery, and feedback. Production status is live from the factory floor.'}
        </p>
        <OrderChainPath side={side} />
      </div>
      {!orders.length ? (
        <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
          {isSupplier
            ? 'No purchase orders on this account yet.'
            : 'No sales orders on this account yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const stage =
              o.chain_step ??
              chainStepIndex({
                side,
                orderStatus: o.status,
                productionStatus: o.production_status,
                shippedDate: o.completed_at,
                deliveredQty: o.delivered,
                rated: o.rated,
                hasSalesOrder: o.kind === 'order' || !isSupplier,
              });
            return (
              <li
                key={`${o.kind}-${o.id}`}
                className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-900">{o.number}</p>
                    <p className="text-[11px] text-neutral-500">
                      {[
                        o.customer_po_number && !isSupplier
                          ? `PO ${o.customer_po_number}`
                          : null,
                        o.date,
                        o.due ? `expected ${o.due}` : null,
                        o.production_label && !isSupplier
                          ? o.production_label
                          : o.status,
                      ]
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
                <div className="mt-3">
                  <OrderChainPath side={side} current={stage} />
                </div>
                {o.batches && o.batches.length ? (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Traceability
                    </p>
                    <ul className="mt-1 space-y-1">
                      {o.batches.map((b, i) => (
                        <li
                          key={`${b.batch_number}-${i}`}
                          className="text-[11px] text-slate-700"
                        >
                          <span className="font-bold">{b.batch_number}</span>
                          {b.manufactured_at
                            ? ` · manufactured ${b.manufactured_at}`
                            : ''}
                          {b.expiry_date ? ` · expiry ${b.expiry_date}` : ''}
                          {b.qty != null ? ` · qty ${b.qty}${b.uom ? ` ${b.uom}` : ''}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {isHost && !isSupplier && o.kind === 'order' && o.linked === false ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
                    No manufacturer PO linked yet. Set a preferred manufacturer
                    or raise a linked PO from Sales orders.
                  </p>
                ) : null}
                {o.otifef ? (
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
                    {[
                      ['OTIFEF', o.otifef.pending ? '—' : pct(o.otifef.overall)],
                      ['On time', o.otifef.pending ? '—' : pct(o.otifef.onTime)],
                      ['In full', o.otifef.pending ? '—' : pct(o.otifef.inFull)],
                      [
                        'Error-free',
                        o.otifef.pending ? '—' : pct(o.otifef.errorFree),
                      ],
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
                  <CustomerOrderActions
                    order={o}
                    busy={busy}
                    onAct={onAct}
                    stage={stage}
                    onFeedback={onFeedback}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
  const [qty, setQty] = useState(String(order.confirmed_qty ?? order.ordered ?? ''));
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const next = nextSupplierProductionAction(
    order.status,
    order.production_status
  );
  const needsLot = next?.status === 'completed';
  const lotOk =
    !needsLot ||
    (batchNumber.trim() && manufacturedAt && expiryDate);
  const runNext = () => {
    if (!next) return;
    if (next.status === 'accepted') {
      void onAct({ action: 'po_update', id: order.id, status: 'accepted' });
      return;
    }
    if (next.status === 'shipped') {
      void onAct({
        action: 'po_update',
        id: order.id,
        status: 'invoiced',
        delivered_quantity: delivered ? Number(delivered) : undefined,
      });
      return;
    }
    const batches =
      needsLot && batchNumber.trim()
        ? [
            {
              batch_number: batchNumber.trim(),
              manufactured_at: manufacturedAt,
              produced_at: manufacturedAt,
              expiry_date: expiryDate,
              qty: qty ? Number(qty) : undefined,
            },
          ]
        : undefined;
    void onAct({
      action: 'production_update',
      id: order.id,
      production_status: next.status,
      confirmed_qty: qty ? Number(qty) : undefined,
      batches,
    });
  };
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        {next ? (
          <button
            type="button"
            disabled={busy || !lotOk}
            onClick={runNext}
            className="btn-primary !py-2 !px-4 text-xs"
          >
            {next.label}
          </button>
        ) : (
          <p className="text-[11px] font-semibold text-emerald-800">
            This order is complete on the path.
          </p>
        )}
        <label className="text-[10px] font-bold uppercase text-neutral-400">
          Confirmed qty
          <input
            className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label className="text-[10px] font-bold uppercase text-neutral-400">
          Delivered qty
          <input
            className="input mt-0.5 !py-1 !px-2 !text-xs w-24"
            value={delivered}
            onChange={(e) => setDelivered(e.target.value)}
          />
        </label>
      </div>
      {needsLot ? (
        <div className="grid gap-2 sm:grid-cols-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <label className="text-[10px] font-bold uppercase text-neutral-400">
            Batch number *
            <input
              className="input mt-0.5 !py-1 !px-2 !text-xs w-full"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="LOT-…"
            />
          </label>
          <label className="text-[10px] font-bold uppercase text-neutral-400">
            Manufactured *
            <input
              type="date"
              className="input mt-0.5 !py-1 !px-2 !text-xs w-full"
              value={manufacturedAt}
              onChange={(e) => setManufacturedAt(e.target.value)}
            />
          </label>
          <label className="text-[10px] font-bold uppercase text-neutral-400">
            Expiry *
            <input
              type="date"
              className="input mt-0.5 !py-1 !px-2 !text-xs w-full"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </label>
        </div>
      ) : null}
      <p className="text-[11px] text-neutral-500">
        Each tap moves the chain and updates the customer sales order. They
        see Scheduled / In production / Produced and lot details — never your
        costs.
      </p>
    </div>
  );
}

function CustomerOrderActions({
  order,
  busy,
  onAct,
  stage,
  onFeedback,
}: {
  order: PublicPortalPayload['purchase_orders'][number];
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
  stage?: number;
  onFeedback?: () => void;
}) {
  const [url, setUrl] = useState(order.attachment_url || '');
  const [date, setDate] = useState(order.due || '');
  const [qty, setQty] = useState(String(order.ordered ?? ''));
  if (order.kind !== 'purchase_order') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[11px] text-neutral-500">
          {order.production_label
            ? `Production: ${order.production_label}`
            : 'We update production and delivery here as the order moves.'}
        </p>
        {(stage ?? 0) >= 3 && onFeedback ? (
          <button
            type="button"
            className="btn-primary !py-1.5 !px-3 text-xs"
            onClick={onFeedback}
          >
            Leave feedback
          </button>
        ) : null}
      </div>
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

function quoteStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (['accepted', 'converted', 'won'].includes(s)) {
    return 'bg-emerald-50 text-emerald-800';
  }
  if (['rejected', 'expired', 'cancelled', 'lost'].includes(s)) {
    return 'bg-rose-50 text-rose-800';
  }
  if (['sent', 'issued', 'viewed', 'open'].includes(s)) {
    return 'bg-sky-50 text-sky-800';
  }
  return 'bg-neutral-100 text-neutral-600';
}

function QuotesPanel({
  quotes,
  hostName,
}: {
  quotes: PublicPortalPayload['quotes'];
  hostName: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const listed = quotes
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Quotations · {hostName}
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-900">
          Quotations on this account
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Every quotation {hostName} created on your CRM record — including
          drafts — shows here.
        </p>
      </section>
      {listed.length === 0 ? (
        <p className="rounded-[1.5rem] border border-white/70 bg-white/90 px-5 py-10 text-center text-sm text-neutral-500">
          No quotations on this account yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {listed.map((r) => {
            const open = openId === r.id;
            const lines = r.lines || [];
            return (
              <li
                key={`q-${r.id}`}
                className="rounded-[1.5rem] border border-white/70 bg-white/90 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full px-5 py-4 flex flex-wrap items-start justify-between gap-2 text-left"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-sm">
                      {r.number}
                      {r.title ? (
                        <span className="font-medium text-neutral-500">
                          {' '}
                          · {r.title}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {[
                        r.date,
                        r.due ? `valid until ${r.due}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${quoteStatusClass(r.status)}`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                    {r.amount != null ? (
                      <p className="text-sm font-black tabular-nums text-slate-900">
                        {formatMoney(r.amount, r.currency)}
                      </p>
                    ) : null}
                  </div>
                </button>
                {open ? (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-2">
                    {r.notes ? (
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                        {r.notes}
                      </p>
                    ) : null}
                    {lines.length ? (
                      <ul className="space-y-1 text-sm">
                        {lines.map((line, i) => (
                          <li
                            key={`${r.id}-line-${i}`}
                            className="flex justify-between gap-3"
                          >
                            <span className="text-slate-700">
                              {line.name}
                              {line.qty != null
                                ? ` · ${line.qty}${line.uom ? ` ${line.uom}` : ''}`
                                : ''}
                            </span>
                            {line.amount != null ? (
                              <span className="tabular-nums font-semibold">
                                {formatMoney(line.amount, r.currency)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        Line items were not attached to this quotation.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatementPanel({
  invoices,
  hostName,
}: {
  invoices: PublicPortalPayload['invoices'];
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
