'use client';

import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { GymShopItem } from '@/lib/fitness/gym-shop';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { videoEmbedSrc } from '@/lib/fitness/movements';

function itemKindLabel(item: GymShopItem, classMode: boolean): string {
  if (item.kind === 'programme') return 'Programme';
  if (item.kind === 'product') {
    return item.group === 'service' ? 'Service' : 'Product';
  }
  if (item.addon) return 'Add-on';
  if (item.unlocks_all || item.code === 'VUKA_UNLIM') return 'Unlimited';
  if (classMode) return 'Class';
  return 'Membership';
}

function itemKey(item: GymShopItem): string {
  return `${item.kind}:${item.id}`;
}

export function GymShopPay({
  items,
  color,
  payoutReady = true,
  requirePaid,
  name,
  email,
  phone,
  onName,
  onEmail,
  onPhone,
  onBuy,
  buyingId,
  hideIdentity,
  hidePayAccepted,
  joining,
  subscribedIds,
  classSubscribe,
}: {
  items: GymShopItem[];
  color: string;
  payoutReady?: boolean;
  requirePaid?: boolean;
  name: string;
  email: string;
  phone: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onBuy: (item: GymShopItem) => void;
  buyingId?: string | null;
  hideIdentity?: boolean;
  hidePayAccepted?: boolean;
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  subscribedIds?: string[];
  classSubscribe?: boolean;
}) {
  const already = new Set(subscribedIds || []);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const classMode =
    classSubscribe === true ||
    items.some((i) => i.kind === 'membership' && Boolean(i.schedule_label));

  const groups = useMemo(() => {
    const programmes = items.filter((i) => i.kind === 'programme');
    const goods = items.filter(
      (i) => i.kind === 'product' && i.group !== 'service'
    );
    const inventoryServices = items.filter(
      (i) => i.kind === 'product' && i.group === 'service'
    );
    const memberships = items.filter((i) => i.kind === 'membership');
    return { programmes, goods, inventoryServices, memberships };
  }, [items]);

  const openItem = items.find((i) => itemKey(i) === openKey) || null;

  if (!items.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {classMode
          ? 'No classes or programmes are for sale yet. Ask the gym to publish the timetable.'
          : 'No memberships or programmes are for sale yet. Ask the gym to publish a priced plan.'}
      </p>
    );
  }

  const renderCard = (item: GymShopItem) => {
    const subscribed = item.kind === 'membership' && already.has(item.id);
    return (
      <button
        type="button"
        key={itemKey(item)}
        onClick={() => setOpenKey(itemKey(item))}
        className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm dark:border-white/10 dark:bg-neutral-900"
      >
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            className="h-32 w-full object-cover"
          />
        ) : null}
        <div className="flex flex-1 flex-col px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {itemKindLabel(item, classMode)}
          </p>
          <p className="font-bold text-sm text-slate-900 dark:text-white">
            {item.name}
          </p>
          {item.schedule_label ? (
            <p className="text-[11px] font-bold text-slate-500">
              {item.schedule_label}
            </p>
          ) : null}
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-[12px] text-slate-600 dark:text-slate-300">
              {item.description}
            </p>
          ) : null}
          <p className="mt-auto pt-2 text-lg font-black tabular-nums" style={{ color }}>
            R{item.price_zar}
            <span className="ml-1 text-[11px] font-bold text-slate-400">
              / {item.billing}
            </span>
          </p>
          <p className="mt-2 text-[11px] font-black" style={{ color }}>
            {subscribed ? 'Subscribed · view' : 'View details'}
          </p>
        </div>
      </button>
    );
  };

  const section = (title: string, list: GymShopItem[]) =>
    list.length ? (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {title}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(renderCard)}
        </div>
      </div>
    ) : null;

  const busy = openItem ? buyingId === itemKey(openItem) : false;
  const subscribed =
    openItem?.kind === 'membership' && already.has(openItem.id);
  const canBuy =
    payoutReady && name.trim() && email.includes('@') && Boolean(openItem);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {classMode ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Open a class, programme or product to read the details, then pay.
            Card, Apple Pay (Safari / iPhone) or EFT.
          </p>
        ) : requirePaid ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Open a membership, programme or product first — then pay. Card,
            Apple Pay (Safari / iPhone) or EFT.
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tap a product or service for the full details before you buy.
          </p>
        )}
        {payoutReady && !hidePayAccepted ? (
          <AdvisorPayAccepted tone="onLight" size="sm" />
        ) : null}
      </div>
      {joining ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {joining.note ||
            `Once-off joining R${joining.fee_zar}${
              joining.waived ? ' — currently waived' : ''
            }`}
        </p>
      ) : null}
      {!payoutReady ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
          Card / Apple Pay is not available right now. You can still leave
          your details — ask reception to take payment.
        </p>
      ) : null}
      {!hideIdentity ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-900"
            placeholder="Your name *"
            value={name}
            onChange={(e) => onName(e.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-900"
            placeholder="Email *"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-900"
            placeholder="Phone / WhatsApp"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
          />
        </div>
      ) : null}

      {section('Products', groups.goods)}
      {section('Programmes', groups.programmes)}
      {section(
        classMode ? 'Classes & memberships' : 'Memberships',
        groups.memberships
      )}
      {section('Services', groups.inventoryServices)}

      {openItem ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gym-shop-detail-title"
          onClick={() => setOpenKey(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            {openItem.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={openItem.image_url}
                alt=""
                className="h-48 w-full object-cover"
              />
            ) : null}
            <div className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {itemKindLabel(openItem, classMode)}
                  </p>
                  <h2
                    id="gym-shop-detail-title"
                    className="text-xl font-black text-slate-900 dark:text-white"
                  >
                    {openItem.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenKey(null)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-2xl font-black tabular-nums" style={{ color }}>
                R{openItem.price_zar}
                <span className="ml-1 text-sm font-bold text-slate-400">
                  / {openItem.billing}
                </span>
              </p>
              {openItem.schedule_label ? (
                <p className="text-sm font-bold text-slate-600">
                  {openItem.schedule_label}
                </p>
              ) : null}
              {openItem.audience && openItem.audience !== 'all' ? (
                <p className="text-[11px] font-black uppercase text-amber-700">
                  {openItem.audience === 'gents'
                    ? 'Gents only'
                    : openItem.audience === 'women'
                      ? 'Women only'
                      : openItem.audience === 'kids'
                        ? 'Kids'
                        : openItem.audience}
                </p>
              ) : null}
              {(() => {
                const embed = videoEmbedSrc(openItem.video_url);
                if (!embed) return null;
                return embed.iframe ? (
                  <iframe
                    title={`${openItem.name} video`}
                    src={embed.src}
                    className="aspect-video w-full rounded-2xl bg-black"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={embed.src}
                    className="aspect-video w-full rounded-2xl bg-black object-contain"
                    controls
                    playsInline
                  />
                );
              })()}
              {openItem.description ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    About this {itemKindLabel(openItem, classMode).toLowerCase()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                    {openItem.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Ask the desk if you need more about this{' '}
                  {itemKindLabel(openItem, classMode).toLowerCase()}.
                </p>
              )}
              {openItem.class_credits != null ? (
                <p className="text-sm text-slate-600">
                  {openItem.class_credits} class credits
                </p>
              ) : null}
              {openItem.weekly_class_limit != null ? (
                <p className="text-sm text-slate-600">
                  Up to {openItem.weekly_class_limit} classes a week
                </p>
              ) : null}
              {openItem.location ? (
                <p className="text-sm text-slate-600">{openItem.location}</p>
              ) : null}
              {openItem.code ? (
                <p className="font-mono text-[11px] text-slate-400">
                  {openItem.code}
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy || !canBuy}
                className="min-h-11 w-full rounded-xl py-3 text-sm font-black disabled:opacity-50"
                style={{
                  backgroundColor: color,
                  color: advisorBrandInk(color),
                }}
                onClick={() => onBuy(openItem)}
              >
                {busy ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" /> Opening Paystack…
                  </span>
                ) : subscribed ? (
                  `Renew · R${openItem.price_zar}`
                ) : openItem.kind === 'programme' ? (
                  `Buy programme · R${openItem.price_zar}`
                ) : openItem.kind === 'product' ? (
                  `Buy · R${openItem.price_zar}`
                ) : classMode && openItem.kind === 'membership' ? (
                  `Subscribe · R${openItem.price_zar}/pm`
                ) : (
                  `Pay & join · R${openItem.price_zar}`
                )}
              </button>
              {!name.trim() || !email.includes('@') ? (
                <p className="text-center text-[11px] text-slate-500">
                  Enter your name and email above before paying.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
