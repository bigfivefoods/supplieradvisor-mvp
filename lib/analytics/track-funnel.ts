'use client';

import { track } from '@vercel/analytics';
import {
  isFunnelEvent,
  sanitizeFunnelProps,
  type FunnelEvent,
} from '@/lib/analytics/funnel';

const SESSION_PREFIX = 'sa_funnel_';

/** Send one privacy-filtered funnel event. Repeated calls in the same tab are ignored. */
export function trackFunnel(
  event: FunnelEvent,
  props?: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !isFunnelEvent(event)) return;
  const key = `${SESSION_PREFIX}${event}`;
  try {
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* storage blocked — still send this one event */
  }
  try {
    track(event, sanitizeFunnelProps(props));
  } catch {
    /* analytics must not break the page */
  }
}
