import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/http/rate-limit';
import { logApi } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_REPORT_BYTES = 16 * 1024;
// Keep CSP report ingestion lightweight: log only a subset to control volume/noise.
const SAMPLE_RATE = 0.2;

function asString(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  return clean.slice(0, max);
}

function normalizeReportPayload(
  contentType: string,
  parsed: unknown
): Record<string, unknown> | null {
  if (contentType.includes('application/csp-report')) {
    if (!parsed || typeof parsed !== 'object') return null;
    const wrapped = (parsed as Record<string, unknown>)['csp-report'];
    if (wrapped && typeof wrapped === 'object') return wrapped as Record<string, unknown>;
    return parsed as Record<string, unknown>;
  }

  if (contentType.includes('application/reports+json')) {
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0];
    if (!first || typeof first !== 'object') return null;
    const body = (first as Record<string, unknown>).body;
    if (!body || typeof body !== 'object') return null;
    return body as Record<string, unknown>;
  }

  return null;
}

function pickFirst(report: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = report[key];
    if (value != null) return value;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rl = rateLimit(`csp-report:${ip}`, { limit: 120, windowMs: 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // Best-effort fast reject when header is honest; byte-length check below is authoritative.
  const contentLength = Number.parseInt(request.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const raw = await request.text();
  // Authoritative cap in case content-length is absent or invalid.
  if (Buffer.byteLength(raw, 'utf8') > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }
  if (!raw.trim()) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (
    !contentType.includes('application/csp-report') &&
    !contentType.includes('application/reports+json')
  ) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  const report = normalizeReportPayload(contentType, parsed);
  if (!report) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  const effectiveDirective = asString(
    pickFirst(report, ['effective-directive', 'effectiveDirective'])
  );
  const violatedDirective = asString(
    pickFirst(report, ['violated-directive', 'violatedDirective'])
  );
  const primaryDirective = (effectiveDirective || violatedDirective || '').toLowerCase();
  const shouldAlwaysLog =
    primaryDirective.startsWith('script-src') ||
    primaryDirective.startsWith('default-src') ||
    primaryDirective.startsWith('object-src') ||
    primaryDirective.startsWith('base-uri') ||
    primaryDirective.startsWith('frame-ancestors');

  if (shouldAlwaysLog || Math.random() < SAMPLE_RATE) {
    logApi('/api/csp-report', 'warn', 'csp violation report', {
      disposition: asString(pickFirst(report, ['disposition'])),
      effectiveDirective,
      violatedDirective,
      blockedUri: asString(pickFirst(report, ['blocked-uri', 'blockedURL', 'blockedUri'])),
      sourceFile: asString(pickFirst(report, ['source-file', 'sourceFile'])),
      statusCode: Number(pickFirst(report, ['status-code', 'statusCode']) || 0) || undefined,
      userAgent: asString(request.headers.get('user-agent')),
    });
  }

  return new NextResponse(null, { status: 204 });
}
