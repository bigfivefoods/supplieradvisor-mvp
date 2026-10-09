/**
 * Named Website Insights actions (sign-ups, trial starts) from anywhere in the app, without
 * importing the recorder. The recorder listens for this event and sends `cta-<name>`.
 */
export const INSIGHTS_ACTION_EVENT = 'sa-insights-action';

export function trackInsightsAction(name: string): void {
  try {
    if (typeof window === 'undefined' || !/^[a-z0-9-]{2,40}$/.test(name)) return;
    window.dispatchEvent(new CustomEvent(INSIGHTS_ACTION_EVENT, { detail: name }));
  } catch {
    /* never affect the page */
  }
}
