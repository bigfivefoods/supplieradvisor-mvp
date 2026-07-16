/**
 * SpaceXAI / xAI Grok client for SAM (OpenAI-compatible Chat Completions).
 * Server-only — never import from client components.
 */

import { SAM_MODEL } from './knowledge';
import type { SamChatMessage } from './prompt';

const XAI_BASE = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

export function getXaiApiKey(): string | null {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  return key.trim() || null;
}

export async function samChatCompletion(opts: {
  messages: SamChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<Response> {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    throw new Error(
      'XAI_API_KEY is not configured. Add it in the server environment to enable SAM.'
    );
  }

  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SAM_MODEL,
      messages: opts.messages,
      stream: Boolean(opts.stream),
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  return res;
}

/** Parse non-streaming chat completion JSON → assistant text */
export async function readSamCompletionText(res: Response): Promise<string> {
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `xAI error ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Grok');
  return text;
}
