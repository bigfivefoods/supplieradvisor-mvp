/**
 * Sample and fixture routes stay available for local development and Vercel
 * preview deployments. Production must not serve them.
 */
import { notFound } from 'next/navigation';

export function fixtureRoutesOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV !== 'production';
}

/** Call from a Server Component layout or a route handler. */
export function blockFixtureRoutes(): void {
  if (!fixtureRoutesOpen()) notFound();
}
