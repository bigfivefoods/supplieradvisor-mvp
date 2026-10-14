'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { customerAppPath, isPublicTradeToken } from '@/lib/trades/tradegraph';

export default function TradegraphJoinTokenPage() {
  const { token } = useParams() as { token: string };
  const safe = isPublicTradeToken(token) ? token : '';
  const [brand, setBrand] = useState('TradeAdvisor');
  const [city, setCity] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!safe) {
      setMissing(true);
      return;
    }
    let cancelled = false;
    void fetch(`/api/public/tradegraph?token=${encodeURIComponent(safe)}`)
      .then(async (res) => {
        const data = (await res.json()) as { brand?: string; city?: string };
        if (cancelled) return;
        if (!res.ok) {
          setMissing(true);
          return;
        }
        if (data.brand) setBrand(data.brand);
        if (data.city) setCity(data.city);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [safe]);

  return (
    <main className="mx-auto min-h-dvh max-w-sm px-5 py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
        TradeAdvisor®
      </p>
      <h1 className="mt-3 text-2xl font-black">{missing ? 'Link not found' : brand}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {missing
          ? 'This invite does not match a trade book. This page is not a supplier claim.'
          : `${city ? `${city}. ` : ''}Job progress, your statement, and new requests live in the customer app. This page is not a supplier claim.`}
      </p>
      {safe && !missing ? (
        <Link
          href={customerAppPath(safe)}
          className="mt-6 inline-flex rounded-full bg-[#00b4d8] px-5 py-3 text-sm font-bold text-white"
        >
          Open your jobs
        </Link>
      ) : null}
    </main>
  );
}
