/**
 * GET — one-page A4 landscape platform management report PDF.
 * Same auth gate as /api/system/platform-console.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import {
  canAccessPlatformConsole,
  ensurePlatformCompany,
  isPlatformOwnerEmail,
} from '@/lib/system/platform-company';
import { loadPlatformConsoleReports } from '@/lib/system/platform-metrics';
import {
  isPlatformOperatorEmail,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';
import {
  buildPlatformManagementReportPdf,
  platformManagementPdfFilename,
} from '@/lib/system/platform-management-report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const hintEmail = (
      request.nextUrl.searchParams.get('email') ||
      request.headers.get('x-platform-email') ||
      ''
    )
      .trim()
      .toLowerCase();

    let emails = await resolveEmailsForUserId(gate.userId);
    if (hintEmail && hintEmail.includes('@') && !emails.includes(hintEmail)) {
      emails = [...emails, hintEmail];
    }

    const emailIsOwner = emails.some(
      (e) => isPlatformOwnerEmail(e) || isPlatformOperatorEmail(e)
    );

    let access = await canAccessPlatformConsole(gate.userId);
    if (!access.ok && !emailIsOwner) {
      return NextResponse.json(
        {
          error:
            'Not available. Sign in as a SupplierAdvisor platform owner to open the admin console.',
          code: 'PLATFORM_FORBIDDEN',
        },
        { status: 403 }
      );
    }

    if (!access.ok && emailIsOwner) {
      const ensureResult = await ensurePlatformCompany({
        userId: gate.userId,
        email: emails[0] || hintEmail || null,
      });
      access = {
        ok: true,
        via: 'owner',
        companyId: ensureResult.company.id,
      };
    }

    const reports = await loadPlatformConsoleReports();
    const buf = await buildPlatformManagementReportPdf(reports.management, {
      companyName:
        reports.company?.trading_name || 'SupplierAdvisor platform',
    });
    const filename = platformManagementPdfFilename();

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    console.error('[platform management-pdf]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF failed' },
      { status: 500 }
    );
  }
}
