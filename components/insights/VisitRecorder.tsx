'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  INSIGHTS_COLLECT_PATH,
  INSIGHTS_SITE,
  VISITOR_COOKIE,
  VISITOR_MAX_AGE_SEC,
  browserFromUa,
  cleanReferrer,
  clickLabelFor,
  deviceFromUa,
  insightsOptOut,
  languageTag,
  nextVisitorState,
  osFromUa,
  outboundHost,
  parseVisitorCookie,
  pdfName,
  publicPath,
  readUtm,
  screenBand,
  scrollBand,
  visitorCookieValue,
  type InsightEvent,
  type Utm,
  visitAttribution,
} from '@/lib/insights/visitor';
import { INSIGHTS_ACTION_EVENT } from '@/lib/insights/action';
import { observeVitals } from '@/lib/insights/vitals';

const SESSION_KEY = 'sa_visit';
const TEST_KEY = 'sa-insights-test';

type VisitSession = {
  id: string;
  isNew: boolean;
  frequency: number;
  recencyDays: number | null;
  landing: string;
  pages: string[];
  referrer?: string;
  utm?: Utm;
  /** True once the first page view (with referrer + campaign) has been sent. */
  attributed?: boolean;
};

function optedOut(): boolean {
  try {
    const nav = navigator as Navigator & {
      msDoNotTrack?: string;
      globalPrivacyControl?: boolean;
    };
    return insightsOptOut({
      doNotTrack: nav.doNotTrack,
      msDoNotTrack: nav.msDoNotTrack,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    });
  } catch {
    return true;
  }
}

function automatedBrowser(): boolean {
  try {
    if (!navigator.webdriver) return false;
    return window.localStorage.getItem(TEST_KEY) !== '1';
  } catch {
    return true;
  }
}

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${VISITOR_COOKIE}=([^;]*)`));
  return match?.[1] || null;
}

function writeCookie(value: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${VISITOR_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function readSession(): VisitSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitSession;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.landing !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: VisitSession) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* session storage blocked — this page can still emit a single view */
  }
}

type ClientEvent = Omit<InsightEvent, 'id'> & { id?: string };

function context(session: VisitSession, path: string): Omit<ClientEvent, 'k' | 'p'> {
  const width = window.innerWidth || 0;
  const ua = navigator.userAgent || '';
  const standalone = (() => {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches
      );
    } catch {
      return false;
    }
  })();
  return {
    a: standalone,
    device: deviceFromUa(ua, width),
    browser: browserFromUa(ua),
    os: osFromUa(ua),
    screen: screenBand(width),
    lang: languageTag(navigator.language),
    landing: session.landing,
    exit: path,
    pages: session.pages.slice(0, 8),
    visitor: session.id,
    new: session.isNew,
    frequency: session.frequency,
    recency_days: session.recencyDays,
  };
}

function send(events: ClientEvent[], beacon = false) {
  for (let i = 0; i < events.length; i += 10) {
    const stamped = events.slice(i, i + 10).map((event) => ({
      ...event,
      eid: crypto.randomUUID(),
    }));
    const body = JSON.stringify({ v: 1, site: INSIGHTS_SITE, e: stamped });
    try {
      // Leaving the page: sendBeacon survives the unload; if the browser refuses it, keepalive fetch.
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(INSIGHTS_COLLECT_PATH, new Blob([body], { type: 'text/plain' }))) continue;
      void fetch(INSIGHTS_COLLECT_PATH, {
        method: 'POST',
        body,
        keepalive: true,
        credentials: 'include',
        headers: { 'Content-Type': 'text/plain' },
      }).catch(() => {});
    } catch {
      /* never surface a recording failure to the page */
    }
  }
}

/** In-app pages: only a data-insights slug or a generic label; never the visible text. */
function buttonLabel(el: Element, path: string): string | undefined {
  const labelled = el.getAttribute('aria-label') || '';
  const text = el instanceof HTMLInputElement ? labelled || el.value : labelled || el.textContent || '';
  const data = el.closest('[data-insights]')?.getAttribute('data-insights');
  return clickLabelFor({ path, dataLabel: data, text });
}

let vitalsStarted = false;
let flushVitals: () => void = () => {};
/** Page-speed readings waiting to ride with the next engagement batch. */
const pendingVitals: ClientEvent[] = [];

function isButtonLike(el: Element): boolean {
  if (el instanceof HTMLButtonElement) return true;
  if (el.getAttribute('role') === 'button') return true;
  if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button')) return true;
  const className = String(el.getAttribute('class') || '');
  return /(?:^|\s)(?:btn|button)(?:\s|$)|rounded-full/.test(className);
}

/**
 * Records a public visit into Website Insights. Renders nothing.
 * Do Not Track and Global Privacy Control skip the cookie and every event.
 */
export default function VisitRecorder() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (optedOut() || automatedBrowser()) return;
    const path = publicPath(pathname);
    if (!path) return;

    let session = readSession();
    if (!session) {
      const nowSec = Math.floor(Date.now() / 1000);
      const freshId = crypto.randomUUID();
      const next = nextVisitorState(parseVisitorCookie(readCookie()), nowSec, freshId);
      writeCookie(visitorCookieValue(next.cookie));
      session = {
        id: next.cookie.id,
        isNew: next.isNew,
        frequency: next.cookie.visits,
        recencyDays: next.recencyDays,
        landing: path,
        pages: [path],
        referrer: cleanReferrer(document.referrer),
        utm: readUtm(window.location.search),
      };
      writeSession(session);
    } else if (!session.pages.includes(path) && session.pages.length < 8) {
      session = { ...session, pages: [...session.pages, path] };
      writeSession(session);
    }

    let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    let accumulated = 0;
    let maxScroll = 0;
    let sentPage = path;

    const measureScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      maxScroll = Math.max(maxScroll, scrollBand(window.scrollY / height));
    };
    measureScroll();

    const view: ClientEvent = { k: 'pageview', p: path, ...context(session, path), ...visitAttribution(session, 'pageview') };
    if (maxScroll > 0) view.scroll = maxScroll;
    send([view]);
    if (!session.attributed) {
      session = { ...session, attributed: true };
      writeSession(session);
    }

    const onScroll = () => measureScroll();
    const flush = (beacon: boolean) => {
      if (visibleSince) accumulated += Date.now() - visibleSince;
      visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
      const ms = accumulated;
      const scroll = maxScroll;
      accumulated = 0;
      maxScroll = 0;
      const batch: ClientEvent[] = [];
      if (ms >= 500 || scroll > 0) {
        batch.push({
          k: 'engage',
          p: sentPage,
          ms: Math.min(ms, 36e5),
          scroll,
          ...context(session as VisitSession, sentPage),
          exit: sentPage,
        });
      }
      if (beacon) {
        // Leaving or hiding: page speed goes out in the same beacon as the engaged time.
        flushVitals();
        batch.push(...pendingVitals.splice(0, pendingVitals.length));
      }
      send(batch, beacon);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(true);
      else if (!visibleSince) visibleSince = Date.now();
    };
    const onPageHide = () => flush(true);
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest('a[href], button, [role="button"], input[type="submit"], input[type="button"]');
      if (!el) return;
      const base = context(session as VisitSession, sentPage);
      if (el instanceof HTMLAnchorElement && el.href) {
        const pdf = pdfName(el.href, window.location.origin);
        if (pdf) {
          send([{ k: 'pdf', p: sentPage, l: pdf, ...base }]);
          return;
        }
        const host = outboundHost(el.href, window.location.origin);
        if (host) {
          send([{ k: 'outbound', p: sentPage, l: host, ...base }]);
          return;
        }
      }
      const named = el.closest('[data-insights]')?.getAttribute('data-insights');
      if (!isButtonLike(el) && !named) {
        // A plain link styled as text can still be the "Start free trial" call to action.
        const trial = el instanceof HTMLAnchorElement ? clickLabelFor({ path: sentPage, text: el.textContent || '' }) : undefined;
        if (trial !== 'cta-start-free-trial') return;
      }
      const label = buttonLabel(el, sentPage);
      if (!label) return;
      send([{ k: 'click', p: sentPage, l: label, ...base }]);
    };
    const onAction = (event: Event) => {
      const name = (event as CustomEvent<unknown>).detail;
      if (typeof name !== 'string' || !/^[a-z0-9-]{2,40}$/.test(name)) return;
      send([{ k: 'click', p: sentPage, l: `cta-${name}`, ...context(session as VisitSession, sentPage) }]);
    };
    window.addEventListener(INSIGHTS_ACTION_EVENT, onAction);
    if (!vitalsStarted) {
      // Page speed for the page this load started on. One reading per metric, sent when hidden.
      vitalsStarted = true;
      const vitalsPage = path;
      const device = deviceFromUa(navigator.userAgent || '', window.innerWidth || 0);
      flushVitals = observeVitals((name, value) => {
        pendingVitals.push({ k: 'vital', p: vitalsPage, l: name, v: value, device, visitor: (session as VisitSession).id });
        // Normally drained by flush() above in the same hide/pagehide; a task (not a microtask)
        // so the engagement listener runs first and both travel together.
        setTimeout(() => {
          if (pendingVitals.length) send(pendingVitals.splice(0, pendingVitals.length), true);
        }, 0);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('click', onClick, { capture: true });

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener(INSIGHTS_ACTION_EVENT, onAction);
      flush(false);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [pathname]);

  return null;
}
