'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
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

type AccountOpt = { id: number; name: string; email?: string | null; contact?: string | null };

const CUSTOMER_SECTIONS: Array<{ key: keyof PortalSections; label: string; hint: string }> = [
  { key: 'quotes', label: 'Quotes', hint: 'Open proposals' },
  { key: 'orders', label: 'Orders · our OTIFEF', hint: 'Their POs and our deliveries' },
  { key: 'invoices', label: 'Invoices', hint: 'What they owe' },
  { key: 'documents', label: 'Documents', hint: 'Certs and files' },
  { key: 'ratings', label: 'Ratings', hint: 'Same stars as the network' },
  { key: 'riad', label: 'RIAD', hint: 'Risks and comments' },
  { key: 'messages', label: 'Messages', hint: 'Direct thread' },
  { key: 'projects', label: 'Projects', hint: 'Joint waterfall Gantt' },
];

const SUPPLIER_SECTIONS: Array<{ key: keyof PortalSections; label: string; hint: string }> = [
  { key: 'purchase_orders', label: 'Purchase orders', hint: 'OTIFEF overall and per order' },
  { key: 'stock', label: 'Stock on hand', hint: 'They confirm availability' },
  { key: 'documents', label: 'Documents', hint: 'Specs, SLAs, certs' },
  { key: 'ratings', label: 'Ratings', hint: 'Same stars as the network' },
  { key: 'riad', label: 'RIAD', hint: 'Risks and comments' },
  { key: 'messages', label: 'Messages', hint: 'Direct thread' },
  { key: 'projects', label: 'Projects', hint: 'Joint waterfall Gantt' },
];

export function TradePortalDesk({ kind }: { kind: TradePortalKind }) {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const isCustomer = kind === 'customer';
  const noun = isCustomer ? 'customer' : 'supplier';

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
      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3" title="What they see">
          <div className="p-5 space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              Portals are for <strong>{noun}s already on your books</strong>. Each
              person is attached to an account so they only see their orders,
              OTIFEF, ratings, RIAD, and messages — the same records you use
              inside SupplierAdvisor.
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
              Brochure link shows who you are. Personal links show that person&apos;s
              documents only.
            </p>
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

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-2" title="Add a person">
          <div className="p-5 space-y-3">
            <p className="text-sm text-neutral-600">
              Required: a {noun} already on your books. Then name the person who
              should open the portal.
            </p>
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
            <div className="grid grid-cols-2 gap-2">
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
            <select
              className="input w-full !p-3 !text-sm"
              value={form.accountId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : '';
                const acc = accounts.find((a) => a.id === id);
                setForm((prev) => ({
                  ...prev,
                  accountId: id,
                  name: prev.name || acc?.contact || acc?.name || '',
                  email: prev.email || acc?.email || '',
                }));
              }}
            >
              <option value="">Select {noun} on your books…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={adding}
              onClick={() => void addPerson()}
              className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add & copy link
            </button>
          </div>
        </Panel>

        <Panel className="lg:col-span-3" title="People with access">
          <div className="divide-y divide-neutral-100">
            {viewers.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">
                No one yet. Add a buyer or supplier contact — they do not need an
                account.
              </p>
            ) : (
              viewers.map((v) => {
                const personUrl = `/portal/${encodeURIComponent(v.token)}`;
                const revoked = v.status === 'revoked';
                return (
                  <div
                    key={v.id}
                    className="px-5 py-3.5 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{v.name}</p>
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
                        {[v.job_title, v.email, v.phone].filter(Boolean).join(' · ') ||
                          'No contact yet'}
                      </p>
                      {v.last_seen_at ? (
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Opened {new Date(v.last_seen_at).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Not opened yet
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copy(`${window.location.origin}${personUrl}`, String(v.id))}
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
                  </div>
                );
              })
            )}
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
        <span>· Guest links never show another {noun}&apos;s documents.</span>
      </div>
    </div>
  );
}
