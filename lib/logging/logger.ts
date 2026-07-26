/**
 * Structured application logger.
 * Emits JSON lines for Vercel/log drains; optionally mirrors to Sentry when configured.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

function baseFields(): LogFields {
  return {
    service: 'supplieradvisor',
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      null,
    region: process.env.VERCEL_REGION || null,
  };
}

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const payload = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...baseFields(),
    ...(fields || {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  // Soft Sentry hook — never static-require @sentry/nextjs (breaks builds when absent).
  // Optional: instrumentation may attach globalThis.Sentry when the package is installed.
  if (
    (level === 'error' || level === 'warn') &&
    process.env.SENTRY_DSN &&
    typeof globalThis !== 'undefined'
  ) {
    try {
      const Sentry = (
        globalThis as unknown as {
          Sentry?: {
            captureMessage?: (m: string, ctx?: unknown) => void;
            captureException?: (e: unknown, ctx?: unknown) => void;
          };
        }
      ).Sentry;
      if (!Sentry) return;
      if (fields?.err && Sentry.captureException) {
        Sentry.captureException(fields.err, { extra: payload });
      } else if (Sentry.captureMessage) {
        Sentry.captureMessage(message, { level, extra: payload });
      }
    } catch {
      /* Sentry not configured — fine */
    }
  }
}

export const log = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

/** Convenience for API routes */
export function logApi(
  route: string,
  level: LogLevel,
  message: string,
  fields?: LogFields
) {
  emit(level, message, { route, ...fields });
}
