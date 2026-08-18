'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  PORTAL_SECTIONS,
  readPortalSectionMap,
  type AdvisorPortalModule,
  type PortalSectionSettings,
} from '@/lib/advisors/portal-sections';

export function AdvisorPortalPreviewDesk({
  module,
  eyebrow,
  embedPath,
  settings,
  onSave,
  saving,
  websiteHref,
}: {
  module: AdvisorPortalModule;
  eyebrow: string;
  embedPath: string;
  settings?: PortalSectionSettings | null;
  onSave: (sections: Record<string, boolean>) => void | Promise<void>;
  saving?: boolean;
  websiteHref: string;
}) {
  const catalog = PORTAL_SECTIONS[module];
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

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        This is the public {eyebrow} portal customers see. Tick what to show,
        save, then refresh the preview.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Show on portal
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
              Open live portal
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

      {liveHref ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-white/10 dark:bg-neutral-950">
            <span>Preview · as a customer sees it</span>
            <span className="truncate font-mono font-medium text-slate-400">
              {liveHref}
            </span>
          </div>
          <iframe
            key={frameKey}
            title={`${eyebrow} portal preview`}
            src={liveHref}
            className="h-[70vh] min-h-[480px] w-full bg-white"
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          Save Website once to issue a public link, then this page previews
          your portal.
        </p>
      )}
    </div>
  );
}
