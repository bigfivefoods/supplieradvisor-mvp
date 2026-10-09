/**
 * Tiny real-user Core Web Vitals (LCP, INP, CLS) with PerformanceObserver. No dependency.
 * Each metric is reported once per page load, when the page is first hidden (tab switch, close,
 * navigation away). Values: LCP and INP in milliseconds, CLS unitless. Browsers without an entry
 * type simply never report that metric.
 */

export type VitalName = "lcp" | "inp" | "cls";

type ShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };
type EventTimingEntry = PerformanceEntry & { interactionId?: number };

export function observeVitals(report: (name: VitalName, value: number) => void): void {
  if (typeof PerformanceObserver === "undefined") return;
  const supported = PerformanceObserver.supportedEntryTypes || [];
  let lcp = -1;
  let cls = 0;
  let clsSeen = false;
  let sessionValue = 0;
  let sessionStart = 0;
  let sessionLast = 0;
  const interactions = new Map<number, number>();
  const observers: [PerformanceObserver, (entries: PerformanceEntryList) => void][] = [];

  const watch = (type: string, cb: (entries: PerformanceEntryList) => void, extra: Record<string, unknown> = {}) => {
    if (!supported.includes(type)) return;
    try {
      const po = new PerformanceObserver((list) => cb(list.getEntries()));
      po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      observers.push([po, cb]);
    } catch {
      /* unsupported option */
    }
  };

  watch("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = last.startTime;
  });

  watch("layout-shift", (entries) => {
    for (const entry of entries as ShiftEntry[]) {
      if (entry.hadRecentInput) continue;
      clsSeen = true;
      if (sessionValue && entry.startTime - sessionLast < 1000 && entry.startTime - sessionStart < 5000) {
        sessionValue += entry.value;
      } else {
        sessionValue = entry.value;
        sessionStart = entry.startTime;
      }
      sessionLast = entry.startTime;
      if (sessionValue > cls) cls = sessionValue;
    }
  });

  const onEvent = (entries: PerformanceEntryList) => {
    for (const entry of entries as EventTimingEntry[]) {
      const id = entry.interactionId;
      if (!id) continue;
      const prev = interactions.get(id) ?? 0;
      if (entry.duration > prev) interactions.set(id, entry.duration);
    }
  };
  watch("event", onEvent, { durationThreshold: 40 });
  watch("first-input", onEvent);

  let done = false;
  const flush = () => {
    if (done) return;
    done = true;
    for (const [po, cb] of observers) {
      try {
        const pending = po.takeRecords?.() ?? [];
        if (pending.length) cb(pending);
        po.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (lcp >= 0) report("lcp", Math.round(lcp));
    if (interactions.size) {
      // INP: the worst interaction, ignoring one outlier per 50 interactions.
      const sorted = [...interactions.values()].sort((a, b) => b - a);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
      report("inp", Math.round(sorted[idx]!));
    }
    if (clsSeen || supported.includes("layout-shift")) report("cls", Math.round(cls * 1000) / 1000);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
