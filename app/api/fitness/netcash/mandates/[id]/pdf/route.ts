import { NextRequest, NextResponse } from 'next/server';
import { renderMandatePdf } from '@/lib/fitness/netcash/pdf';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

type MandatePdfCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: MandatePdfCtx) {
  const { id } = await context.params;
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const mandate = (await netcashDeps().repo.listMandates(companyId)).find((row) => row.id === id);
    if (!mandate) return NextResponse.json({ error: 'Mandate not found.' }, { status: 404 });
    const loaded = await loadBillable(companyId).catch(() => ({ gymName: 'GymAdvisor®', members: [] }));
    const pdf = await renderMandatePdf({ gymName: loaded.gymName, mandate });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GymAdvisor-mandate-${mandate.accountLast4 || 'member'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
