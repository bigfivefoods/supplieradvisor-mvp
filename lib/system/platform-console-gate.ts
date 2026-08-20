/**
 * Shared auth for SupplierAdvisor platform console APIs.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireVerifiedUser,
} from '@/lib/auth/api-auth';
import {
  canAccessPlatformConsole,
  isPlatformOwnerEmail,
} from '@/lib/system/platform-company';
import {
  isPlatformOperatorEmail,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';

export async function requirePlatformConsoleAccess(request: NextRequest): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; emails: string[] }
> {
  const gate = await requireVerifiedUser(request, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!gate.ok) return { ok: false, response: gate.response };

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

  const access = await canAccessPlatformConsole(gate.userId);
  if (!access.ok && !emailIsOwner) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Not available. Sign in as a SupplierAdvisor platform owner to open the admin console.',
          code: 'PLATFORM_FORBIDDEN',
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: gate.userId, emails };
}
