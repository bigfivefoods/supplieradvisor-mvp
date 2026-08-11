'use client';

/**
 * Platform Messages — core product inbox for every module.
 * Colleagues + connected suppliers / customers + mirrored care threads.
 * Deep-link: /dashboard/messages?from=<module>&channel=supplier|customer|colleague&peer=<id>&compose=1
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  Building2,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';
import { RelationshipHeader } from '@/components/relationship/RelationshipChrome';
import {
  channelLabel,
  previewText,
  threadTitleForCompany,
  unreadForViewer,
  type CompanyThread,
} from '@/lib/messaging/company-inbox';
import {
  resolveModuleMessageContext,
  threadMatchesFilter,
  type ComposeMode,
} from '@/lib/messaging/module-context';

type Directory = {
  colleagues: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
  }>;
  peers: Array<{
    id: number;
    name: string;
    connection_id?: string;
    relation: 'supplier' | 'customer' | 'peer';
  }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <BaseCompanyRequired>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </BaseCompanyRequired>
  );
}

export default function PlatformMessagesPage() {
  return (
    <Shell>
      <Suspense
        fallback={
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Shell>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const { user } = usePrivy();
  const platformUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId()!;
  const ctx = useMemo(
    () =>
      resolveModuleMessageContext(
        searchParams.get('from'),
        searchParams.get('channel')
      ),
    [searchParams]
  );
  const peerQuery = searchParams.get('peer') || '';
  const openCompose =
    searchParams.get('compose') === '1' ||
    searchParams.get('compose') === 'true' ||
    Boolean(peerQuery);

  const [companyName, setCompanyName] = useState('Company');
  const [threads, setThreads] = useState<CompanyThread[]>([]);
  const [directory, setDirectory] = useState<Directory>({
    colleagues: [],
    peers: [],
  });
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [showCompose, setShowCompose] = useState(openCompose);
  const [composeMode, setComposeMode] = useState<ComposeMode>(
    ctx.defaultCompose
  );
  const [channelFilter, setChannelFilter] = useState<
    'all' | 'colleague' | 'supplier' | 'customer' | 'trade'
  >(
    ctx.filterChannel === 'supplier' ||
      ctx.filterChannel === 'customer' ||
      ctx.filterChannel === 'colleague' ||
      ctx.filterChannel === 'trade'
      ? ctx.filterChannel
      : 'all'
  );
  const [peerId, setPeerId] = useState(peerQuery);
  const [colleagueId, setColleagueId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Sync deep-link when query changes
  useEffect(() => {
    setComposeMode(ctx.defaultCompose);
    if (
      ctx.filterChannel === 'supplier' ||
      ctx.filterChannel === 'customer' ||
      ctx.filterChannel === 'colleague' ||
      ctx.filterChannel === 'trade'
    ) {
      setChannelFilter(ctx.filterChannel);
    }
    if (openCompose) setShowCompose(true);
    if (peerQuery) setPeerId(peerQuery);
  }, [ctx, openCompose, peerQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/messaging/inbox?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setThreads(data.threads || []);
      setDirectory(data.directory || { colleagues: [], peers: [] });
      setSummary(data.summary || {});
      setCompanyName(data.companyName || 'Company');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/messaging/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          company_name: companyName,
          // Platform user id — delivery & unread are keyed system-wide
          author_kind: 'user',
          author_ref_id: platformUserId || undefined,
          author_name:
            user?.email?.address ||
            (user as { google?: { name?: string } } | null)?.google?.name ||
            companyName,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (Array.isArray(data.threads)) setThreads(data.threads);
      if (data.summary) setSummary(data.summary);
      return data;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const openThreads = useMemo(
    () =>
      [...threads]
        .filter((t) => !t.archived)
        .filter((t) => threadMatchesFilter(t.channel, channelFilter))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [threads, channelFilter]
  );

  const active =
    openThreads.find((t) => t.id === activeId) || openThreads[0] || null;

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  useEffect(() => {
    if (!active) return;
    void post({
      action: 'message_mark_read',
      thread_id: active.id,
    }).catch(() => {
      /* soft */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const peersForMode = useMemo(() => {
    if (composeMode === 'supplier')
      return directory.peers.filter((p) => p.relation === 'supplier');
    if (composeMode === 'customer')
      return directory.peers.filter((p) => p.relation === 'customer');
    if (composeMode === 'connection') return directory.peers;
    return [];
  }, [composeMode, directory.peers]);

  const startThread = async () => {
    if (!body.trim()) {
      toast.error('Write a message');
      return;
    }
    let channel: 'colleague' | 'supplier' | 'customer' | 'connection' =
      'colleague';
    const payload: Record<string, unknown> = {
      action: 'message_create_thread',
      body: body.trim(),
      subject: subject.trim() || undefined,
    };

    if (composeMode === 'colleague') {
      channel = 'colleague';
      if (colleagueId) {
        const c = directory.colleagues.find((x) => x.id === colleagueId);
        payload.with_user_id = colleagueId;
        payload.with_user_name = c?.name;
        payload.with_user_role = c?.role;
      }
    } else {
      if (!peerId) {
        toast.error('Pick a connected company');
        return;
      }
      const peer = directory.peers.find((p) => String(p.id) === peerId);
      if (!peer) {
        toast.error('Partner not found');
        return;
      }
      channel =
        composeMode === 'supplier'
          ? 'supplier'
          : composeMode === 'customer'
            ? 'customer'
            : peer.relation === 'supplier'
              ? 'supplier'
              : peer.relation === 'customer'
                ? 'customer'
                : 'connection';
      payload.peer_company_id = peer.id;
      payload.peer_company_name = peer.name;
      payload.connection_id = peer.connection_id;
      payload.peer_relation = peer.relation;
    }

    payload.channel = channel;
    try {
      const data = await post(payload);
      setShowCompose(false);
      setBody('');
      setSubject('');
      setPeerId('');
      setColleagueId('');
      if (data?.thread?.id) setActiveId(String(data.thread.id));
      toast.success('Conversation started');
    } catch {
      /* toasted */
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    try {
      await post({
        action: 'message_post',
        thread_id: active.id,
        body: reply.trim(),
      });
      setReply('');
      toast.success('Message sent');
    } catch {
      /* toasted */
    }
  };

  const archive = async (id: string) => {
    await post({ action: 'message_archive', thread_id: id, archive: true });
    toast.success('Conversation archived');
    setActiveId(null);
  };

  const viewer = platformUserId
    ? { kind: 'user' as const, ref_id: platformUserId }
    : { kind: 'desk' as const, ref_id: 'desk' };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={ctx.backHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 dark:text-sky-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {ctx.backLabel}
        </Link>
        {ctx.from !== 'network' ? (
          <Link
            href="/dashboard/messages?from=network"
            className="text-xs font-bold text-slate-500 hover:text-sky-700"
          >
            Full inbox
          </Link>
        ) : null}
      </div>
      <RelationshipHeader
        eyebrow={`Platform · ${ctx.label}`}
        title="Messages"
        titleAccent={ctx.titleAccent}
        description={`${ctx.description} Messages are delivered by your system user id across every company workspace you belong to.`}
        action={
          <button
            type="button"
            onClick={() => setShowCompose((v) => !v)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New conversation
          </button>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { label: 'Open (view)', value: openThreads.length },
              { label: 'Unread (all)', value: summary.unreadMessages ?? 0 },
              { label: 'Team', value: summary.colleagueThreads ?? 0 },
              {
                label: 'Trade / care',
                value:
                  (summary.tradeThreads ?? 0) + (summary.serviceThreads ?? 0),
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-700/50 dark:bg-sky-950/40"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-sky-800/80 dark:text-sky-200">
                  {s.label}
                </div>
                <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {showCompose ? (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/50 p-4 space-y-3 dark:border-sky-700/40 dark:bg-sky-950/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-200">
                Start conversation
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['colleague', 'Colleague'],
                    ['supplier', 'Supplier'],
                    ['customer', 'Customer'],
                    ['connection', 'Any connection'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setComposeMode(mode);
                      setPeerId('');
                      setColleagueId('');
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      composeMode === mode
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {composeMode === 'colleague' ? (
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={colleagueId}
                  onChange={(e) => setColleagueId(e.target.value)}
                >
                  <option value="">Whole team / general…</option>
                  {directory.colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.role ? ` · ${c.role}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={peerId}
                  onChange={(e) => setPeerId(e.target.value)}
                >
                  <option value="">
                    {peersForMode.length
                      ? 'Connected company…'
                      : 'No matching connections yet'}
                  </option>
                  {peersForMode.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} · {p.relation}
                    </option>
                  ))}
                </select>
              )}

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                placeholder="Subject (optional)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm min-h-[5rem] resize-y dark:border-slate-600 dark:bg-slate-900"
                placeholder="Write the first message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void startThread()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Start
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-slate-500"
                  onClick={() => setShowCompose(false)}
                >
                  Cancel
                </button>
              </div>
              {composeMode !== 'colleague' && !directory.peers.length ? (
                <p className="text-[11px] text-slate-500">
                  Connect a supplier or customer in{' '}
                  <Link
                    href="/dashboard/connections"
                    className="font-bold text-sky-700 dark:text-sky-300"
                  >
                    Network
                  </Link>{' '}
                  first, then message them here.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-neutral-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Inbox
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Available in every module · colleagues · suppliers ·
                    customers · care
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['colleague', 'Team'],
                    ['supplier', 'Suppliers'],
                    ['customer', 'Customers'],
                    ['trade', 'Trade / care'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChannelFilter(id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      channelFilter === id
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-[280px_1fr] min-h-[420px]">
              <div className="border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-neutral-800 max-h-[50vh] lg:max-h-[560px] overflow-y-auto">
                {openThreads.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No conversations yet. Message a colleague or a connected
                    trade partner.
                  </div>
                ) : (
                  openThreads.map((t) => {
                    const unread = unreadForViewer(t, viewer);
                    const on = active?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        className={`w-full text-left px-3 py-3 border-b border-slate-50 dark:border-neutral-800/80 hover:bg-slate-50 dark:hover:bg-neutral-900 ${
                          on ? 'bg-sky-50/80 dark:bg-sky-950/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate text-slate-900 dark:text-white">
                              {threadTitleForCompany(t, companyId)}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {channelLabel(t.channel)}
                              {t.peer_company_name
                                ? ` · ${t.peer_company_name}`
                                : ''}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {previewText(t, 60)}
                            </p>
                          </div>
                          {unread > 0 ? (
                            <span className="shrink-0 rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5">
                              {unread}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col min-h-[320px]">
                {!active ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6">
                    Select a conversation
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                      <div className="min-w-0">
                        <div className="text-sm font-black truncate text-slate-900 dark:text-white">
                          {threadTitleForCompany(active, companyId)}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          {active.channel === 'colleague' ? (
                            <Users className="w-3 h-3" />
                          ) : (
                            <Building2 className="w-3 h-3" />
                          )}
                          {active.participants.map((p) => p.name).join(' · ')} ·{' '}
                          {channelLabel(active.channel)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600"
                        onClick={() => void archive(active.id)}
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[360px]">
                      {active.messages.map((m) => {
                        const mine =
                          m.author.company_id === companyId &&
                          (m.author.kind === 'desk' ||
                            m.author.kind === 'user');
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                mine
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              <div
                                className={`text-[10px] font-bold mb-0.5 ${
                                  mine ? 'opacity-80' : 'text-slate-500'
                                }`}
                              >
                                {m.author.name}
                                {m.author.role_label
                                  ? ` · ${m.author.role_label}`
                                  : ''}{' '}
                                ·{' '}
                                {new Date(m.created_at).toLocaleString(
                                  undefined,
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </div>
                              <div className="whitespace-pre-wrap leading-relaxed">
                                {m.body}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-100 dark:border-neutral-800 p-3">
                      <div className="flex gap-2">
                        <textarea
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[2.75rem] max-h-28 resize-y"
                          placeholder="Write a reply…"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void sendReply();
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={saving || !reply.trim()}
                          onClick={() => void sendReply()}
                          className="shrink-0 self-end rounded-xl bg-sky-600 px-3 py-2 text-white disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
