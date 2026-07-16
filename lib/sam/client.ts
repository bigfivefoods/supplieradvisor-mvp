/**
 * SpaceXAI / xAI Grok client for SAM.
 * Preferred: Responses API  POST /v1/responses  (docs.x.ai)
 * Fallback:  Chat Completions  POST /v1/chat/completions
 * Server-only — never import from client components.
 */

import { SAM_MODEL } from './knowledge';
import type { SamChatMessage } from './prompt';

const XAI_BASE = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

export function getXaiApiKey(): string | null {
  // Bracket access so Next.js does not bake an empty value at build time
  const env = process.env as Record<string, string | undefined>;
  const key = (env['XAI_API_KEY'] || env['GROK_API_KEY'] || '').trim();
  return key || null;
}

export type SamUpstreamResult = {
  ok: boolean;
  status: number;
  /** Assistant text when non-streaming */
  text?: string;
  /** Raw error message from xAI */
  error?: string;
  /** Which API path was used */
  api: 'responses' | 'chat_completions';
  /** Stream body (chat completions SSE) — only when stream=true and chat path used */
  streamBody?: ReadableStream<Uint8Array> | null;
};

function extractXaiError(body: unknown, status: number): string {
  if (!body || typeof body !== 'object') {
    return `Grok request failed (${status})`;
  }
  const b = body as {
    error?: string | { message?: string };
    message?: string;
    code?: string;
  };
  if (typeof b.error === 'string' && b.error.trim()) return b.error;
  if (b.error && typeof b.error === 'object' && b.error.message) {
    return b.error.message;
  }
  if (typeof b.message === 'string' && b.message.trim()) return b.message;
  return `Grok request failed (${status})`;
}

function friendlyCreditsHint(message: string, status: number): string {
  if (
    status === 403 &&
    /credit|license|purchase|permission-denied/i.test(message)
  ) {
    return `${message} → Open console.x.ai for your team, add credits or a license, then try SAM again.`;
  }
  return message;
}

/** Pull assistant text from Responses API JSON */
export function extractResponsesText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      role?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof d.output_text === 'string' && d.output_text.trim()) {
    return d.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of d.output || []) {
    if (item.type === 'message' || item.role === 'assistant') {
      for (const c of item.content || []) {
        if (
          (c.type === 'output_text' || c.type === 'text') &&
          typeof c.text === 'string'
        ) {
          parts.push(c.text);
        }
      }
    }
  }
  return parts.join('\n').trim();
}

/**
 * Call Grok for SAM.
 * Uses Responses API by default (non-streaming, store:false).
 * If stream=true, falls back to chat/completions SSE for progressive UI.
 */
export async function samComplete(opts: {
  messages: SamChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<SamUpstreamResult> {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error:
        'XAI_API_KEY is not configured. Add it in the server environment (console.x.ai).',
      api: 'responses',
    };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Streaming: Chat Completions SSE (better progressive UX)
  if (opts.stream) {
    const res = await fetch(`${XAI_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: SAM_MODEL,
        messages: opts.messages,
        stream: true,
        temperature: opts.temperature ?? 0.5,
        max_tokens: opts.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        /* ignore */
      }
      // If chat path fails with 403, try responses for a clearer error path
      if (res.status === 403) {
        const r2 = await fetch(`${XAI_BASE}/responses`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: SAM_MODEL,
            input: opts.messages,
            store: false,
          }),
        });
        let body2: unknown = null;
        try {
          body2 = await r2.json();
        } catch {
          /* ignore */
        }
        const msg = friendlyCreditsHint(
          extractXaiError(body2 || errBody, r2.status || res.status),
          r2.status || res.status
        );
        return {
          ok: false,
          status: r2.status || res.status,
          error: msg,
          api: 'responses',
        };
      }
      return {
        ok: false,
        status: res.status,
        error: friendlyCreditsHint(extractXaiError(errBody, res.status), res.status),
        api: 'chat_completions',
      };
    }

    return {
      ok: true,
      status: 200,
      api: 'chat_completions',
      streamBody: res.body,
    };
  }

  // Non-streaming: preferred Responses API
  const res = await fetch(`${XAI_BASE}/responses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: SAM_MODEL,
      input: opts.messages,
      store: false,
      temperature: opts.temperature ?? 0.5,
      max_output_tokens: opts.maxTokens ?? 2048,
    }),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    // Fallback to chat completions if responses fails for non-credit reasons
    if (res.status !== 403) {
      const chatRes = await fetch(`${XAI_BASE}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: SAM_MODEL,
          messages: opts.messages,
          stream: false,
          temperature: opts.temperature ?? 0.5,
          max_tokens: opts.maxTokens ?? 2048,
        }),
      });
      let chatData: unknown = null;
      try {
        chatData = await chatRes.json();
      } catch {
        /* ignore */
      }
      if (chatRes.ok) {
        const text =
          (
            chatData as {
              choices?: Array<{ message?: { content?: string } }>;
            }
          )?.choices?.[0]?.message?.content?.trim() || '';
        if (text) {
          return {
            ok: true,
            status: 200,
            text,
            api: 'chat_completions',
          };
        }
      }
      return {
        ok: false,
        status: chatRes.status || res.status,
        error: friendlyCreditsHint(
          extractXaiError(chatData || data, chatRes.status || res.status),
          chatRes.status || res.status
        ),
        api: 'chat_completions',
      };
    }

    return {
      ok: false,
      status: res.status,
      error: friendlyCreditsHint(extractXaiError(data, res.status), res.status),
      api: 'responses',
    };
  }

  const text = extractResponsesText(data);
  if (!text) {
    return {
      ok: false,
      status: 502,
      error: 'Empty response from Grok Responses API',
      api: 'responses',
    };
  }

  return {
    ok: true,
    status: 200,
    text,
    api: 'responses',
  };
}

/** @deprecated use samComplete */
export async function samChatCompletion(opts: {
  messages: SamChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<Response> {
  const result = await samComplete(opts);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (result.streamBody) {
    return new Response(result.streamBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content: result.text } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function readSamCompletionText(res: Response): Promise<string> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(extractXaiError(data, res.status));
  }
  const fromResponses = extractResponsesText(data);
  if (fromResponses) return fromResponses;
  const text = (
    data as { choices?: Array<{ message?: { content?: string } }> }
  ).choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Grok');
  return text;
}
