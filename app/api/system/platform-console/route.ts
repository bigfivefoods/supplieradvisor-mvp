import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import {
  canAccessPlatformConsole,
  ensurePlatformCompany,
  isPlatformOwnerEmail,
  platformOwnerEmails,
} from '@/lib/system/platform-company';
import { loadPlatformConsoleReports } from '@/lib/system/platform-metrics';
import {
  isPlatformOperatorEmail,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';

export const runtime = 'nodejs';

/**
 * GET — full platform admin console: system + management reports.
 * Auth: platform operator emails or owner of SupplierAdvisor platform company.
 * Optionally ensures the platform company exists (?ensure=1).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const emails = [
      ...new Set([
        ...(gate.emails || []),
        ...(await resolveEmailsForUserId(gate.userId)),
      ]),
    ];

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

    const ensure =
      request.nextUrl.searchParams.get('ensure') === '1' ||
      request.nextUrl.searchParams.get('bootstrap') === '1';

    let ensureResult: Awaited<ReturnType<typeof ensurePlatformCompany>> | null =
      null;
    if (ensure || !access.companyId || emailIsOwner) {
      ensureResult = await ensurePlatformCompany({
        userId: gate.userId,
        jwtEmails: emails,
      });
      access = await canAccessPlatformConsole(gate.userId);
      // After ensure, owner email hint is enough
      if (!access.ok && emailIsOwner) {
        access = {
          ok: true,
          via: 'owner',
          companyId: ensureResult.company.id,
        };
      }
    }

    const reports = await loadPlatformConsoleReports();

    return NextResponse.json({
      success: true,
      access,
      owner_emails: platformOwnerEmails(),
      ensure: ensureResult
        ? {
            created: ensureResult.created,
            companyId: ensureResult.company.id,
            ownersAttached: ensureResult.ownersAttached,
          }
        : null,
      company: reports.company,
      system: reports.system,
      management: reports.management,
      ops: reports.ops,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
