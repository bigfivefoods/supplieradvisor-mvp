'use client';

import { toast } from 'sonner';
import {
  ApparelLoadingBlock,
  ApparelgraphWorkbench,
  useApparelgraph,
} from '@/components/apparel/ApparelgraphWorkbench';

export default function ApparelgraphPortalPage() {
  const { store, loading, saving, post } = useApparelgraph();

  const ensure = async () => {
    await post({ action: 'ensure_portal' });
    toast.success('Buyer line-sheet PWA ready');
  };

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <ApparelgraphWorkbench
      title="Portal"
      description="Buyer PWA for live available-to-sell on the line sheet. Reps and wholesale accounts see the same ATS the factory is sewing — no overselling, no Stripe, invoices stay on Customers Trade."
    >
      {loading || !store ? (
        <ApparelLoadingBlock />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 space-y-2">
            <div className="font-black">Wholesale line-sheet PWA</div>
            {store.settings.public_token ? (
              <p className="font-mono text-xs break-all">
                {origin}/apparel/{store.settings.public_token}
              </p>
            ) : (
              <p className="text-slate-500">No token yet.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void ensure()}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                {store.settings.public_token ? 'Keep public PWA' : 'Issue public PWA'}
              </button>
              {store.settings.public_token ? (
                <button
                  type="button"
                  onClick={() => void copy(`/apparel/${store.settings.public_token}`)}
                  className="btn-secondary !py-2 !px-3 text-sm"
                >
                  Copy link
                </button>
              ) : null}
            </div>
          </div>
          {store.portals
            .filter((p) => p.kind !== 'public')
            .map((p) => (
              <div
                key={p.token}
                className="rounded-2xl border border-cyan-200 bg-white p-4 space-y-1"
              >
                <div className="font-black">
                  {p.kind} · {p.label || p.token}
                </div>
                <p className="font-mono text-xs break-all">
                  {origin}/apparel/{p.token}
                </p>
              </div>
            ))}
        </div>
      )}
    </ApparelgraphWorkbench>
  );
}
