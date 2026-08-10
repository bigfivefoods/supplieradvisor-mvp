'use client';

import { useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';

export type PortalThread = {
  id: string;
  title?: string;
  subject?: string;
  preview?: string;
  updated_at?: string;
  unread?: number;
  messages?: Array<{
    id: string;
    body: string;
    author_role: string;
    author_name: string;
    created_at: string;
  }>;
};

type Props = {
  threads: PortalThread[];
  messagesUnread?: number;
  /** member | patient — used to style "mine" bubbles */
  selfRole?: 'member' | 'patient';
  accentClass?: string;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
  emptyHint?: string;
};

export function PortalMessagesPanel({
  threads,
  messagesUnread = 0,
  selfRole = 'patient',
  accentClass = 'border-sky-200',
  post,
  onRefresh,
  emptyHint = 'When your care team messages you, it will show here — and by email if your profile has an address.',
}: Props) {
  const [threadId, setThreadId] = useState<string | null>(
    threads[0]?.id || null
  );
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const thr =
    threads.find((t) => t.id === threadId) || threads[0] || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          Messages
          {messagesUnread > 0 ? (
            <span className="ml-2 text-[10px] font-black uppercase text-amber-700">
              {messagesUnread} new
            </span>
          ) : null}
        </h2>
      </div>
      {threads.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed ${accentClass} bg-white dark:bg-slate-950 p-8 text-center text-sm text-slate-500`}
        >
          {emptyHint}
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setThreadId(t.id);
                    void post({
                      action: 'message_mark_read',
                      thread_id: t.id,
                    }).then(() => onRefresh());
                  }}
                  className={`w-full text-left rounded-2xl border px-3 py-3 ${
                    thr?.id === t.id
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/40'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'
                  }`}
                >
                  <p className="text-sm font-black truncate">
                    {t.title || t.subject || 'Conversation'}
                    {(t.unread || 0) > 0 ? (
                      <span className="ml-2 text-[10px] text-amber-700 font-black uppercase">
                        {t.unread} new
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {t.preview || '—'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {thr ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 space-y-3">
              <p className="text-xs font-bold text-slate-500">
                {thr.title || thr.subject || 'Conversation'}
              </p>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {(thr.messages || []).map((m) => {
                  const mine = m.author_role === selfRole;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-sm ${
                        mine
                          ? 'bg-sky-100 text-sky-950 ml-6 dark:bg-sky-900/40 dark:text-sky-50'
                          : 'bg-slate-100 text-slate-900 mr-6 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">
                        {m.author_name}
                        {' · '}
                        {m.created_at?.slice(0, 16).replace('T', ' ')}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm bg-transparent"
                  placeholder="Reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => {
                    setBusy(true);
                    void post({
                      action: 'message_post',
                      thread_id: thr.id,
                      body: reply.trim(),
                    })
                      .then(() => {
                        setReply('');
                        onRefresh();
                      })
                      .finally(() => setBusy(false));
                  }}
                  className="rounded-xl bg-sky-600 text-white px-3 py-2 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
