import { safeNextPath } from './safe-next';

/**
 * Where to send someone after a successful email code, SMS code, Google, or Apple
 * sign-in. `next` is honoured when it is a same-origin path. Role fallbacks match
 * the historical /login branches (contractor-only, member, company picker).
 */
const DIRECT_PREFIXES = ['/contractor/invite', '/onboarding', '/invite', '/store'] as const;

export type LoginReturnRole = {
  isContractor: boolean;
  isBusinessUser: boolean;
};

export function prefersDirectReturn(next: string | null | undefined): boolean {
  const safe = safeNextPath(next);
  return DIRECT_PREFIXES.some((prefix) => safe.startsWith(prefix));
}

export function hrefAfterLoginRole(
  rawNext: string | null | undefined,
  role: LoginReturnRole | null
): string {
  const next = safeNextPath(rawNext);
  if (DIRECT_PREFIXES.some((prefix) => next.startsWith(prefix))) return next;
  if (!role) {
    if (next.startsWith('/me') || next.startsWith('/hire') || next.startsWith('/member')) {
      return next;
    }
    return next || '/dashboard/select-company';
  }
  if (role.isContractor && !role.isBusinessUser) {
    return next.startsWith('/contractor') ? next : '/contractor';
  }
  if (next.startsWith('/contractor')) return next;
  if (next.startsWith('/me') || next.startsWith('/hire/') || next.startsWith('/member/')) {
    return next || '/me';
  }
  if (!role.isBusinessUser && !role.isContractor) return next || '/me';
  return next || '/dashboard/select-company';
}

/** Email/SMS success: router.replace(safeNextPath(next)) when that path is the destination. */
export function replaceAfterEmailCodeLogin(
  router: { replace: (href: string) => void },
  rawNext: string | null | undefined,
  role: LoginReturnRole | null
): void {
  const next = safeNextPath(rawNext);
  const href = hrefAfterLoginRole(next, role);
  if (next && href === next) {
    router.replace(safeNextPath(next));
    return;
  }
  router.replace(href || '/dashboard/select-company');
}
