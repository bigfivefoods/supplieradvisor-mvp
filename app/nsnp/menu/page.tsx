'use client';

/**
 * Parent / SGB public weekly menu (no login).
 * /nsnp/menu?token=…  or  ?emis=…&pin=…
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, UtensilsCrossed } from 'lucide-react';

function MenuInner() {
  const sp = useSearchParams();
  const token = sp.get('token');
  const emis = sp.get('emis');
  const pinQ = sp.get('pin');
  const [pin, setPin] = useState(pinQ || '');
  const [emisInput, setEmisInput] = useState(emis || '');
  const [loading, setLoading] = useState(Boolean(token || (emis && pinQ)));
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(
    async (opts?: { emis?: string; pin?: string; token?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (opts?.token || token) q.set('token', opts?.token || token || '');
        if (opts?.emis || emisInput) q.set('emis', opts?.emis || emisInput);
        if (opts?.pin || pin) q.set('pin', opts?.pin || pin);
        const res = await fetch(`/api/public/nsnp-menu?${q}`, {
          cache: 'no-store',
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Not found');
        setData(j);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [token, emisInput, pin]
  );

  useEffect(() => {
    if (token || (emis && pinQ)) void load();
  }, [token, emis, pinQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const school = (data?.school || {}) as Record<string, unknown>;
  const menu = (data?.menu || {}) as Record<string, unknown>;
  const week = (menu.week || []) as Array<{ day: string; dishes: string[] }>;
  const served = (data?.served_recent || []) as Array<Record<string, unknown>>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="bg-gradient-to-r from-[#0077b6] to-[#00b4d8] text-white px-5 py-8">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest opacity-90">
            NSNP · Parent / SGB
          </p>
          <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7" /> Weekly school menu
          </h1>
          {school.name ? (
            <p className="mt-2 text-sky-100 text-sm">
              {String(school.name)}
              {school.emis ? ` · EMIS ${school.emis}` : ''}
              {school.district ? ` · ${school.district}` : ''}
            </p>
          ) : null}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {!data && !loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm text-slate-600">
              Enter school EMIS and PIN from the school, or open the link they
              shared.
            </p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="EMIS number"
              value={emisInput}
              onChange={(e) => setEmisInput(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="PIN"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void load()}
              className="w-full rounded-xl bg-[#0077b6] text-white font-bold py-3 text-sm"
            >
              View menu
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b font-black text-sm">
                {String(menu.name || 'This week')}
              </div>
              <ul className="divide-y">
                {week.map((d) => (
                  <li key={d.day} className="px-4 py-3 flex gap-3">
                    <span className="w-10 font-black text-[#0077b6] text-sm">
                      {d.day}
                    </span>
                    <span className="text-sm text-slate-700">
                      {d.dishes.length
                        ? d.dishes.join(' · ')
                        : '— not set —'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
              <h2 className="text-sm font-black text-emerald-950 mb-2">
                Recently served
              </h2>
              {served.length === 0 ? (
                <p className="text-xs text-slate-600">No serve days logged yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {served.slice(0, 10).map((f, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {String(f.date).slice(0, 10)} · {String(f.meal || 'meal')}
                        {f.menu ? ` · ${String(f.menu)}` : ''}
                      </span>
                      <span className="font-bold tabular-nums">
                        {Number(f.served || 0)} meals
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[11px] text-slate-400 text-center">
              SupplierAdvisor · NSNP transparency for parents &amp; SGB
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function PublicNsnpMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <MenuInner />
    </Suspense>
  );
}
