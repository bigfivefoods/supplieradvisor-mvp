'use client';

import { toast } from 'sonner';
import {
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

export default function ConstructiongraphPortalPage() {
  const { store, loading, saving, post } = useConstructiongraph();

  const ensure = async () => {
    await post({ action: 'ensure_portal' });
    toast.success('Client / contractor PWA token ready');
  };

  const mintClient = async (clientId: string) => {
    await post({ action: 'ensure_client_portal', clientId });
    toast.success('Client PWA issued');
  };

  const mintContractor = async (siteId: string) => {
    await post({ action: 'ensure_contractor_portal', siteId });
    toast.success('Contractor PWA issued');
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
    <ConstructiongraphWorkbench
      title="Portal"
      description="External B2C PWA for clients (their projects, quotes, programme, snags) and contractors (assigned project plan and actuals). Internal staff keep using this desk."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-stone-300 bg-white p-4 space-y-2">
            <div className="font-black">Public construction PWA</div>
            <p className="text-stone-600">
              Clients and site contractors install this on their phone. The public link
              shows the programme roll-up; a client token shows only that customer’s
              projects; a contractor token is one project.
            </p>
            {store.settings.public_token ? (
              <p className="font-mono text-xs break-all">
                {origin}/construction/{store.settings.public_token}
              </p>
            ) : (
              <p className="text-stone-500">No token yet.</p>
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
                  onClick={() =>
                    void copy(`/construction/${store.settings.public_token}`)
                  }
                  className="btn-secondary !py-2 !px-3 text-sm"
                >
                  Copy link
                </button>
              ) : null}
            </div>
          </div>

          {store.clients.map((c) => {
            const portal = store.portals.find(
              (p) => p.kind === 'client' && p.client_id === c.id
            );
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-stone-300 bg-white p-4 space-y-2"
              >
                <div className="font-black">Client · {c.name}</div>
                {portal ? (
                  <p className="font-mono text-xs break-all">
                    {origin}/construction/{portal.token}
                  </p>
                ) : (
                  <p className="text-stone-500 text-xs">No client token yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void mintClient(c.id)}
                    className="btn-secondary !py-2 !px-3 text-xs"
                  >
                    {portal ? 'Reissue client PWA' : 'Issue client PWA'}
                  </button>
                  {portal ? (
                    <button
                      type="button"
                      onClick={() => void copy(`/construction/${portal.token}`)}
                      className="btn-secondary !py-2 !px-3 text-xs"
                    >
                      Copy link
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {store.sites.map((s) => {
            const portal = store.portals.find(
              (p) => p.kind === 'contractor' && p.site_id === s.id
            );
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-stone-300 bg-white p-4 space-y-2"
              >
                <div className="font-black">
                  Contractor · {s.code} · {s.name}
                </div>
                {portal ? (
                  <p className="font-mono text-xs break-all">
                    {origin}/construction/{portal.token}
                  </p>
                ) : (
                  <p className="text-stone-500 text-xs">No contractor token yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void mintContractor(s.id)}
                    className="btn-secondary !py-2 !px-3 text-xs"
                  >
                    {portal ? 'Reissue contractor PWA' : 'Issue contractor PWA'}
                  </button>
                  {portal ? (
                    <button
                      type="button"
                      onClick={() => void copy(`/construction/${portal.token}`)}
                      className="btn-secondary !py-2 !px-3 text-xs"
                    >
                      Copy link
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}
