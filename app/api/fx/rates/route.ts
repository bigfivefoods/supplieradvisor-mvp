import { NextRequest, NextResponse } from 'next/server';
import type { FxRatesPayload } from '@/lib/fx/types';
import { TRADE_CURRENCIES } from '@/lib/fx/types';

/**
 * GET /api/fx/rates?base=USD
 * Live FX rates for multi-currency quoting / invoicing.
 * Uses Frankfurter (ECB reference rates, no API key). Falls back to cached statics if offline.
 *
 * Returns rates as: units of each currency per 1 unit of base (default USD).
 */

// Soft in-memory cache (server instance)
let cache: { at: number; payload: FxRatesPayload } | null = null;
const CACHE_MS = 15 * 60 * 1000; // 15 min

/** Approximate fallback vs USD if API unreachable (indicative only). */
const FALLBACK_USD: Record<string, number> = {
  USD: 1,
  ZAR: 18.5,
  EUR: 0.92,
  GBP: 0.79,
  KES: 129,
  NAD: 18.5,
  BWP: 13.6,
  ZMW: 27,
  MZN: 63.8,
  NGN: 1550,
  AED: 3.67,
  CNY: 7.25,
};

export async function GET(request: NextRequest) {
  try {
    const base = (request.nextUrl.searchParams.get('base') || 'USD').toUpperCase();
    const symbolsParam = request.nextUrl.searchParams.get('symbols');
    const symbols = symbolsParam
      ? symbolsParam
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : [...TRADE_CURRENCIES];

    if (cache && Date.now() - cache.at < CACHE_MS && cache.payload.base === base) {
      return NextResponse.json({ success: true, ...cache.payload, cached: true });
    }

    const symbolsQ = symbols.filter((s) => s !== base).join(',');
    let payload: FxRatesPayload | null = null;

    // Prefer frankfurter.dev v1, then frankfurter.app
    const urls = [
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbolsQ)}`,
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(symbolsQ)}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          next: { revalidate: 900 },
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          base?: string;
          amount?: number;
          date?: string;
          rates?: Record<string, number>;
        };
        if (!data.rates || typeof data.rates !== 'object') continue;

        const rates: Record<string, number> = { [base]: 1 };
        for (const [k, v] of Object.entries(data.rates)) {
          rates[k.toUpperCase()] = Number(v);
        }
        // Ensure trade set present even if API omitted some
        for (const c of TRADE_CURRENCIES) {
          if (rates[c] == null && FALLBACK_USD[c] != null && base === 'USD') {
            rates[c] = FALLBACK_USD[c];
          }
        }

        payload = {
          base,
          date: data.date || null,
          rates,
          source: url.includes('frankfurter.dev') ? 'frankfurter.dev' : 'frankfurter.app',
          fetchedAt: new Date().toISOString(),
        };
        break;
      } catch {
        /* try next */
      }
    }

    if (!payload) {
      // Fallback: static USD-based table; convert if base != USD
      const rates: Record<string, number> = {};
      if (base === 'USD') {
        Object.assign(rates, FALLBACK_USD);
      } else {
        const basePerUsd = FALLBACK_USD[base] || 1;
        for (const [c, perUsd] of Object.entries(FALLBACK_USD)) {
          rates[c] = perUsd / basePerUsd;
        }
        rates[base] = 1;
      }
      payload = {
        base,
        date: null,
        rates,
        source: 'static-fallback',
        fetchedAt: new Date().toISOString(),
        stale: true,
        warning:
          'Live FX unavailable — showing approximate reference rates. Do not use for settlement.',
      };
    }

    cache = { at: Date.now(), payload };

    return NextResponse.json({ success: true, ...payload, cached: false });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'FX error' },
      { status: 500 }
    );
  }
}
