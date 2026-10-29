import { NextRequest, NextResponse } from 'next/server';
import { toPublicSettings } from '@/lib/fitness/netcash/defaults';
import { loadSettings, updateSettings } from '@/lib/fitness/netcash/service';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const settings = await loadSettings(netcashDeps(), companyId);
    return NextResponse.json({ settings: toPublicSettings(settings) });
  } catch (error) {
    return publicError(error);
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const loaded = await loadBillable(companyId).catch(() => ({ gymName: 'GymAdvisor®', members: [] }));
    const settings = await updateSettings(netcashDeps(loaded.gymName), companyId, body, gate.auth.userId);
    return NextResponse.json({ settings: toPublicSettings(settings) });
  } catch (error) {
    return publicError(error);
  }
}
