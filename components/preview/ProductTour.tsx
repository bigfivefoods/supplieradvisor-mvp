'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { en, format, loadDict, resolveDict, t, type Dict } from '@/lib/i18n/dict';
import {
  PRODUCT_TOUR_STEPS,
  TOUR_DEMO_HREF,
  TOUR_TRIAL_HREF,
  productTourHref,
  resolveTourStep,
  type ProductTourStepId,
} from '@/lib/preview/product-tour';

type Spot = { top: number; left: number; width: number; height: number };

function readTourLocale(langParam: string | null): Locale {
  if (langParam && isLocale(langParam)) return langParam;
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )sa-locale=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : '';
  return isLocale(value) ? value : 'en';
}

function sameSpot(prev: Spot | null, next: Spot): boolean {
  if (!prev) return false;
  return (
    Math.abs(prev.top - next.top) < 1 &&
    Math.abs(prev.left - next.left) < 1 &&
    Math.abs(prev.width - next.width) < 1 &&
    Math.abs(prev.height - next.height) < 1
  );
}

function spotFromRect(rect: DOMRect, viewportH: number, viewportW: number): Spot {
  const margin = 12;
  const cardReserve = viewportW < 640 ? Math.min(300, Math.round(viewportH * 0.48)) : 220;
  const maxH = Math.max(150, viewportH - cardReserve - margin * 2);
  const top = Math.max(margin, Math.min(rect.top + 8, viewportH - 160));
  const height = Math.min(Math.max(rect.height - 16, 140), maxH, 440);
  const left = Math.max(margin, rect.left + 8);
  const width = Math.max(120, Math.min(rect.width - 16, viewportW - left - margin));
  return { top, left, width, height };
}

function useTourSpot(pathname: string, stepId: string): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    let frame = 0;
    let observed: Element | null = null;
    const ro = new ResizeObserver(() => schedule());

    const measure = () => {
      const el = document.querySelector('[data-tour-stage]');
      if (el !== observed) {
        if (observed) ro.unobserve(observed);
        observed = el;
        if (el) ro.observe(el);
      }
      if (!el) {
        setSpot(null);
        return;
      }
      const next = spotFromRect(el.getBoundingClientRect(), window.innerHeight, window.innerWidth);
      setSpot((prev) => (sameSpot(prev, next) ? prev : next));
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [pathname, stepId]);

  return spot;
}

export default function ProductTour() {
  const pathname = usePathname() || '/';
  const params = useSearchParams();
  const router = useRouter();
  const step = resolveTourStep(pathname, params.get('step'));
  const index = PRODUCT_TOUR_STEPS.findIndex((item) => item.id === step.id);
  const locale = readTourLocale(params.get('lang'));
  const [dict, setDict] = useState<Dict>(en);
  const [dictReady, setDictReady] = useState(locale === 'en');
  const spot = useTourSpot(pathname, step.id);

  useEffect(() => {
    let cancelled = false;
    if (locale === 'en') {
      setDict(en);
      setDictReady(true);
      return;
    }
    setDictReady(false);
    loadDict(locale).then((next) => {
      if (cancelled) return;
      setDict(resolveDict(next));
      setDictReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (params.get('tour') !== '1') return;
    const lang = params.get('lang');
    const langOk = locale === 'en' ? !lang : lang === locale;
    const onPath = pathname === step.path || pathname === `${step.path}/`;
    if (params.get('step') === step.id && langOk && onPath) return;
    router.replace(productTourHref(step.id, locale === 'en' ? undefined : locale), { scroll: false });
  }, [locale, params, pathname, router, step.id, step.path]);

  useEffect(() => {
    const title = document.getElementById('product-tour-title');
    title?.focus();
  }, [step.id, dictReady]);

  const indexRef = useRef(index);
  const localeRef = useRef(locale);
  indexRef.current = index;
  localeRef.current = locale;

  function exitTour() {
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    url.searchParams.delete('step');
    url.searchParams.delete('lang');
    const search = url.searchParams.toString();
    router.replace(search ? `${url.pathname}?${search}` : url.pathname, { scroll: false });
  }

  function go(delta: number) {
    const next = PRODUCT_TOUR_STEPS[index + delta];
    if (!next) return;
    router.push(productTourHref(next.id, locale === 'en' ? undefined : locale));
  }

  function jump(id: ProductTourStepId) {
    if (id === step.id) return;
    router.push(productTourHref(id, locale === 'en' ? undefined : locale));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      const activeLocale = localeRef.current;
      const activeIndex = indexRef.current;
      const forward = activeLocale === 'ar' ? 'ArrowLeft' : 'ArrowRight';
      const backward = activeLocale === 'ar' ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === 'Escape') {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.delete('tour');
        url.searchParams.delete('step');
        url.searchParams.delete('lang');
        const search = url.searchParams.toString();
        router.replace(search ? `${url.pathname}?${search}` : url.pathname, { scroll: false });
        return;
      }
      if (event.key !== forward && event.key !== backward) return;
      event.preventDefault();
      const delta = event.key === forward ? 1 : -1;
      const next = PRODUCT_TOUR_STEPS[activeIndex + delta];
      if (!next) return;
      router.push(productTourHref(next.id, activeLocale === 'en' ? undefined : activeLocale));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (!dictReady) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {spot ? (
        <div
          data-product-tour-spot
          className="absolute rounded-2xl ring-2 ring-[#00b4d8] shadow-[0_0_0_9999px_rgba(15,23,42,0.58)]"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/55" />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="product-tour-title"
        aria-describedby="product-tour-body"
        lang={locale}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="pointer-events-auto fixed inset-x-3 bottom-3 z-[81] mx-auto flex max-h-[min(70vh,32rem)] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-3xl border border-[#00b4d8] bg-white text-start shadow-2xl sm:inset-x-6 lg:inset-x-auto lg:bottom-6 lg:end-6 lg:w-[26rem]"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="h-1.5 shrink-0 bg-[#00b4d8]" aria-hidden />
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0077b6]">
                {t(dict, 'brand.supplierAdvisor')}
              </p>
              <p className="mt-1 inline-flex rounded-full bg-[#00b4d8]/10 px-2.5 py-1 text-[11px] font-bold text-[#0077b6]">
                {t(dict, 'tour.sample')}
              </p>
            </div>
            <button
              type="button"
              onClick={exitTour}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t(dict, 'tour.dismiss')}
            >
              <span aria-hidden className="text-xl leading-none">
                ×
              </span>
            </button>
          </div>

          <p className="mt-3 text-xs font-semibold text-slate-500">
            {format(t(dict, 'tour.progress'), {
              step: index + 1,
              total: PRODUCT_TOUR_STEPS.length,
            })}
          </p>
          <h2
            id="product-tour-title"
            tabIndex={-1}
            className="mt-1 text-xl font-black tracking-tight text-slate-950 outline-none"
          >
            {t(dict, step.titleKey)}
          </h2>
          <p id="product-tour-body" className="mt-2 text-sm leading-relaxed text-slate-600">
            {t(dict, step.bodyKey)}
          </p>

          <div
            className="mt-4 flex items-center gap-1.5"
            role="group"
            aria-label={format(t(dict, 'tour.progress'), {
              step: index + 1,
              total: PRODUCT_TOUR_STEPS.length,
            })}
          >
            {PRODUCT_TOUR_STEPS.map((item, itemIndex) => {
              const current = item.id === step.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  aria-label={t(dict, item.titleKey)}
                  onClick={() => jump(item.id)}
                  className="inline-flex h-11 w-6 items-center justify-center"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 rounded-full ${current ? 'w-6 bg-[#00b4d8]' : 'w-2.5 bg-slate-300'}`}
                  />
                  <span className="sr-only">
                    {format(t(dict, 'tour.progress'), {
                      step: itemIndex + 1,
                      total: PRODUCT_TOUR_STEPS.length,
                    })}
                  </span>
                </button>
              );
            })}
          </div>

          {step.final ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href={TOUR_TRIAL_HREF}
                data-tour-cta="trial"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#00b4d8] px-4 text-sm font-bold text-[#0f172a]"
              >
                {t(dict, 'home.startTrial')}
              </Link>
              <Link
                href={TOUR_DEMO_HREF}
                data-tour-cta="demo"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900"
              >
                {t(dict, 'hero.bookDemo')}
              </Link>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                {t(dict, 'tour.back')}
              </button>
              <button
                type="button"
                onClick={exitTour}
                className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-500"
              >
                {t(dict, 'tour.skip')}
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#00b4d8] px-5 text-sm font-bold text-[#0f172a]"
              >
                {t(dict, 'tour.next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
