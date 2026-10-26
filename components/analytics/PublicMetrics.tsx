'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import FunnelBeacon from '@/components/analytics/FunnelBeacon';
import {
  sanitizeAnalyticsEvent,
  sanitizeSpeedEvent,
} from '@/lib/analytics/privacy';

/**
 * Real-user speed and funnel analytics for the public site.
 * sampleRate 1 sends every page view's Web Vitals. URLs are stripped of
 * query strings before they leave the browser, and events with an email
 * address in the URL are dropped.
 */
export default function PublicMetrics() {
  return (
    <>
      <SpeedInsights sampleRate={1} beforeSend={sanitizeSpeedEvent} />
      <Analytics beforeSend={sanitizeAnalyticsEvent} />
      <FunnelBeacon />
    </>
  );
}
