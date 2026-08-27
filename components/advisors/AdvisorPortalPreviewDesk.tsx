'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AdvisorGrowPreviews } from '@/components/advisors/AdvisorGrowPreviews';
import {
  growPreviewCopy,
  type GrowPreviewSettings,
} from '@/lib/advisors/grow-preview';
import {
  PORTAL_SECTIONS,
  readPortalSectionMap,
  type AdvisorPortalModule,
  type PortalSectionSettings,
} from '@/lib/advisors/portal-sections';
import { AdvisorMemberPwaCard } from '@/components/advisors/AdvisorMemberPwaCard';
import type { AdvisorPwaSettings } from '@/lib/advisors/member-pwa';

export function AdvisorPortalPreviewDesk({
  module,
  eyebrow,
  embedPath,
  settings,
  onSave,
  onSavePwa,
  saving,
  websiteHref,
}: {
  module: AdvisorPortalModule;
  eyebrow: string;
  embedPath: string;
  settings?: (PortalSectionSettings & GrowPreviewSettings) | null;
  onSave: (sections: Record<string, boolean>) => void | Promise<void>;
  onSavePwa: (patch: AdvisorPwaSettings) => void | Promise<void>;
  saving?: boolean;
  websiteHref: string;
}) {
  const catalog = PORTAL_SECTIONS[module];
  const copy = growPreviewCopy(module);
  const [draft, setDraft] = useState<Record<string, boolean>>(() =>
    readPortalSectionMap(module, settings)
  );
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    setDraft(readPortalSectionMap(module, settings));
  }, [module, settings]);

  const liveHref = useMemo(() => {
    if (!embedPath) return '';
    if (typeof window === 'undefined') return embedPath;
    return `${window.location.origin}${embedPath}`;
  }, [embedPath]);

  const toggle = (id: string) => {
    setDraft((d) => ({ ...d, [id]: d[id] === false ? true : false }));
  };

  const save = async () => {
    await onSave(draft);
    setFrameKey((n) => n + 1);
  };

  const publicToken = String(
    (settings as { public_token?: string } | null | undefined)?.public_token ||
      ''
  );

  return (
    <div className="space-y-5">
      <AdvisorMemberPwaCard
        module={module}
        publicToken={publicToken}
        settings={(settings || {}) as Record<string, unknown>}
        saving={saving}
        onSave={onSavePwa}
      />
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {module === 'fitgraph'
          ? 'Members install your gym’s own home-screen app (your brand, not generic SA Member). Click through every member tab (Class, After class, Progress, Programme, You, Shop, Share) and coach tab (Today, Diary, You, People, Inbox). Toggle light and dark. Tick what to show on the website, save, then the live preview refreshes if you have published it.'
          : module === 'hiregraph'
            ? 'Customers install your hire desk’s own home-screen app (your brand, not generic SA Member). Click through every customer screen (Search, Hire, You, Docs, Calendar, Track, History, Nearby). Toggle light and dark. There is no coach app. Tick what to show on the website, save, then the live preview refreshes if you have published it.'
          : `${copy.audience.charAt(0).toUpperCase()}${copy.audience.slice(1)} install your branded home-screen app — not generic SA Member. Tick what to show on the website, save, then the live preview refreshes if you have published it.`}
      </p>

      <AdvisorGrowPreviews
        module={module}
        eyebrow={eyebrow}
        settings={settings}
        embedPath={embedPath}
        websiteHref={websiteHref}
        websiteEnabled={settings?.enabled === true}
        frameKey={frameKey}
        placement="view-portal"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Show on website
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((s) => (
            <label
              key={s.id}
              className="flex items-start gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-white/10"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft[s.id] !== false}
                onChange={() => toggle(s.id)}
              />
              <span>
                <span className="font-bold">{s.label}</span>
                {s.hint ? (
                  <span className="block text-[11px] text-slate-500">
                    {s.hint}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-yellow-950"
          >
            Save what to show
          </button>
          {liveHref ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/15"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open live website
            </a>
          ) : (
            <a
              href={websiteHref}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
            >
              Publish a portal token on Website first
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
