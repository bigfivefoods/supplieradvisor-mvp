/**
 * Sample and fixture routes stay available for local development and Vercel
 * preview deployments. Production must not serve them.
 */
import { notFound } from 'next/navigation';

export function fixtureRoutesOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV !== 'production';
}

export const PUBLIC_FIXTURE_FALLBACK_HREF = '/join';

export function fixturePublicHref(
  fixtureHref: string,
  env: NodeJS.ProcessEnv = process.env,
  productionHref = PUBLIC_FIXTURE_FALLBACK_HREF
): string {
  return fixtureRoutesOpen(env) ? fixtureHref : productionHref;
}

export function interactiveDemoHref(env: NodeJS.ProcessEnv = process.env): string {
  return fixturePublicHref('/demo', env);
}

/** Call from a Server Component layout or a route handler. */
export function blockFixtureRoutes(): void {
  if (!fixtureRoutesOpen()) notFound();
}
