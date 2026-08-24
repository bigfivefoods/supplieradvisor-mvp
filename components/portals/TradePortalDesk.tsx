'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Globe,
  Loader2,
  Mail,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { Panel } from '@/components/relationship/RelationshipChrome';
import {
  DEFAULT_PORTAL_SECTIONS,
  type PortalSections,
  type TradePortalKind,
  type TradePortalRow,
  type TradePortalViewer,
} from '@/lib/portals/trade-portal';
import {
  firstPortalInvite,
  latestPortalLogin,
  portalTimeAgo,
  portalWhen,
} from '@/lib/portals/portal-activity';

type AccountOpt = { id: number; name: string; email?: string | null; contact?: string | null };

const CUSTOMER_SECTIONS: Array<{ key: keyof PortalSections; label: string; hint: string }> = [
  { key: 'quotes', label: 'Quotations', hint: 'Quotes created on this CRM account' },
  { key: 'orders', label: 'Sales orders', hint: 'SO list and status' },
  { key: 'invoices', label: 'Statement', hint: 'Invoices and open balance' },
  { key: 'projects', label: 'Projects', hint: 'Joint waterfall — both sides edit tasks' },
  { key: 'documents', label: 'Documents', hint: 'Certs and files' },
  { key: 'messages', label: 'Messages', hint: 'Direct thread' },
  { key: 'riad', label: 'RIAD', hint: 'Risks and comments' },
  { key: 'ratings', label: 'Ratings', hint: 'Same stars as the network' },
];

const SUPPLIER_SECTIONS: Array<{ key: keyof PortalSections; label: string; hint: string }> = [
  { key: 'purchase_orders', label: 'Purchase orders', hint: 'POs they receive and update' },
  { key: 'stock', label: 'Stock on hand', hint: 'They confirm availability' },
  { key: 'projects', label: 'Projects', hint: 'Joint waterfall Gantt' },
  { key: 'documents', label: 'Documents', hint: 'Specs, SLAs, certs' },
  { key: 'messages', label: 'Messages', hint: 'Direct thread' },
  { key: 'riad', label: 'RIAD', hint: 'Risks and comments' },
  { key: 'ratings', label: 'Ratings', hint: 'Same stars as the network' },
];

export function TradePortalDesk({ kind }: { kind: TradePortalKind }) {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const isCustomer = kind === 'customer';
  const noun = isCustomer ? 'customer' : 'supplier';
  const book = isCustomer ? 'CRM' : 'SRM';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [portal, setPortal] = useState<TradePortalRow | null>(null);
  const [url, setUrl] = useState('');
  const [viewers, setViewers] = useState<TradePortalViewer[]>([]);
  const [title, setTitle] = useState('');
  const [welcome, setWelcome] = useState('');
  const [sections, setSections] = useState<PortalSections>({
    ...DEFAULT_PORTAL_SECTIONS,
  });

  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    job_title: '',
    accountId: '' as number | '',
  });
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountQ, setAccountQ] = useState('');
  const [issuingId, setIssuingId] = useState<number | null>(null);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  const accountName = (v: TradePortalViewer) => {
    const id = isCustomer ? v.customer_id : v.supplier_id;
    if (!id) return null;
    const hit = accounts.find((a) => a.id === id);
    return hit?.name || `${noun} #${id}`;
  };

  /** Group viewers by linked customer/supplier so you can open each account's portal view */
  const portalGroups = (() => {
    const map = new Map<
      string,
      {
        key: string;
        accountId: number | null;
        label: string;
        viewers: TradePortalViewer[];
        activeCount: number;
      }
    >();
    for (const v of viewers) {
      const id = isCustomer ? v.customer_id : v.supplier_id;
      const key = id != null ? `a-${id}` : `p-${v.id}`;
      const label =
        id != null
          ? accounts.find((a) => a.id === id)?.name || `${noun} #${id}`
          : v.name || 'Unlinked person';
      const g = map.get(key) || {
        key,
        accountId: id,
        label,
        viewers: [] as TradePortalViewer[],
        activeCount: 0,
      };
      g.viewers.push(v);
      if (v.status === 'active') g.activeCount += 1;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  })();

  const qs = () => {
    const p = new URLSearchParams({
      companyId: String(companyId),
      kind,
    });
    if (privyUserId) p.set('privyUserId', privyUserId);
    return p.toString();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portals/trade?${qs()}`);
      const data = await res.json();
      if (!res.ok) {
        setHint(data.hint || data.error || 'Could not load portal');
        setPortal(null);
        return;
      }
      setHint(null);
      setPortal(data.portal);
      setUrl(data.url || '');
      setViewers(data.viewers || []);
      setTitle(data.portal?.title || '');
      setWelcome(data.portal?.welcome_message || '');
      setSections({
        ...DEFAULT_PORTAL_SECTIONS,
        ...(data.portal?.sections || {}),
      });
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, kind, privyUserId]);

  const loadAccounts = useCallback(async () => {
    try {
      const path = isCustomer
        ? `/api/customers?companyId=${companyId}`
        : `/api/suppliers?companyId=${companyId}`;
      const res = await fetch(path);
      const data = await res.json();
      const rows = (isCustomer ? data.customers : data.suppliers) || [];
      setAccounts(
        rows.slice(0, 400).map(
          (r: {
            id: number;
            trading_name?: string;
            email?: string | null;
            contact_name?: string | null;
          }) => ({
            id: Number(r.id),
            name: String(r.trading_name || `#${r.id}`),
            email: r.email || null,
            contact: r.contact_name || null,
          })
        )
      );
    } catch {
      setAccounts([]);
    }
  }, [companyId, isCustomer]);

  useEffect(() => {
    void load();
    void loadAccounts();
  }, [load, loadAccounts]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success('Link copied');
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error('Could not copy');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/portals/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind,
          title,
          welcome_message: welcome,
          sections,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Portal saved');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    if (!portal) return;
    setSaving(true);
    try {
      const next = portal.status === 'paused' ? 'active' : 'paused';
      const res = await fetch('/api/portals/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind,
          status: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(next === 'paused' ? 'Portal paused' : 'Portal live');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const issueAccount = async (accountId: number) => {
    setIssuingId(accountId);
    try {
      const res = await fetch('/api/portals/trade/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind,
          action: 'issue_account',
          customer_id: isCustomer ? accountId : undefined,
          supplier_id: !isCustomer ? accountId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not issue portal');
      if (data.url) {
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {
          /* ignore */
        }
      }
      toast.success(
        data.existing
          ? 'Portal already live — link copied'
          : data.emailSent
            ? 'Portal issued — email sent, link copied'
            : 'Portal issued — link copied'
      );
      if (data.warning) toast.message(data.warning);
      setForm((prev) => ({ ...prev, accountId }));
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIssuingId(null);
    }
  };

  const addPerson = async () => {
    if (!form.accountId) {
      toast.error(`Pick a ${noun} on your books`);
      return;
    }
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/portals/trade/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          kind,
          name: form.name,
          email: form.email,
          phone: form.phone,
          job_title: form.job_title,
          customer_id: isCustomer ? form.accountId : undefined,
          supplier_id: !isCustomer ? form.accountId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add person');
      if (data.url) {
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {
          /* ignore */
        }
      }
      toast.success(
        data.emailSent
          ? 'Person added — email sent, link copied'
          : 'Person added — link copied'
      );
      if (data.warning) toast.message(data.warning);
      setForm({ name: '', email: '', phone: '', job_title: '', accountId: '' });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAdding(false);
    }
  };

  const actViewer = async (
    id: number,
    action: 'revoke' | 'restore' | 'resend'
  ) => {
    try {
      const res = await fetch('/api/portals/trade/viewers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, kind, id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (action === 'resend' && data.url) {
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {
          /* ignore */
        }
      }
      toast.success(
        action === 'revoke'
          ? 'Access revoked'
          : action === 'restore'
            ? 'Access restored'
            : data.emailSent
              ? 'Email resent'
              : 'Link copied'
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const sectionList = isCustomer ? CUSTOMER_SECTIONS : SUPPLIER_SECTIONS;
  const live = portal?.status !== 'paused';

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (hint && !portal) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-950 max-w-xl">
        <p className="font-bold mb-1">Portal tables are not on this database yet</p>
        <p className="leading-relaxed">{hint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title={isCustomer ? 'Customer portals' : 'Supplier portals'}
      >
          <div className="divide-y divide-neutral-100">
            {portalGroups.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">
                No {noun} portals yet. Issue one below from a {book} profile —
                they do not need an account.
              </p>
            ) : (
              portalGroups.map((g) => {
                const primary =
                  g.viewers.find((v) => v.status === 'active') || g.viewers[0];
                const personUrl = primary
                  ? `/portal/${encodeURIComponent(primary.token)}`
                  : '';
                const expanded = openGroupKey === g.key;
                const last = latestPortalLogin(g.viewers);
                const invited = firstPortalInvite(g.viewers);
                return (
                  <div key={g.key} className="px-5 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenGroupKey(expanded ? null : g.key);
                          if (!expanded && g.accountId) {
                            const a = accounts.find((x) => x.id === g.accountId);
                            setForm((prev) => ({
                              ...prev,
                              accountId: g.accountId as number,
                              name: prev.name || a?.contact || a?.name || prev.name,
                              email: prev.email || a?.email || prev.email,
                            }));
                          }
                        }}
                        className="min-w-0 flex-1 text-left flex items-start gap-2"
                      >
                        <span className="mt-1 shrink-0 text-neutral-400">
                          {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-black text-slate-900 text-base">
                            {g.label}
                          </span>
                          <span className="block text-xs text-neutral-500 mt-0.5">
                            {g.activeCount} active access
                            {g.activeCount === 1 ? '' : 'es'} ·{' '}
                            {g.viewers.length} person
                            {g.viewers.length === 1 ? '' : 's'}
                            {expanded ? '' : ' · open to manage people'}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="w-3 h-3 text-neutral-400" />
                              {last
                                ? `Last login ${portalTimeAgo(last.at)}${
                                    last.name ? ` · ${last.name}` : ''
                                  }`
                                : 'Never logged in'}
                            </span>
                            {invited ? (
                              <span>Invited {portalTimeAgo(invited)}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      {primary && primary.status === 'active' && personUrl ? (
                        <div className="flex flex-wrap gap-1.5">
                          <a
                            href={personUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                            title="Opens this account’s portal as you — your company credentials"
                          >
                            <Eye className="w-3.5 h-3.5" /> View portal
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              void copy(
                                `${window.location.origin}${personUrl}`,
                                `g-${g.key}`
                              )
                            }
                            className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                          >
                            {copied === `g-${g.key}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            Copy link
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {expanded ? (
                    <ul className="space-y-2 mt-3">
                      {g.viewers.map((v) => {
                        const vUrl = `/portal/${encodeURIComponent(v.token)}`;
                        const revoked = v.status === 'revoked';
                        return (
                          <li
                            key={v.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 flex flex-wrap items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900">
                                  {v.name}
                                </p>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                                    revoked
                                      ? 'bg-neutral-100 text-neutral-500'
                                      : 'bg-emerald-50 text-emerald-800'
                                  }`}
                                >
                                  {revoked ? 'Revoked' : 'Active'}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {[v.job_title, v.email, v.phone]
                                  .filter(Boolean)
                                  .join(' · ') || 'No contact yet'}
                              </p>
                              <p className="text-[11px] text-neutral-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="w-3 h-3 text-neutral-400" />
                                  {v.last_seen_at
                                    ? `Last login ${portalTimeAgo(v.last_seen_at)}${
                                        portalWhen(v.last_seen_at)
                                          ? ` · ${portalWhen(v.last_seen_at)}`
                                          : ''
                                      }`
                                    : 'Never logged in'}
                                </span>
                                {v.invited_at ? (
                                  <span>
                                    Invited {portalTimeAgo(v.invited_at)}
                                    {portalWhen(v.invited_at)
                                      ? ` · ${portalWhen(v.invited_at)}`
                                      : ''}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {!revoked ? (
                                <a
                                  href={vUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                                  title="Open as you (host)"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  void copy(
                                    `${window.location.origin}${vUrl}`,
                                    String(v.id)
                                  )
                                }
                                className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                              >
                                {copied === String(v.id) ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                Copy
                              </button>
                              {v.email ? (
                                <button
                                  type="button"
                                  onClick={() => void actViewer(v.id, 'resend')}
                                  className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                                >
                                  <Mail className="w-3.5 h-3.5" /> Email
                                </button>
                              ) : null}
                              {revoked ? (
                                <button
                                  type="button"
                                  onClick={() => void actViewer(v.id, 'restore')}
                                  className="btn-secondary !py-1.5 !px-2.5 text-xs"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void actViewer(v.id, 'revoke')}
                                  className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1 text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Revoke
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </Panel>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-2" title={`Issue a ${noun} portal`}>
          <div className="p-5 space-y-3">
            <p className="text-sm text-neutral-600">
              Create a portal for a {book} profile that does not have one yet.
              The primary contact gets the first link; they can add more people
              from inside the portal.
            </p>
            <input
              className="input w-full !p-3 !text-sm"
              placeholder={`Search ${noun}s…`}
              value={accountQ}
              onChange={(e) => setAccountQ(e.target.value)}
            />
            <div className="max-h-[22rem] overflow-y-auto space-y-2 pr-0.5">
              {accounts
                .filter((a) => {
                  const q = accountQ.trim().toLowerCase();
                  if (!q) return true;
                  return `${a.name} ${a.contact || ''} ${a.email || ''}`
                    .toLowerCase()
                    .includes(q);
                })
                .slice(0, 80)
                .map((a) => {
                  const allForAccount = viewers.filter(
                    (v) =>
                      (isCustomer ? v.customer_id : v.supplier_id) === a.id
                  );
                  const people = allForAccount.filter(
                    (v) => v.status === 'active'
                  );
                  const selected = form.accountId === a.id;
                  const last = latestPortalLogin(allForAccount);
                  const invited = firstPortalInvite(allForAccount);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          accountId: a.id,
                          name: prev.name || a.contact || a.name,
                          email: prev.email || a.email || '',
                        }));
                        setOpenGroupKey(`a-${a.id}`);
                      }}
                      className={`w-full text-left rounded-2xl border px-3 py-3 ${
                        selected
                          ? 'border-cyan-300 bg-cyan-50'
                          : 'border-neutral-200 bg-white hover:border-cyan-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {a.name}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {a.contact || a.email || 'No contact yet'}
                          </p>
                          {people.length ? (
                            <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                              {last
                                ? `Last login ${portalTimeAgo(last.at)}`
                                : 'Never logged in'}
                              {invited
                                ? ` · Invited ${portalTimeAgo(invited)}`
                                : ''}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[#0077b6]">
                          {people.length
                            ? `${people.length} on portal`
                            : 'No portal'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              {accounts.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Add {noun}s in {book} first, then issue their portal here.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!form.accountId || issuingId != null}
              onClick={() =>
                form.accountId && void issueAccount(Number(form.accountId))
              }
              className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {issuingId != null ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {viewers.some(
                (v) =>
                  (isCustomer ? v.customer_id : v.supplier_id) ===
                    form.accountId && v.status === 'active'
              )
                ? `Copy this ${noun} portal`
                : `Issue ${noun} portal`}
            </button>
          </div>
        </Panel>

        <Panel className="lg:col-span-3" title="People on this portal">
          <div className="p-5 border-b border-neutral-100 space-y-3">
            <p className="text-sm text-neutral-600">
              {form.accountId
                ? `Add another person on ${
                    accounts.find((a) => a.id === form.accountId)?.name ||
                    `this ${noun}`
                  }. They get their own link to the same books.`
                : `Select a ${noun} on the left, then add people.`}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Email (sends the link)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                className="input w-full !p-3 !text-sm"
                placeholder="Role"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
            </div>
            <button
              type="button"
              disabled={adding || !form.accountId}
              onClick={() => void addPerson()}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add person
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3" title="What they see">
          <div className="p-5 space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              Pick a {noun} already on your {book}, then issue their portal. That
              account sees only their quotes, orders, OTIFEF, ratings and RIAD.
              Inside the portal they can add colleagues. Issued portals are
              listed first — click <strong>View portal</strong> to work in it as
              you (your company credentials). Their own link still uses their
              access.
            </p>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Portal title
              </label>
              <input
                className="input mt-1 w-full !p-3 !text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isCustomer ? 'Customer portal' : 'Supplier portal'}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                Welcome note
              </label>
              <textarea
                className="input mt-1 w-full !p-3 !text-sm min-h-[96px]"
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                placeholder={`A short note they see first — why you work with them, how to reach you.`}
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-2">
                Sections
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {sectionList.map((s) => (
                  <label
                    key={s.key}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 cursor-pointer ${
                      sections[s.key] !== false
                        ? 'border-cyan-200 bg-cyan-50/60'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={sections[s.key] !== false}
                      onChange={(e) =>
                        setSections((prev) => ({
                          ...prev,
                          [s.key]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {s.label}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {s.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
              <strong className="text-slate-800">Projects:</strong> enable the
              section, then open{' '}
              <a
                href="/dashboard/projects/portfolio"
                className="font-semibold text-[#0077b6] underline-offset-2 hover:underline"
              >
                Projects → Portfolio
              </a>{' '}
              and set <em>Customer portal</em> to the account (e.g. Boxer). Guest
              portal shows separate tabs for Sales orders, OTIFEF metrics,
              Statement and Projects.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="btn-primary !py-2.5 !px-5 text-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save portal'
                )}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void togglePause()}
                className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
              >
                {live ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Go live
                  </>
                )}
              </button>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Share">
          <div className="p-5 space-y-4">
            <div
              className={`rounded-2xl border px-3 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 ${
                live
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {live ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              {live ? 'Live' : 'Paused'} · {viewers.filter((v) => v.status === 'active').length} people
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Each {book} {noun} gets a <strong>personal portal</strong> tied to
              their profile. Send those personal links — they open that
              account&apos;s live books. The brochure below is only your company
              card, not their books.
            </p>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5 text-xs text-slate-700">
              <p className="font-bold text-slate-900 mb-1">What's in this portal</p>
              <ul className="space-y-0.5">
                {sectionList
                  .filter((s) => sections[s.key] !== false)
                  .map((s) => (
                    <li key={s.key}>
                      · {s.label} — {s.hint}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Company brochure
              </p>
              <p className="text-xs break-all text-slate-700">{url}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copy(url, 'company')}
                  className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                >
                  {copied === 'company' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy
                </button>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview
                  </a>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Join CTA on the portal points to login — the fastest path from a
              guest to a full SupplierAdvisor workspace.
            </p>
          </div>
        </Panel>
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Globe className="w-3.5 h-3.5 text-[#00b4d8]" />
        <button
          type="button"
          onClick={() => void load()}
          className="underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
        <span>· Guest links never show another {noun}'s documents.</span>
      </div>
    </div>
  );
}
