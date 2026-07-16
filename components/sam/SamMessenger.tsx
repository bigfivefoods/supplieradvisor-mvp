'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
  BookOpen,
  Minimize2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

type ChatRole = 'user' | 'assistant';
type ChatMsg = { id: string; role: ChatRole; content: string };

const SUGGESTIONS = [
  'How do I invite a supplier to my network?',
  'Explain quotes → orders → invoices',
  'How does sales contractor commission work?',
  'Where do I set company billing and prepaid terms?',
  'How do I receive stock into inventory?',
];

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
        const res = await fetch('/api/sam/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            privyUserId,
            companyId: companyId || undefined,
            pathname,
            stream: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || `SAM error ${res.status}`
          );
        }

        const ctype = res.headers.get('content-type') || '';
        if (ctype.includes('text/event-stream') && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let full = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() || '';
            for (const line of parts) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = json.choices?.[0]?.delta?.content || '';
                if (delta) {
                  full += delta;
                  const snapshot = full;
                  setMessages((m) =>
                    m.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: snapshot }
                        : msg
                    )
                  );
                }
              } catch {
                /* ignore partial JSON */
              }
            }
          }
          if (!full.trim()) {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content:
                        'I did not get a reply from Grok. Please try again in a moment.',
                    }
                  : msg
              )
            );
          }
        } else {
          const data = await res.json();
          const reply =
            data.message?.content ||
            data.error ||
            'No response — please try again.';
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, content: reply } : msg
            )
          );
        }
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
              <a
                href="/dashboard/guide"
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                title="Open system guide"
              >
                <BookOpen className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Minimize SAM"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Close SAM"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {configured === false && (
            <div className="px-4 py-2 text-[11px] bg-amber-50 text-amber-900 border-b border-amber-100">
              SAM needs <code className="font-mono">XAI_API_KEY</code> on the
              server (console.x.ai) to talk to Grok.
            </div>
          )}

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
              {SUGGESTIONS.map((s) => (
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
        </div>
      )}
    </>
  );
}
