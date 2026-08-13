'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, QrCode, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
  memberAppJoinUrl,
  memberAppJoinWhatsAppText,
  memberAppQrSrc,
  whatsappShareUrl,
  type MemberAppJoinKind,
} from '@/lib/b2c/member-app';

const KIND_LABEL: Record<string, string> = {
  gym: 'GymAdvisor®',
  hire: 'HireAdvisor®',
  physio: 'PhysioAdvisor®',
  dental: 'DentalAdvisor®',
  medical: 'MedicalAdvisor®',
  psychiatry: 'PsychiatryAdvisor®',
};

const AUDIENCE_LABEL: Record<string, string> = {
  members: 'members',
  patients: 'patients',
  customers: 'customers',
};

export function AdvisorMemberAppInvite({
  kind,
  companyId,
  brand,
  audience = 'members',
}: {
  kind: MemberAppJoinKind;
  companyId: number;
  brand?: string | null;
  audience?: 'members' | 'patients' | 'customers';
}) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.supplieradvisor.com';
  const brandName = (brand || '').trim() || KIND_LABEL[kind] || 'Your brand';

  const appLink = useMemo(
    () =>
      memberAppJoinUrl(origin, {
        companyId,
        kind,
        brand: brandName,
      }),
    [origin, companyId, kind, brandName]
  );
  const qrSrc = useMemo(() => memberAppQrSrc(appLink, 280), [appLink]);
  const wa = useMemo(
    () =>
      whatsappShareUrl(
        memberAppJoinWhatsAppText({
          brand: brandName,
          appLink,
          audience,
        })
      ),
    [brandName, appLink, audience]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('SA Member link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-800 dark:from-sky-950/40 dark:to-neutral-950">
      <div className="flex flex-wrap items-start gap-6">
        <div className="shrink-0 rounded-2xl border border-sky-100 bg-white p-3 shadow-sm dark:border-sky-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="SA Member app QR"
            width={200}
            height={200}
            className="h-[200px] w-[200px]"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
            <Smartphone className="h-3.5 w-3.5" /> SA Member · {KIND_LABEL[kind] || kind}
          </p>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Invite {AUDIENCE_LABEL[audience] || 'people'} to the app
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Print this QR or send the link. They open SA Member on their phone,
            create a free profile (email or Google), and can verify themselves.
            If you already have their email or phone, their {audience === 'patients' ? 'patient' : audience === 'customers' ? 'hire' : 'member'}{' '}
            record attaches automatically.
          </p>
          <p className="break-all font-mono text-[11px] text-slate-500">{appLink}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 rounded-full bg-[#0077b6] px-3 py-1.5 text-xs font-bold text-white"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy app link
            </button>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900"
            >
              WhatsApp
            </a>
            <a
              href={appLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            <a
              href={qrSrc}
              target="_blank"
              rel="noreferrer"
              download="sa-member-app-qr.png"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <Download className="h-3.5 w-3.5" /> Download QR
            </a>
          </div>
          <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <QrCode className="h-3.5 w-3.5" />
            Poster at reception · WhatsApp to a group · personal invite after you
            issue a portal.
          </p>
        </div>
      </div>
    </div>
  );
}
