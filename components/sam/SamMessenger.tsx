'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  X,
  BookOpen,
  Minimize2,
  History,
  ChevronLeft,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

type ChatRole = 'user' | 'assistant';
type ChatMsg = { id: string; role: ChatRole; content: string };

type HistoryRow = {
  id: number;
  user_message: string;
  assistant_message?: string | null;
  error?: string | null;
  pathname?: string | null;
  created_at: string;
  model?: string | null;
};

const DEFAULT_SUGGESTIONS = [
  'How do I close my first trade loop in 30 minutes?',
  'How do I invite a supplier to my network?',
  'Explain quotes → orders → invoices → mark paid → rate',
  'How does buyer “I paid” and seller confirm work?',
  'Where do I set company billing and prepaid terms?',
  'How do I receive stock into inventory?',
  'Where is the 3-day golden path and trust ratings?',
];

/** Context chips based on current dashboard route */
function suggestionsForPath(pathname: string | null): string[] {
  const p = pathname || '';
  if (p.includes('/suppliers/po')) {
    return [
      'How do I raise a PO from a supplier catalogue?',
      'What is OTIFEF and how do I record delivery?',
      'Where does the supplier accept my PO?',
      'How do I rate a supplier after a completed PO?',
    ];
  }
  if (p.includes('/customers/orders')) {
    return [
      'How do I accept an inbound purchase order?',
      'What should I do after I accept a PO?',
      'How do buyers pick products from my inventory?',
      'Where do I publish finished goods for the network?',
    ];
  }
  if (p.includes('/customers/quotes') || p.includes('/customers/invoices')) {
    return [
      'How do I send an invoice and close the first-trade loop?',
      'Explain quotes → orders → invoices → mark paid → rate',
      'How do multi-currency product prices work on lines?',
      'How do buyer payment claims appear on AR?',
    ];
  }
  if (p.includes('/customers/ar') || p.includes('/buyer/documents')) {
    return [
      'How does the buyer “I paid” claim work?',
      'Where do I confirm a payment claim into the AR ledger?',
      'How do installments and partial payments work?',
      'How do multi-currency aging and base currency totals work?',
    ];
  }
  if (p.includes('/inventory/products')) {
    return [
      'How do I mark products as sellable finished goods?',
      'How do connected buyers see my catalogue on a PO?',
      'Where do pricing agreements fit with inventory?',
    ];
  }
  if (p.includes('/suppliers') || p.includes('/connections')) {
    return [
      'How do I invite a supplier to my network?',
      'How do pricing agreements feed purchase orders?',
      'Where is the 3-day golden path and trust ratings?',
    ];
  }
  return DEFAULT_SUGGESTIONS;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Minimal markdown-ish rendering for SAM replies */
function SamMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isList = lines.every(
          (l) =>
            !l.trim() ||
            /^[-*•]\s/.test(l.trim()) ||
            /^\d+\.\s/.test(l.trim())
        );
        if (isList && lines.some((l) => l.trim())) {
          return (
            <ul key={i} className="list-disc pl-4 space-y-1">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j}>
                    {formatInline(l.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, ''))}
                  </li>
                ))}
            </ul>
          );
        }
        if (/^#{1,3}\s/.test(block.trim())) {
          return (
            <p key={i} className="font-bold text-slate-900">
              {formatInline(block.replace(/^#{1,3}\s+/, ''))}
            </p>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {formatInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(s: string): React.ReactNode {
  // **bold** and `code` and /paths
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\/dashboard\/[^\s)]+|\/sales\/[^\s)]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1 py-0.5 text-[12px] font-mono text-sky-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('/dashboard') || part.startsWith('/sales')) {
      return (
        <a
          key={i}
          href={part.replace(/[.,;:]+$/, '')}
          className="font-semibold text-[#0077b6] hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * SAM — Supplier Advisor Messenger
 * Floating Grok-powered help for the SupplierAdvisor OS.
 */
export default function SamMessenger() {
  const pathname = usePathname();
  const { user, authenticated, ready } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi — I'm **SAM** (Supplier Advisor Messenger), your Grok-powered guide to SupplierAdvisor.\n\nAsk me how to run a process, where a screen lives, or how to improve your workflow. Try a suggestion below or type your own question.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetch('/api/sam/chat')
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, sending]);

  const loadHistory = useCallback(async () => {
    if (!ready || !authenticated) {
      setHistoryError('Sign in to view SAM history.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const companyId = getSelectedCompanyId();
      const qs = new URLSearchParams({ limit: '25' });
      if (companyId) qs.set('companyId', String(companyId));
      const res = await fetch(`/api/sam/history?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || `History error ${res.status}`
        );
      }
      setHistory(
        Array.isArray((data as { conversations?: HistoryRow[] }).conversations)
          ? ((data as { conversations: HistoryRow[] }).conversations)
          : []
      );
      if ((data as { warning?: string }).warning) {
        setHistoryError(String((data as { warning: string }).warning));
      }
    } catch (e: unknown) {
      setHistoryError(
        e instanceof Error ? e.message : 'Could not load history'
      );
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [authenticated, ready]);

  useEffect(() => {
    if (open && view === 'history') {
      void loadHistory();
    }
  }, [open, view, loadHistory]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      if (!ready || !authenticated || !privyUserId) {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: 'assistant',
            content: 'Please sign in to chat with SAM.',
          },
        ]);
        return;
      }

      const userMsg: ChatMsg = { id: uid(), role: 'user', content };
      const assistantId = uid();
      setMessages((m) => [
        ...m,
        userMsg,
        { id: assistantId, role: 'assistant', content: '' },
      ]);
      setInput('');
      setSending(true);

      try {
        const history = [...messages, userMsg]
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, content: m.content }));

        const companyId = getSelectedCompanyId();
        // Prefer Responses API (non-stream) — official xAI path
        const res = await fetch('/api/sam/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            privyUserId,
            companyId: companyId || undefined,
            pathname,
            stream: false,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data as { error?: string }).error || `SAM error ${res.status}`
          );
        }

        const reply =
          (data as { message?: { content?: string } }).message?.content ||
          (data as { error?: string }).error ||
          'No response — please try again.';
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: reply } : msg
          )
        );
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Could not reach SAM right now.';
        setMessages((m) =>
          m.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content: `Sorry — ${msg}`,
                }
              : item
          )
        );
      } finally {
        setSending(false);
      }
    },
    [authenticated, messages, pathname, privyUserId, ready, sending]
  );

  // Hide on pure marketing pages if ever mounted globally
  if (
    pathname === '/' ||
    pathname?.startsWith('/pricing') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/privacy') ||
    pathname?.startsWith('/terms')
  ) {
    return null;
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[90] group flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] pl-3 pr-4 py-3 text-white shadow-2xl shadow-sky-300/40 hover:scale-[1.03] active:scale-[0.98] transition"
          aria-label="Open SAM — Supplier Advisor Messenger"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 border border-white" />
            </span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-90">
              Ask SAM
            </span>
            <span className="block text-sm font-black">Grok assistant</span>
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-[90] flex h-[min(92dvh,640px)] w-full sm:w-[400px] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-label="SAM chat"
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-white shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  SAM
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
                    Grok
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  Supplier Advisor Messenger · system how-to
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {view === 'history' ? (
                <button
                  type="button"
                  onClick={() => setView('chat')}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                  title="Back to chat"
                  aria-label="Back to chat"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView('history')}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                  title="Conversation history"
                  aria-label="Conversation history"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <a
                href="/dashboard/guide"
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                title="Open system guide"
              >
                <BookOpen className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setView('chat');
                }}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Minimize SAM"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setView('chat');
                }}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Close SAM"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {configured === false && view === 'chat' && (
            <div className="px-4 py-2 text-[11px] bg-amber-50 text-amber-900 border-b border-amber-100">
              SAM needs <code className="font-mono">XAI_API_KEY</code> on the
              server (console.x.ai) to talk to Grok.
            </div>
          )}

          {view === 'history' ? (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#f8fafc]">
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Recent company chats
                </p>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="text-[11px] font-semibold text-sky-700 hover:underline"
                >
                  Refresh
                </button>
              </div>
              {historyLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading history…
                </div>
              )}
              {historyError && !historyLoading && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {historyError}
                </p>
              )}
              {!historyLoading && history.length === 0 && !historyError && (
                <p className="text-sm text-slate-500 text-center py-8">
                  No logged conversations yet. Ask SAM something and it will
                  appear here.
                </p>
              )}
              {history.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    const next: ChatMsg[] = [
                      {
                        id: 'welcome',
                        role: 'assistant',
                        content:
                          "Restored from history. Ask a follow-up or continue chatting.",
                      },
                      {
                        id: `h-u-${row.id}`,
                        role: 'user',
                        content: row.user_message || '',
                      },
                    ];
                    if (row.assistant_message) {
                      next.push({
                        id: `h-a-${row.id}`,
                        role: 'assistant',
                        content: row.assistant_message,
                      });
                    } else if (row.error) {
                      next.push({
                        id: `h-e-${row.id}`,
                        role: 'assistant',
                        content: `Previous error: ${row.error}`,
                      });
                    }
                    setMessages(next);
                    setView('chat');
                  }}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white px-3 py-2.5 hover:border-sky-200 hover:bg-sky-50/40 transition shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : ''}
                    </span>
                    {row.pathname && (
                      <span className="text-[10px] font-mono text-sky-700 truncate max-w-[50%]">
                        {row.pathname}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {row.user_message}
                  </p>
                  {row.assistant_message && (
                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">
                      {row.assistant_message}
                    </p>
                  )}
                  {row.error && (
                    <p className="text-[11px] text-rose-600 mt-1 truncate">
                      {row.error}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#f8fafc]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        m.content ? (
                          <SamMarkdown text={m.content} />
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            SAM is thinking…
                          </span>
                        )
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {messages.length <= 2 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-slate-50 bg-white pt-2">
                  {suggestionsForPath(pathname).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={sending}
                      onClick={() => void send(s)}
                      className="text-[11px] font-semibold rounded-full border border-sky-100 bg-sky-50/80 text-sky-900 px-2.5 py-1 hover:bg-sky-100 disabled:opacity-50 text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="border-t border-slate-100 bg-white p-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  disabled={sending}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder="Ask SAM anything about SupplierAdvisor…"
                  className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/30 focus:border-[#00b4d8] max-h-28"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-white disabled:opacity-40 shadow-md"
                  aria-label="Send"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
