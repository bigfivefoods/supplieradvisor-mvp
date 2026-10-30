import { NextRequest, NextResponse } from 'next/server';
import { toPublicSettings } from '@/lib/fitness/netcash/defaults';
import { loadSettings, removeServiceKey, updateSettings } from '@/lib/fitness/netcash/service';
import type { NetcashSettings } from '@/lib/fitness/netcash/types';
import { loadBillable, netcashActor, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

function settingsResponse(settings: NetcashSettings) {
  const pub = toPublicSettings(settings);
  const encoded = JSON.stringify(pub);
  if (encoded.includes('gnc1.') || encoded.includes('serviceKeyEnc') || encoded.includes('accountKeyEnc')) {
    return NextResponse.json({ error: 'Could not prepare settings.' }, { status: 500 });
  }
  return NextResponse.json({ settings: pub });
}

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const settings = await loadSettings(netcashDeps(), companyId);
    return settingsResponse(settings);
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
    const settings = await updateSettings(netcashDeps(loaded.gymName), companyId, body, netcashActor(gate.auth), gate.ip);
    return settingsResponse(settings);
  } catch (error) {
    return publicError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const settings = await removeServiceKey(netcashDeps(), companyId, netcashActor(gate.auth), gate.ip);
    return settingsResponse(settings);
  } catch (error) {
    return publicError(error);
  }
}
