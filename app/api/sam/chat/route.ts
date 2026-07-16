import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getXaiApiKey, samComplete } from '@/lib/sam/client';
import { buildSamSystemPrompt, type SamChatMessage } from '@/lib/sam/prompt';
import { SAM_MODEL, SAM_NAME } from '@/lib/sam/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 60;

type IncomingMsg = { role?: string; content?: string };

/**
 * POST /api/sam/chat
 * Body: { messages: [{role, content}], companyId?, pathname?, stream? }
 * SAM — Supplier Advisor Messenger (Grok via xAI Responses API).
 */
export async function POST(request: NextRequest) {
  try {
    if (!getXaiApiKey()) {
      return NextResponse.json(
        {
          error:
            'SAM is not configured yet. Set XAI_API_KEY in the server environment (console.x.ai).',
          code: 'SAM_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId:
        body.privyUserId || legacyPrivyFrom(request) || null,
    });
    if (!auth.ok) return auth.response;

    const rawMessages = Array.isArray(body.messages)
      ? (body.messages as IncomingMsg[])
      : [];
    const history: SamChatMessage[] = rawMessages
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim()
      )
      .slice(-24)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content).slice(0, 8000),
      }));

    if (!history.length || history[history.length - 1].role !== 'user') {
      return NextResponse.json(
        { error: 'Send at least one user message.' },
        { status: 400 }
      );
    }

    let companyName: string | null = null;
    let role: string | null = null;
    const companyId = Number(body.companyId);
    if (Number.isFinite(companyId) && companyId > 0) {
      const mem = await getCompanyMembership(auth.userId, companyId);
      if (mem.ok) {
        role = mem.role;
        try {
          const supabase = getSupabaseServer();
          const { data: co } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          companyName =
            (co as { trading_name?: string; legal_name?: string } | null)
              ?.trading_name ||
            (co as { legal_name?: string } | null)?.legal_name ||
            null;
        } catch {
          /* ignore */
        }
      }
    }

    const system = buildSamSystemPrompt({
      companyName,
      role,
      pathname: body.pathname ? String(body.pathname).slice(0, 200) : null,
    });

    const messages: SamChatMessage[] = [
      { role: 'system', content: system },
      ...history,
    ];

    // Prefer non-streaming Responses API (docs.x.ai preferred path).
    // stream=true still available for progressive UI via chat completions.
    const wantStream = body.stream === true;

    const result = await samComplete({
      messages,
      stream: wantStream,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || 'Grok request failed',
          status: result.status,
          api: result.api,
        },
        { status: result.status === 403 ? 403 : result.status || 502 }
      );
    }

    if (wantStream && result.streamBody) {
      return new Response(result.streamBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Sam-Model': SAM_MODEL,
          'X-Sam-Name': SAM_NAME,
          'X-Sam-Api': result.api,
        },
      });
    }

    return NextResponse.json({
      success: true,
      name: SAM_NAME,
      model: SAM_MODEL,
      api: result.api,
      message: { role: 'assistant', content: result.text },
    });
  } catch (e: unknown) {
    console.error('SAM chat error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'SAM error' },
      { status: 500 }
    );
  }
}

/** Lightweight health for UI badge */
export async function GET() {
  const configured = Boolean(getXaiApiKey());
  return NextResponse.json({
    name: SAM_NAME,
    fullName: 'Supplier Advisor Messenger',
    model: SAM_MODEL,
    configured,
    status: configured ? 'ready' : 'missing_api_key',
    preferredApi: 'responses',
    endpoint: 'https://api.x.ai/v1/responses',
  });
}
