'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SCENES = [
  {
    id: 'b2b',
    code: 'B2B',
    title: 'Business to business',
    line: 'Verified trade. One operating system.',
    src: '/marketing/hero-b2b.jpg',
    alt: 'Warehouse operations beside a glass control room',
  },
  {
    id: 'b2g',
    code: 'B2G',
    title: 'Business to government',
    line: 'Transparent procurement. Audit-ready trails.',
    src: '/marketing/hero-b2g.jpg',
    alt: 'Civic plaza and public-sector offices at dusk',
  },
  {
    id: 'b2c',
    code: 'B2C',
    title: 'Business to consumer',
    line: 'One personal wallet. Any brand on the network.',
    src: '/marketing/hero-b2c.jpg',
    alt: 'Member using SA Member on their phone',
  },
] as const;

export default function HeroAudienceStage() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % SCENES.length);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  const scene = SCENES[i];

  return (
    <div className="relative">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80 dark:ring-white/10 sm:rounded-[2rem]">
        {SCENES.map((s, idx) => (
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
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-center"
            />
          </div>
        ))}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-cyan-200">
            {scene.code}
          </p>
          <p className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
            {scene.title}
          </p>
          <p className="mt-1 max-w-md text-sm text-white/80 sm:text-base">
            {scene.line}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 lg:justify-start">
        {SCENES.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setI(idx)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all ${
              idx === i
                ? 'bg-[#00b4d8] text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[#0077b6] dark:bg-neutral-950 dark:text-neutral-300 dark:ring-neutral-700'
            }`}
            aria-pressed={idx === i}
            aria-label={`Show ${s.title}`}
          >
            {s.code}
          </button>
        ))}
      </div>
    </div>
  );
}
