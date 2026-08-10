import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import {
  canAccessPlatformConsole,
  ensurePlatformCompany,
  findPlatformCompany,
  PLATFORM_OWNER_EMAILS,
} from '@/lib/system/platform-company';
import { resolveEmailsForUserId } from '@/lib/system/platform-control';

export const runtime = 'nodejs';

/**
 * GET — platform company summary (operators / owners only).
 * POST — ensure SupplierAdvisor platform company exists + attach owners.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const access = await canAccessPlatformConsole(gate.userId);
    if (!access.ok) {
      return NextResponse.json(
        {
          error: 'Platform console is only for SupplierAdvisor owners.',
          code: 'PLATFORM_FORBIDDEN',
        },
        { status: 403 }
      );
    }

    const company = await findPlatformCompany();
    return NextResponse.json({
      success: true,
      access,
      company,
      owner_emails: PLATFORM_OWNER_EMAILS,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const access = await canAccessPlatformConsole(gate.userId);
    if (!access.ok) {
      return NextResponse.json(
        {
          error: 'Platform console is only for SupplierAdvisor owners.',
          code: 'PLATFORM_FORBIDDEN',
        },
        { status: 403 }
      );
    }

    const emails = await resolveEmailsForUserId(gate.userId);
    const result = await ensurePlatformCompany({
      userId: gate.userId,
      email: emails[0] || null,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      company: result.company,
      ownersAttached: result.ownersAttached,
      owner_emails: PLATFORM_OWNER_EMAILS,
      message: result.created
        ? 'SupplierAdvisor platform company created.'
        : 'SupplierAdvisor platform company ready.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
