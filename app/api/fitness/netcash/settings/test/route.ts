import { NextRequest, NextResponse } from 'next/server';
import { testDebitOrderConnection } from '@/lib/fitness/netcash/service';
import { netcashActor, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

/**
 * Tests the stored Debit Order service key in Netcash test mode.
 * The browser does not send the key. Live mode is not used.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const result = await testDebitOrderConnection(netcashDeps(undefined, companyId), companyId, netcashActor(gate.auth), gate.ip);
    const message = result.message.includes('gnc1.')
      ? 'Connection failed. Netcash did not confirm the service key.'
      : result.message;
    return NextResponse.json({ ok: result.ok && message.startsWith('Connection passed'), message });
  } catch (error) {
    return publicError(error);
  }
}
