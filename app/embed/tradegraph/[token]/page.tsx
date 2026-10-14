import Link from 'next/link';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import { HARBOUR_NOW } from '@/lib/trades/desk';
import { isPublicTradeToken } from '@/lib/trades/tradegraph';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ token: string }> };

export default async function EmbedTradePage({ params }: Props) {
  const { token } = await params;
  if (!isPublicTradeToken(token)) notFound();
  const book = seedHarbourBook(HARBOUR_NOW);
  const brand = token === 'demo' || token === 'tg_harbour' ? book.store.settings.brand_name : 'TradeAdvisor®';
  const city = token === 'demo' || token === 'tg_harbour' ? book.store.settings.city : '';
  const slots = book.store.schedule.slice(0, 3);
  return (
    <main className="min-h-dvh bg-[#f4f7fb] p-4 text-slate-900">
      <article className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-2 rounded-full bg-[#00b4d8]" />
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">Book a visit</p>
        <h1 className="text-2xl font-black">{brand}</h1>
        <p className="text-sm text-slate-600">{city} · Plumbing</p>
        <ul className="mt-4 space-y-2 text-sm">
          {(token === 'demo' || token === 'tg_harbour' ? slots : []).map((slot) => (
            <li key={slot.id} className="rounded-2xl bg-slate-50 px-3 py-2">
              {slot.starts_at.slice(0, 16).replace('T', ' ')} · {slot.title}
            </li>
          ))}
        </ul>
        <Link className="mt-4 inline-block rounded-full bg-[#00b4d8] px-4 py-2.5 text-sm font-bold text-[#0f172a]" href={`/customer/tradegraph/${encodeURIComponent(token)}`}>
          Open the customer app
        </Link>
      </article>
    </main>
  );
}
