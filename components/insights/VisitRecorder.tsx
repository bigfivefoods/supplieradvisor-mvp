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
  clipLabel,
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
} from '@/lib/insights/visitor';

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

function context(session: VisitSession, path: string): Omit<InsightEvent, 'k' | 'p'> {
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
    r: session.referrer,
    u: session.utm,
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

function send(events: InsightEvent[], beacon = false) {
  if (!events.length) return;
  const body = JSON.stringify({ v: 1, site: INSIGHTS_SITE, project: INSIGHTS_SITE, e: events.slice(0, 10) });
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(INSIGHTS_COLLECT_PATH, new Blob([body], { type: 'text/plain' }));
      return;
    }
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

function buttonLabel(el: Element): string | undefined {
  const labelled = el.getAttribute('aria-label') || '';
  if (el instanceof HTMLInputElement) return clipLabel(labelled || el.value);
  return clipLabel(labelled || el.textContent || '');
}

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

    const view: InsightEvent = { k: 'pageview', p: path, ...context(session, path) };
    if (maxScroll > 0) view.scroll = maxScroll;
    send([view]);

    const onScroll = () => measureScroll();
    const flush = (beacon: boolean) => {
      if (visibleSince) accumulated += Date.now() - visibleSince;
      visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
      const ms = accumulated;
      const scroll = maxScroll;
      accumulated = 0;
      maxScroll = 0;
      if (ms < 500 && scroll <= 0) return;
      send(
        [
          {
            k: 'engage',
            p: sentPage,
            ms: Math.min(ms, 36e5),
            scroll,
            ...context(session as VisitSession, sentPage),
            exit: sentPage,
          },
        ],
        beacon
      );
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
      if (!isButtonLike(el)) return;
      const label = buttonLabel(el);
      if (!label) return;
      send([{ k: 'click', p: sentPage, l: label, ...base }]);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('click', onClick, { capture: true });

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flush(false);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [pathname]);

  return null;
}
