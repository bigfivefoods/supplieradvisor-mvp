import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server-client';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'NSNP transparency pack',
    description: `Public NSNP audit summary ${token}`,
    robots: { index: true, follow: true },
  };
}

export default async function NsnpTransparencyPage({ params }: Props) {
  const { token } = await params;
  let pack: Record<string, unknown> | null = null;
  let error: string | null = null;

  try {
    const supabase = getSupabaseServer();
    const { data, error: e } = await supabase
      .from('nsnp_audit_packs')
      .select(
        'period_from, period_to, content_hash, pack_json, created_at, is_public'
      )
      .eq('public_token', token)
      .eq('is_public', true)
      .maybeSingle();
    if (e) error = e.message;
    else if (!data) error = 'Pack not found or not public';
    else pack = data as Record<string, unknown>;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  const json =
    pack?.pack_json && typeof pack.pack_json === 'object'
      ? (pack.pack_json as Record<string, unknown>)
      : null;
  const school =
    json?.school && typeof json.school === 'object'
      ? (json.school as Record<string, unknown>)
      : null;
  const totals =
    json?.totals && typeof json.totals === 'object'
      ? (json.totals as Record<string, unknown>)
      : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
            SupplierAdvisor · NSNP transparency
          </p>
          <h1 className="text-2xl font-black mt-1">
            Public school nutrition pack
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Read-only evidence summary for programme accountability.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {error || !pack ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="font-bold">{error || 'Not found'}</p>
            <Link href="/" className="text-sm font-bold text-[#0077b6] mt-3 inline-block">
              ← SupplierAdvisor
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-black">
                {String(school?.name || 'School')}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                EMIS {String(school?.emis || '—')} ·{' '}
                {[school?.district, school?.province].filter(Boolean).join(', ') ||
                  '—'}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Period {String(pack.period_from)} → {String(pack.period_to)} ·
                Generated {String(pack.created_at || '').slice(0, 10)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <div className="text-2xl font-black tabular-nums">
                  {Number(totals?.meals_served || 0)}
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Meals served
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <div className="text-2xl font-black tabular-nums">
                  {Number(totals?.po_spend || 0).toLocaleString('en-ZA')}
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Food spend (ZAR)
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <div className="text-2xl font-black tabular-nums">
                  {Number(totals?.visits || 0)}
                </div>
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  PEU visits
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                Content hash (integrity)
              </p>
              <code className="text-xs break-all font-mono text-slate-700">
                {String(pack.content_hash)}
              </code>
              <p className="text-[11px] text-slate-500 mt-2">
                Hash covers the sealed pack body. Compare with the school’s
                internal audit record for tamper-evidence.
              </p>
            </div>

            <p className="text-center text-xs text-slate-400">
              Powered by{' '}
              <Link href="/" className="font-semibold text-[#0077b6]">
                SupplierAdvisor
              </Link>{' '}
              · National School Nutrition Programme operations
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
