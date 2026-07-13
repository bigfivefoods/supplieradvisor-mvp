'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Share2,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type Share = {
  id: number;
  token: string;
  title?: string | null;
  is_active?: boolean;
  show_metrics?: boolean;
  show_list?: boolean;
  show_contractors?: boolean;
  show_photos?: boolean;
  brand_name?: string | null;
  brand_url?: string | null;
  publicUrl?: string;
  embedHtml?: string;
};

export default function ContainersSettings() {
  return (
    <CompanyRequired>
      <SettingsInner />
    </CompanyRequired>
  );
}

function SettingsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null);

  const [title, setTitle] = useState('Container network');
  const [brandName, setBrandName] = useState('Big Five Group');
  const [brandUrl, setBrandUrl] = useState('https://www.bigfivegroup.africa');
  const [showMetrics, setShowMetrics] = useState(true);
  const [showList, setShowList] = useState(true);
  const [showContractors, setShowContractors] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/containers/share?companyId=${companyId}`);
      const data = await res.json();
      if (data.migration_required) {
        setMigrationHint(
          data.warning ||
            'Run supabase/migrations/20260712_container_network_share.sql'
        );
        setShare(null);
        return;
      }
      setMigrationHint(null);
      const active =
        (data.shares || []).find((s: Share) => s.is_active) ||
        data.shares?.[0] ||
        null;
      setShare(active);
      if (active) {
        setTitle(active.title || 'Container network');
        setBrandName(active.brand_name || 'Big Five Group');
        setBrandUrl(active.brand_url || 'https://www.bigfivegroup.africa');
        setShowMetrics(active.show_metrics !== false);
        setShowList(active.show_list !== false);
        setShowContractors(Boolean(active.show_contractors));
        setShowPhotos(Boolean(active.show_photos));
      }
    } catch {
      toast.error('Failed to load share settings');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createOrGet = async (rotate = false) => {
    setSaving(true);
    try {
      const res = await fetch('/api/containers/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          rotate,
          title,
          brandName,
          brandUrl,
          showMetrics,
          showList,
          showContractors,
          showPhotos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      setShare(data.share);
      toast.success(rotate ? 'New share link created' : 'Share link ready');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const saveFlags = async () => {
    if (!share?.id) {
      await createOrGet(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/containers/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: share.id,
          title,
          brandName,
          brandUrl,
          showMetrics,
          showList,
          showContractors,
          showPhotos,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShare(data.share);
      toast.success('Share settings saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!share?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/containers/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: share.id,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShare(null);
      toast.success('Public share disabled');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (kind: 'url' | 'embed', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === 'url' ? 'Link copied' : 'Embed code copied');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Container"
        titleAccent="settings"
        description="Network defaults and public share for embedding the live map + metrics on your website."
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong> {migrationHint}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-4">
          {/* Public share for bigfivegroup.africa */}
          <Panel title="Public map & metrics (website embed)">
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Share a live, read-only view of your container network — map pins and
                high-level metrics — on{' '}
                <strong className="text-slate-900">www.bigfivegroup.africa</strong>{' '}
                (or any site) via iframe. No login required for visitors.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600 block">
                  Title
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 block">
                  Brand name
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </label>
                <label className="text-xs font-bold text-slate-600 block sm:col-span-2">
                  Brand website URL
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={brandUrl}
                    onChange={(e) => setBrandUrl(e.target.value)}
                    placeholder="https://www.bigfivegroup.africa"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <Toggle
                  label="Show metrics"
                  checked={showMetrics}
                  onChange={setShowMetrics}
                />
                <Toggle
                  label="Show outlet list"
                  checked={showList}
                  onChange={setShowList}
                />
                <Toggle
                  label="Show contractor names"
                  checked={showContractors}
                  onChange={setShowContractors}
                />
                <Toggle
                  label="Show photos"
                  checked={showPhotos}
                  onChange={setShowPhotos}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createOrGet(false)}
                  className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  {share ? 'Refresh link' : 'Create public share link'}
                </button>
                {share && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveFlags()}
                      className="btn-secondary !py-2.5 !px-4 text-sm"
                    >
                      Save options
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void createOrGet(true)}
                      className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Rotate token
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deactivate()}
                      className="text-sm font-semibold text-red-600 px-3"
                    >
                      Disable share
                    </button>
                  </>
                )}
              </div>

              {share?.publicUrl && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Public URL
                    </div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono bg-slate-50"
                        value={share.publicUrl}
                      />
                      <button
                        type="button"
                        onClick={() => void copy('url', share.publicUrl!)}
                        className="btn-secondary !py-2 !px-3 text-sm"
                      >
                        {copied === 'url' ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <a
                        href={share.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary !py-2 !px-3 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Embed on bigfivegroup.africa
                    </div>
                    <textarea
                      readOnly
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-mono bg-slate-50 min-h-[120px]"
                      value={share.embedHtml || ''}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copy('embed', share.embedHtml || '')
                      }
                      className="mt-2 btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
                    >
                      {copied === 'embed' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copy iframe code
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Paste the iframe into your WordPress / Webflow / custom page. No API key
                    needed. Data is sanitised (no finance, no private contractor contacts unless
                    you enable names).
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Default commission rate">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  defaultValue={15}
                  className="input !w-24 !p-3 !text-center !text-lg font-semibold"
                />
                <span className="text-neutral-600 font-medium">%</span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Default commission when creating new contractor contracts.
              </p>
            </div>
          </Panel>

          <Panel title="Quick links">
            <div className="p-5 flex flex-wrap gap-2 text-sm">
              <a
                href="/dashboard/containers/map"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:border-[#00b4d8]"
              >
                <Link2 className="w-3.5 h-3.5" /> Internal map
              </a>
              <a
                href="/dashboard/containers/metrics"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:border-[#00b4d8]"
              >
                Internal metrics
              </a>
            </div>
          </Panel>
        </div>
      )}
    </ContainersPage>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-[#00b4d8] focus:ring-[#00b4d8]"
      />
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </label>
  );
}
