/**
 * Preview deployments must not talk to the production database.
 * Warn-only unless ENV_GUARD_ENFORCE=1. Production never throws.
 * Payment-key checks look at the prefix only and never log the value.
 */
export const PRODUCTION_SUPABASE_PROJECT_REF = 'onkklullmgrdqoertngp';

/** Staging project used by the load-test sign-in gate. Not a production bypass. */
export const STAGING_SUPABASE_PROJECT_REF = 'wpchtkfkaavcjyfgmktn';

/**
 * Project ref from a Supabase URL.
 * postgres.<ref> on a pooler URL wins over the pooler host label.
 * db.<ref>.supabase.co and <ref>.supabase.co are accepted.
 * Empty when the user ref and the host ref disagree.
 */
export function supabaseProjectRefFromUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  let user = '';
  try {
    user = decodeURIComponent(parsed.username || '').trim().toLowerCase();
  } catch {
    user = String(parsed.username || '').trim().toLowerCase();
  }
  const fromUser = user.startsWith('postgres.') ? user.slice('postgres.'.length) : '';
  const labels = host.split('.').filter(Boolean);
  const supabaseHost =
    labels.length >= 3 && labels[labels.length - 2] === 'supabase' && labels[labels.length - 1] === 'co';
  let fromHost = '';
  if (supabaseHost && !host.includes('pooler')) {
    fromHost = labels[0] === 'db' && labels.length >= 4 ? labels[1] : labels[0];
  }
  if (fromUser && fromHost && fromUser !== fromHost) return '';
  return fromUser || fromHost;
}

export const PAYMENT_KEY_ENV_NAMES = [
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_SECRET',
  'BANKLINK_API_KEY',
] as const;

const LIVE_SECRET_PREFIX = 'sk_live_';

export type DeploymentReason = 'preview-production-database' | 'live-payment-key';

export type DeploymentEnvInput = {
  vercelEnv?: string;
  enforce?: string;
  supabaseUrl?: string;
  paymentKeys?: Record<string, string | undefined>;
};

export type DeploymentEnvDecision = {
  action: 'ok' | 'warn' | 'throw';
  reasons: DeploymentReason[];
  paymentKeyNames: string[];
  message: string;
};

const warned = new Set<string>();

export function resetDeploymentEnvForTests(): void {
  warned.clear();
}

export function evaluateDeploymentEnv(input: DeploymentEnvInput): DeploymentEnvDecision {
  const vercelEnv = input.vercelEnv ?? '';
  const enforce = input.enforce === '1';
  const url = input.supabaseUrl ?? '';
  const reasons: DeploymentReason[] = [];
  const paymentKeyNames: string[] = [];

  if (vercelEnv === 'preview' && url.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
    reasons.push('preview-production-database');
  }

  if (vercelEnv === 'preview' || vercelEnv === 'development') {
    const keys = input.paymentKeys ?? {};
    for (const name of PAYMENT_KEY_ENV_NAMES) {
      const value = keys[name];
      if (typeof value === 'string' && value.trim().startsWith(LIVE_SECRET_PREFIX)) {
        paymentKeyNames.push(name);
      }
    }
    if (paymentKeyNames.length > 0) reasons.push('live-payment-key');
  }

  if (reasons.length === 0) {
    return { action: 'ok', reasons, paymentKeyNames, message: '' };
  }

  return {
    action: enforce ? 'throw' : 'warn',
    reasons,
    paymentKeyNames,
    message: formatDecision(reasons, paymentKeyNames, enforce),
  };
}

export function assertDeploymentEnv(partial?: {
  supabaseUrl?: string;
  env?: Record<string, string | undefined>;
}): void {
  const env = partial?.env ?? process.env;
  const decision = evaluateDeploymentEnv({
    vercelEnv: env.VERCEL_ENV,
    enforce: env.ENV_GUARD_ENFORCE,
    supabaseUrl: partial?.supabaseUrl ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    paymentKeys: Object.fromEntries(PAYMENT_KEY_ENV_NAMES.map((name) => [name, env[name]])),
  });
  if (decision.action === 'ok') return;
  if (decision.action === 'warn') {
    if (!warned.has(decision.message)) {
      warned.add(decision.message);
      console.warn(`[env-guard] ${decision.message}`);
    }
    return;
  }
  throw new Error(`[env-guard] ${decision.message}`);
}

function formatDecision(reasons: DeploymentReason[], names: string[], enforce: boolean): string {
  const parts: string[] = [];
  if (reasons.includes('preview-production-database')) {
    parts.push(
      `Preview is using the production Supabase project ${PRODUCTION_SUPABASE_PROJECT_REF}.`
    );
  }
  if (reasons.includes('live-payment-key')) {
    parts.push(
      `A non-production deployment has a live-mode payment key in ${names.join(', ')}. The value was not logged.`
    );
  }
  parts.push(
    enforce
      ? 'ENV_GUARD_ENFORCE=1, so this process will not start.'
      : 'Warn only. Behaviour is unchanged until ENV_GUARD_ENFORCE=1.'
  );
  return parts.join(' ');
}
