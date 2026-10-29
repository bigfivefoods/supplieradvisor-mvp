import { NextRequest, NextResponse } from 'next/server';
import { collectionsCsv } from '@/lib/fitness/netcash/export-csv';
import { renderStatementPdf } from '@/lib/fitness/netcash/pdf';
import { statementRows } from '@/lib/fitness/netcash/export-csv';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  const format = request.nextUrl.searchParams.get('format') || 'csv';
  const memberId = request.nextUrl.searchParams.get('memberId') || '';
  try {
    const deps = netcashDeps();
    const runs = await deps.repo.listRuns(companyId);
    let lines = await deps.repo.listLines(companyId);
    if (memberId) lines = lines.filter((line) => line.memberId === memberId);
    if (format === 'pdf') {
      const loaded = await loadBillable(companyId).catch(() => ({ gymName: 'GymAdvisor®', members: [] }));
      const name = lines[0]?.memberName || 'Member';
      const pdf = await renderStatementPdf({ gymName: loaded.gymName, memberName: name, lines: statementRows(lines), runs });
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="GymAdvisor-statement.pdf"',
          'Cache-Control': 'private, no-store',
        },
      });
    }
    const csv = collectionsCsv(runs, lines);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="GymAdvisor-collections.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
