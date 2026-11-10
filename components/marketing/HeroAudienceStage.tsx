'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { localizedPath } from '@/lib/i18n/config';

const SCENES = [
  {
    id: 'b2b',
    code: 'B2B',
    src: '/marketing/hero-b2b.jpg',
    alt: 'Warehouse operations beside a glass control room',
    imageClass: 'object-[28%_center] sm:object-[32%_center] lg:object-left',
  },
  {
    id: 'b2g',
    code: 'B2G',
    src: '/marketing/hero-b2g.jpg',
    alt: 'Civic plaza and public-sector offices at dusk',
    imageClass: 'object-[38%_center] sm:object-[42%_center] lg:object-[36%_center]',
  },
  {
    id: 'b2c',
    code: 'B2C',
    src: '/marketing/hero-b2c.jpg',
    alt: 'Member using SA Member on their phone',
    imageClass: 'object-[22%_18%] sm:object-[20%_22%] lg:object-[18%_center]',
  },
] as const;

export default function HeroAudienceStage() {
  const [i, setI] = useState(0);
  const [mountedScenes, setMountedScenes] = useState<number[]>([0]);
  const { locale, t } = useLocaleDictionary();
  const bookDemoHref = `${localizedPath(locale, '/')}#book-demo`;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setI((n) => (n + 1) % SCENES.length);
    }, 8000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setMountedScenes((prev) => (prev.includes(i) ? prev : [...prev, i]));
  }, [i]);

  useEffect(() => {
    const arm = () => setMountedScenes(SCENES.map((_, idx) => idx));
    if (document.readyState === 'complete') {
      const id = window.setTimeout(arm, 1200);
      return () => window.clearTimeout(id);
    }
    const onLoad = () => {
      window.setTimeout(arm, 1200);
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  const scene = SCENES[i];
  const scenePrefix = `hero.scene.${scene.id}`;
  const sceneTitle = t(`${scenePrefix}.title`);
  const sceneBody = t(`${scenePrefix}.body`);
  const scenePoints = [
    t(`${scenePrefix}.point1`),
    t(`${scenePrefix}.point2`),
    t(`${scenePrefix}.point3`),
  ];

  return (
    <section id="platform" className="relative isolate min-h-[100svh] overflow-hidden bg-slate-950">
      {SCENES.map((s, idx) =>
        mountedScenes.includes(idx) ? (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              idx === i ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={idx !== i}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              priority={idx === 0}
              sizes="100vw"
              quality={75}
              className={`object-cover ${s.imageClass}`}
            />
          </div>
        ) : null
      )}

      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(to top, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.55) 28%, rgba(2,6,23,0.16) 52%, transparent 74%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to left, rgba(2,6,23,0.90) 0%, rgba(2,6,23,0.70) 26%, rgba(2,6,23,0.30) 50%, rgba(2,6,23,0.08) 66%, transparent 82%)',
        }}
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex min-h-[100svh] w-full max-w-screen-2xl">
        <div className="relative ml-auto flex w-full max-w-xl flex-col justify-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(var(--sa-nav-offset)+0.75rem)] sm:px-6 sm:pb-8 lg:w-[34rem] lg:max-w-[34rem] lg:justify-center lg:px-10 lg:pb-10 xl:w-[38rem] xl:max-w-[38rem]">
          <div className="w-full">
            <h1 className="text-[1.9rem] font-black leading-[1.04] tracking-[-0.048em] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-[3.35rem] xl:text-7xl">
              {t('hero.headlineLead')}
              <span className="mt-1 block text-[#67e8f9] sm:mt-1.5">{t('hero.headlineAccent')}</span>
            </h1>

            <p className="mt-3 font-mono text-[10px] font-bold tracking-[0.28em] text-cyan-200 sm:mt-5 sm:text-[11px]">
              {scene.code}
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-2xl lg:text-[1.65rem]">
              {sceneTitle}
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-slate-100 sm:text-base lg:text-[17px]">
              {sceneBody}
            </p>
            <ul className="mt-3 space-y-1.5">
              {scenePoints.map((pt) => (
                <li key={pt} className="text-sm font-medium text-slate-200">
                  <span className="me-2 text-cyan-300">•</span>
                  {pt}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/join"
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 transition-all hover:bg-[#0099b8] active:scale-[0.99] sm:min-h-12 sm:px-6 sm:text-[15px]"
              >
                Start free
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 rtl:-scale-x-100" />
              </Link>
              <Link
                href={bookDemoHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-slate-950/30 transition-all hover:bg-slate-100 active:scale-[0.99] sm:px-7 sm:text-[15px]"
              >
                {t('hero.bookDemo')}
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 rtl:-scale-x-100" />
              </Link>
            </div>

            <p className="mt-3 hidden text-xs leading-relaxed text-slate-300 sm:block sm:text-sm">
              {t('hero.notExcel')}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {SCENES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setMountedScenes((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
                    setI(idx);
                  }}
                  className={`min-h-9 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all ${
                    idx === i
                      ? 'bg-white text-slate-900'
                      : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'
                  }`}
                  aria-pressed={idx === i}
                  aria-label={`Show ${t(`hero.scene.${s.id}.title`)}`}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
