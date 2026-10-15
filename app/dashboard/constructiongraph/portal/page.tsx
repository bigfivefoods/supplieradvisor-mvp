'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ConstructionLoadingBlock,
  ConstructiongraphWorkbench,
  useConstructiongraph,
} from '@/components/construction/ConstructiongraphWorkbench';

type PortalRow = {
  id?: string;
  kind: 'public' | 'client' | 'contractor';
  label?: string;
  client_id?: string | null;
  site_id?: string | null;
  token_hint?: string;
  created_at?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  legacy?: boolean;
};

type IssuedLink = {
  id: string;
  kind: string;
  token: string;
  path: string;
};

function portalStatus(portal: PortalRow): 'Active' | 'Revoked' | 'Expired' {
  if (portal.revoked_at) return 'Revoked';
  if (portal.expires_at && Date.parse(portal.expires_at) <= Date.now()) return 'Expired';
  return 'Active';
}

function isLive(portal: PortalRow): boolean {
  return portalStatus(portal) === 'Active';
}

export default function ConstructiongraphPortalPage() {
  const { store, loading, saving, post } = useConstructiongraph();
  const [shown, setShown] = useState<IssuedLink[] | null>(null);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';

  const remember = (data: { issued?: IssuedLink | IssuedLink[] } | undefined) => {
    if (!data?.issued) return;
    setShown(Array.isArray(data.issued) ? data.issued : [data.issued]);
  };

  const ensure = async () => {
    const data = await post({ action: 'ensure_portal' });
    remember(data);
    if (data?.issued) toast.success('Public link issued');
  };

  const mintClient = async (clientId: string) => {
    const data = await post({ action: 'ensure_client_portal', clientId });
    remember(data);
    if (data?.issued) toast.success('Client link issued');
  };

  const mintContractor = async (siteId: string) => {
    const data = await post({ action: 'ensure_contractor_portal', siteId });
    remember(data);
    if (data?.issued) toast.success('Site team link issued');
  };

  const revoke = async (portalId: string) => {
    await post({ action: 'revoke_portal', portalId });
    toast.success('Link revoked');
  };

  const reissue = async (portalId: string) => {
    const data = await post({ action: 'reissue_portal', portalId });
    remember(data);
    if (data?.issued) toast.success('Link reissued');
  };

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const portals = (store?.portals || []) as PortalRow[];

  return (
    <ConstructiongraphWorkbench
      title="Portal"
      description="External B2C PWA for clients (their projects, quotes, programme, snags) and contractors (assigned project plan and actuals). Internal staff keep using this desk."
    >
      {loading || !store ? (
        <ConstructionLoadingBlock />
      ) : (
        <div className="space-y-4 text-sm">
          {shown?.length ? (
            <div
              className="rounded-2xl border border-stone-300 p-4 space-y-2"
              style={{ background: '#00b4d8', color: '#0f172a' }}
            >
              <p className="font-black">
                This link is shown once. Copy it now; if you lose it, reissue.
              </p>
              {shown.map((link) => (
                <div key={link.id} className="space-y-2">
                  <p className="font-mono text-xs break-all">
                    {origin}
                    {link.path}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(link.path)}
                    className="btn-secondary !py-2 !px-3 text-sm"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <PortalCard
            title="Public construction PWA"
            blurb="Clients and site contractors install this on their phone. The public link shows names, statuses and percentages. A client link shows only that customer’s projects. A site-team link is one project."
            portal={portals.find((portal) => portal.kind === 'public' && isLive(portal))}
            saving={saving}
            issueLabel="Issue public PWA"
            onIssue={() => void ensure()}
            onRevoke={(id) => void revoke(id)}
            onReissue={(id) => void reissue(id)}
          />

          {store.clients.map((client) => (
            <PortalCard
              key={client.id}
              title={`Client · ${client.name}`}
              portal={portals.find(
                (portal) =>
                  portal.kind === 'client' && portal.client_id === client.id && isLive(portal)
              )}
              saving={saving}
              issueLabel="Issue client PWA"
              onIssue={() => void mintClient(client.id)}
              onRevoke={(id) => void revoke(id)}
              onReissue={(id) => void reissue(id)}
            />
          ))}

          {store.sites.map((site) => (
            <PortalCard
              key={site.id}
              title={`Contractor · ${site.code} · ${site.name}`}
              portal={portals.find(
                (portal) =>
                  portal.kind === 'contractor' && portal.site_id === site.id && isLive(portal)
              )}
              saving={saving}
              issueLabel="Issue contractor PWA"
              onIssue={() => void mintContractor(site.id)}
              onRevoke={(id) => void revoke(id)}
              onReissue={(id) => void reissue(id)}
            />
          ))}

          {portals.filter((portal) => !isLive(portal)).map((portal) => (
            <PortalCard
              key={portal.id || `${portal.kind}-${portal.token_hint}`}
              title={`${portal.kind} · ${portal.label || 'Link'}`}
              portal={portal}
              saving={saving}
              onRevoke={(id) => void revoke(id)}
              onReissue={(id) => void reissue(id)}
            />
          ))}
        </div>
      )}
    </ConstructiongraphWorkbench>
  );
}

function PortalCard({
  title,
  blurb,
  portal,
  saving,
  issueLabel,
  onIssue,
  onRevoke,
  onReissue,
}: {
  title: string;
  blurb?: string;
  portal?: PortalRow;
  saving: boolean;
  issueLabel?: string;
  onIssue?: () => void;
  onRevoke: (id: string) => void;
  onReissue: (id: string) => void;
}) {
  const status = portal ? portalStatus(portal) : null;
  return (
    <div className="rounded-2xl border border-stone-300 bg-white p-4 space-y-2">
      <div className="font-black">{title}</div>
      {blurb ? <p className="text-stone-600">{blurb}</p> : null}
      {portal ? (
        <div className="space-y-2">
          <p className="font-mono text-xs break-all">…{portal.token_hint || '????'}</p>
          <p className="text-xs text-stone-500">
            {portal.kind}
            {portal.label ? ` · ${portal.label}` : ''}
            {portal.created_at ? ` · ${portal.created_at.slice(0, 10)}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {status ? <Chip>{status}</Chip> : null}
            {portal.legacy ? <Chip>Old format link, reissue recommended</Chip> : null}
          </div>
        </div>
      ) : (
        <p className="text-stone-500 text-xs">No link yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!portal && onIssue && issueLabel ? (
          <button
            type="button"
            disabled={saving}
            onClick={onIssue}
            className="btn-primary !py-2 !px-4 text-sm"
          >
            {issueLabel}
          </button>
        ) : null}
        {portal?.id && status === 'Active' ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => onRevoke(portal.id as string)}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            Revoke
          </button>
        ) : null}
        {portal?.id ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => onReissue(portal.id as string)}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            Reissue
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-black"
      style={{ background: '#00b4d8', color: '#0f172a' }}
    >
      {children}
    </span>
  );
}
