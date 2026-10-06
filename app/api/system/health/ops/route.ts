import { NextRequest } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { requirePlatformConsoleAccess } from '@/lib/system/platform-console-gate';
import { runHealthOps } from '../ops-probe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) {
    const gate = await requirePlatformConsoleAccess(request);
    if (!gate.ok) return gate.response;
  }
  return runHealthOps(request);
}
