/**
 * GET — SA Member access report for the SupplierAdvisor platform console.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformConsoleAccess } from '@/lib/system/platform-console-gate';
import { loadSaMemberAccessReport } from '@/lib/system/sa-member-access-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const gate = await requirePlatformConsoleAccess(request);
    if (!gate.ok) return gate.response;

    const report = await loadSaMemberAccessReport();
    return NextResponse.json({ success: true, report });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
