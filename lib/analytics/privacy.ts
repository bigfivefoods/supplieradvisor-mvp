/**
 * Privacy filters for Vercel Speed Insights and Web Analytics.
 * Query strings are dropped. A URL that still contains an email address is not sent.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function publicMetricUrl(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (EMAIL.test(value)) return null;
  try {
    const url = new URL(value, 'https://www.supplieradvisor.com');
    if (EMAIL.test(`${url.pathname}${url.search}${url.hash}`)) return null;
    url.search = '';
    url.hash = '';
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeSpeedEvent<T extends { url: string }>(event: T): T | null {
  const url = publicMetricUrl(event.url);
  if (!url) return null;
  return { ...event, url };
}

export function sanitizeAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  const url = publicMetricUrl(event.url);
  if (!url) return null;
  return { ...event, url };
}
