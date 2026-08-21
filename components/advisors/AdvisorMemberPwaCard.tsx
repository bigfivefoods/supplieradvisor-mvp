'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  advisorPwaAbsoluteUrl,
  advisorPwaIconPath,
  advisorPwaOgPath,
  advisorPwaShareCopy,
  advisorPwaWhatsAppBody,
  buildAdvisorPwaBrand,
  pwaSettingsPatch,
  readPwaSettings,
  type AdvisorPwaModule,
  type AdvisorPwaSettings,
} from '@/lib/advisors/member-pwa';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { whatsAppUrl } from '@/lib/services/advisor-whatsapp';
import { MEMBER_APP_QR_PRINT_SIZE, memberAppQrSrc } from '@/lib/b2c/member-app';

const inp =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-950';

export function AdvisorMemberPwaCard({
  module,
  publicToken,
  settings,
  onSave,
  saving,
}: {
  module: AdvisorPwaModule;
  publicToken?: string | null;
  settings?: Record<string, unknown> | null;
  onSave: (patch: AdvisorPwaSettings) => void | Promise<void>;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState<AdvisorPwaSettings>(() =>
    readPwaSettings(settings)
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(readPwaSettings(settings));
  }, [settings]);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';
  const token = String(publicToken || '').trim();
  const preview = useMemo(
    () =>
      buildAdvisorPwaBrand({
        module,
        publicToken: token || 'preview',
        companyId: 0,
        settings: {
          ...(settings || {}),
          ...draft,
          pwa_enabled: draft.pwa_enabled !== false,
        },
      }),
    [draft, module, settings, token]
  );
  const installUrl = token
    ? advisorPwaAbsoluteUrl(origin, module, token)
    : '';
  const qrSrc = installUrl ? memberAppQrSrc(installUrl, 280) : '';
  const qrPrintSrc = installUrl
    ? memberAppQrSrc(installUrl, MEMBER_APP_QR_PRINT_SIZE)
    : '';
  const ink = advisorBrandInk(preview.themeColor);
  const [qrBusy, setQrBusy] = useState(false);

  const save = async () => {
    await onSave(pwaSettingsPatch(draft));
    toast.success('Member app saved');
  };

  const copy = async () => {
    if (!installUrl) return;
    const share = advisorPwaShareCopy(preview, installUrl);
    const payload = `${share.text}\n${share.url}`;
    try {
      const ogPath = token
        ? advisorPwaOgPath(preview.module, token)
        : '';
      if (ogPath && typeof navigator.share === 'function') {
        const res = await fetch(ogPath);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File(
            [blob],
            `${(preview.shortName || 'member-app').replace(/\s+/g, '-').toLowerCase()}-install.png`,
            { type: 'image/png' }
          );
          const withFile = { title: share.title, text: share.text, url: share.url, files: [file] };
          if (navigator.canShare?.(withFile)) {
            await navigator.share(withFile);
            toast.success('Install card shared');
            return;
          }
        }
        await navigator.share({
          title: share.title,
          text: share.text,
          url: share.url,
        });
        toast.success('Install link shared');
        return;
      }
    } catch {
      /* cancelled or share unsupported — copy instead */
    }
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Install link copied');
  };

  const downloadQr = async () => {
    if (!qrPrintSrc) return;
    setQrBusy(true);
    const slug = (preview.shortName || preview.brandName || 'member-app')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const fileName = `${slug || 'member-app'}-pwa-qr.png`;
    try {
      const res = await fetch(qrPrintSrc);
      if (!res.ok) throw new Error('QR download failed');
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success('QR image saved');
    } catch {
      window.open(qrPrintSrc, '_blank', 'noopener,noreferrer');
    } finally {
      setQrBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {preview.advisorLabel} · member app
          </p>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Home-screen app for {preview.audience}
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-600 dark:text-slate-300">
            They install <span className="font-bold">{preview.brandName}</span>{' '}
            — your brand — not generic SA Member. Same desk underneath.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-white/15">
          <input
            type="checkbox"
            checked={draft.pwa_enabled !== false}
            onChange={(e) =>
              setDraft((d) => ({ ...d, pwa_enabled: e.target.checked }))
            }
          />
          Publish app
        </label>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">
            App name
            <input
              className={`${inp} mt-1`}
              value={draft.pwa_name || ''}
              placeholder={String(settings?.brand_name || preview.advisorLabel)}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pwa_name: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            Home-screen name
            <input
              className={`${inp} mt-1`}
              maxLength={12}
              value={draft.pwa_short_name || ''}
              placeholder={preview.shortName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pwa_short_name: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            Icon URL
            <input
              className={`${inp} mt-1`}
              value={draft.pwa_icon_url || ''}
              placeholder="Uses your company logo if blank"
              onChange={(e) =>
                setDraft((d) => ({ ...d, pwa_icon_url: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">
            Description
            <input
              className={`${inp} mt-1`}
              value={draft.pwa_description || ''}
              placeholder={preview.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pwa_description: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            Theme colour
            <input
              type="color"
              className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white dark:border-white/15"
              value={
                draft.pwa_theme_color && /^#[0-9a-fA-F]{6}$/.test(draft.pwa_theme_color)
                  ? draft.pwa_theme_color
                  : preview.themeColor
              }
              onChange={(e) =>
                setDraft((d) => ({ ...d, pwa_theme_color: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            Splash background
            <input
              type="color"
              className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white dark:border-white/15"
              value={
                draft.pwa_background_color &&
                /^#[0-9a-fA-F]{6}$/.test(draft.pwa_background_color)
                  ? draft.pwa_background_color
                  : preview.backgroundColor
              }
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  pwa_background_color: e.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className="flex w-[160px] flex-col items-center rounded-[1.6rem] px-3 pb-4 pt-5 text-center shadow-lg"
            style={{ background: preview.backgroundColor, color: ink }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                preview.publicToken
                  ? advisorPwaIconPath(preview.module, preview.publicToken, 192)
                  : preview.iconUrl
              }
              alt=""
              className="h-14 w-14 object-contain"
              style={{ background: 'transparent' }}
            />
            <p className="mt-2 text-[11px] font-black text-white">
              {preview.shortName}
            </p>
            <p className="text-[9px] text-white/70">Home screen</p>
          </div>
          {qrSrc ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="Install QR"
                width={140}
                height={140}
                className="h-[140px] w-[140px] rounded-xl border border-slate-200 bg-white p-1 dark:border-white/15"
              />
              <p className="text-center text-[10px] text-slate-500">
                Scan to open the member app
              </p>
            </div>
          ) : (
            <p className="text-center text-[11px] text-amber-700">
              Publish a portal token on Website first.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-yellow-950"
        >
          Save member app
        </button>
        {installUrl ? (
          <>
            <a
              href={whatsAppUrl('', advisorPwaWhatsAppBody(preview, installUrl))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/15"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy install link
            </button>
            <a
              href={installUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/15"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Open installer
            </a>
            <button
              type="button"
              disabled={qrBusy}
              onClick={() => void downloadQr()}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/15 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {qrBusy ? 'Preparing…' : 'Download high-res QR'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
