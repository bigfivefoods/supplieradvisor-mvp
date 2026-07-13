'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Share2,
  ExternalLink,
  Map as MapIcon,
  Heart,
  BarChart3,
  Package,
  Users,
  FileText,
  Plus,
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
  show_impact?: boolean;
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
  const [showImpact, setShowImpact] = useState(true);

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
        setShowImpact(active.show_impact !== false);
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
          showImpact,
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
          showImpact,
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
        showNav
        title="Share"
        titleAccent="& settings"
        description="Public map embed for your website — people fed, jobs, and outlet locations. Use the Containers bar above to jump Map, Impact, Manage, and more."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/containers/map"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <MapIcon className="w-4 h-4" /> Map
            </Link>
            <Link
              href="/dashboard/containers/impact"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Heart className="w-4 h-4" /> Impact
            </Link>
            {share?.publicUrl && (
              <a
                href={share.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open public embed
              </a>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
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
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Panel title="Public map & impact (website embed)">
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Share a live, read-only view of your container network on{' '}
                  <strong className="text-slate-900">www.bigfivegroup.africa</strong>{' '}
                  (or any site) via iframe. Visitors see map pins, people fed, jobs
                  created, and outlets — no login required.
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
                    label="Show people fed & jobs (impact)"
                    checked={showImpact}
                    onChange={setShowImpact}
                  />
                  <Toggle
                    label="Show network metrics"
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
                      Paste the iframe into WordPress / Webflow / custom pages. No API
                      key. Data is sanitised (no finance; contractor names only if
                      enabled). Impact numbers use the same model as Containers →
                      Impact.
                    </p>
                  </div>
                )}
              </div>
            </Panel>

            {share?.publicUrl && (
              <Panel title="Live preview">
                <div className="p-3">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 h-[420px]">
                    <iframe
                      title="Container network preview"
                      src={share.publicUrl}
                      className="w-full h-full border-0"
                      loading="lazy"
                    />
                  </div>
                </div>
              </Panel>
            )}

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
          </div>

          <div className="space-y-4">
            <Panel title="Containers navigation">
              <ul className="p-3 space-y-1">
                {(
                  [
                    {
                      href: '/dashboard/containers',
                      label: 'Command hub',
                      icon: Package,
                    },
                    {
                      href: '/dashboard/containers/manage',
                      label: 'Manage outlets',
                      icon: Package,
                    },
                    {
                      href: '/dashboard/containers/map',
                      label: 'Map (people & jobs)',
                      icon: MapIcon,
                    },
                    {
                      href: '/dashboard/containers/impact',
                      label: 'Food security & jobs',
                      icon: Heart,
                    },
                    {
                      href: '/dashboard/containers/add',
                      label: 'Add container',
                      icon: Plus,
                    },
                    {
                      href: '/dashboard/containers/contractors',
                      label: 'Contractors',
                      icon: Users,
                    },
                    {
                      href: '/dashboard/containers/metrics',
                      label: 'Network metrics',
                      icon: BarChart3,
                    },
                    {
                      href: '/dashboard/containers/reports',
                      label: 'Reports',
                      icon: FileText,
                    },
                  ] as const
                ).map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-sky-50 hover:text-[#0077b6] transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-[#00b4d8] shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Impact assumptions">
              <div className="p-4 text-sm text-slate-600 leading-relaxed space-y-2">
                <p>
                  People fed and jobs on the public embed use the same company
                  assumptions as the internal Impact report.
                </p>
                <Link
                  href="/dashboard/containers/impact"
                  className="inline-flex items-center gap-1.5 font-bold text-[#0077b6] hover:underline"
                >
                  <Heart className="w-4 h-4" />
                  Edit meal price & jobs defaults
                </Link>
              </div>
            </Panel>
          </div>
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
