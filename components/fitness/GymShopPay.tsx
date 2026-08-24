'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import type { GymShopCoach, GymShopItem } from '@/lib/fitness/gym-shop';
import { inventoryShelfOf } from '@/lib/fitness/gym-inventory-shop';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { videoEmbedSrc } from '@/lib/fitness/movements';

function coachRateLabel(rate?: number | null, basis?: string | null) {
  if (rate == null || !Number.isFinite(rate)) return null;
  const money = `R${rate.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
  const b = String(basis || 'session').replace(/_/g, ' ');
  return `${money} / ${b}`;
}

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

function ShopFold({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-[11px] font-semibold text-slate-500">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180 text-slate-700' : ''
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </section>
  );
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
  hideIntro,
  joining,
  subscribedIds,
  classSubscribe,
  coaches,
  joinPrivateHref,
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
  hideIntro?: boolean;
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  subscribedIds?: string[];
  classSubscribe?: boolean;
  coaches?: GymShopCoach[];
  joinPrivateHref?: string | null;
}) {
  const already = new Set(subscribedIds || []);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openFold, setOpenFold] = useState<Record<string, boolean>>({
    memberships: true,
  });
  const classMode =
    classSubscribe === true ||
    items.some((i) => i.kind === 'membership' && Boolean(i.schedule_label));

  const groups = useMemo(() => {
    const memberships = items.filter((i) => i.kind === 'membership');
    const programmes = items.filter((i) => i.kind === 'programme');
    const goods = items.filter(
      (i) => i.kind === 'product' && i.group !== 'service'
    );
    const shelfOf = (i: GymShopItem) =>
      inventoryShelfOf({
        name: i.name,
        category: i.category,
        description: i.description,
        sku: i.code,
      });
    const apparel = goods.filter((i) => shelfOf(i) === 'apparel');
    const recovery = goods.filter((i) => shelfOf(i) === 'recovery');
    const otherGoods = goods.filter((i) => shelfOf(i) === 'other');
    return { memberships, programmes, apparel, recovery, otherGoods, goods };
  }, [items]);

  const openItem = items.find((i) => itemKey(i) === openKey) || null;
  const coachList = coaches || [];
  const toggle = (id: string) =>
    setOpenFold((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderCard = (item: GymShopItem) => {
    const subscribed = item.kind === 'membership' && already.has(item.id);
    return (
      <button
        type="button"
        key={itemKey(item)}
        onClick={() => setOpenKey(itemKey(item))}
        className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm dark:border-white/10 dark:bg-neutral-950"
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
          <p className="text-sm font-bold text-slate-900 dark:text-white">
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

  const grid = (list: GymShopItem[]) =>
    list.length ? (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(renderCard)}
      </div>
    ) : null;

  const shelf = (title: string, list: GymShopItem[]) =>
    list.length ? (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {title}
        </p>
        {grid(list)}
      </div>
    ) : null;

  const busy = openItem ? buyingId === itemKey(openItem) : false;
  const subscribed =
    openItem?.kind === 'membership' && already.has(openItem.id);
  const profileReady = Boolean(name.trim() && email.includes('@'));
  const canBuy = payoutReady && profileReady && Boolean(openItem);

  if (!items.length && !coachList.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nothing is for sale yet. Ask the gym to publish memberships or products.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hideIntro ? null : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {requirePaid
            ? 'Open a membership, programme or product, then pay with card or Apple Pay.'
            : 'Open a card for the details, then pay with card or Apple Pay.'}
        </p>
      )}
      {joining ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {joining.note ||
            `Once-off joining R${joining.fee_zar}${
              joining.waived ? ' — currently waived' : ''
            }`}
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

      <ShopFold
        title="Membership services"
        count={groups.memberships.length}
        open={!!openFold.memberships}
        onToggle={() => toggle('memberships')}
      >
        {grid(groups.memberships)}
      </ShopFold>

      <ShopFold
        title="Private coaching"
        count={coachList.length}
        open={!!openFold.coaches}
        onToggle={() => toggle('coaches')}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {coachList.map((c) => {
            const inner = (
              <>
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo_url}
                    alt=""
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-slate-100 text-3xl font-black text-slate-400 dark:bg-white/5">
                    {c.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex flex-1 flex-col px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Coach
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {c.name}
                  </p>
                  {c.specialties?.length ? (
                    <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                      {c.specialties.slice(0, 3).join(' · ')}
                    </p>
                  ) : null}
                  {c.bio ? (
                    <p className="mt-1 line-clamp-3 text-[12px] text-slate-600 dark:text-slate-300">
                      {c.bio}
                    </p>
                  ) : null}
                  {coachRateLabel(c.rate_zar, c.rate_basis) ? (
                    <p
                      className="mt-auto pt-2 text-sm font-black tabular-nums"
                      style={{ color }}
                    >
                      {coachRateLabel(c.rate_zar, c.rate_basis)}
                    </p>
                  ) : (
                    <p className="mt-auto pt-2 text-[11px] font-bold text-slate-400">
                      Private coaching
                    </p>
                  )}
                  {joinPrivateHref ? (
                    <p className="mt-2 text-[11px] font-black" style={{ color }}>
                      Apply
                    </p>
                  ) : null}
                </div>
              </>
            );
            const cls =
              'flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm dark:border-white/10 dark:bg-neutral-950';
            return joinPrivateHref ? (
              <a key={c.id} href={joinPrivateHref} className={cls}>
                {inner}
              </a>
            ) : (
              <div key={c.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </ShopFold>

      <ShopFold
        title="Programmes"
        count={groups.programmes.length}
        open={!!openFold.programmes}
        onToggle={() => toggle('programmes')}
      >
        {grid(groups.programmes)}
      </ShopFold>

      <ShopFold
        title="Products"
        count={groups.goods.length}
        open={!!openFold.products}
        onToggle={() => toggle('products')}
      >
        {shelf('Apparel', groups.apparel)}
        {shelf('Recovery & health', groups.recovery)}
        {shelf('More', groups.otherGoods)}
      </ShopFold>

      {hidePayAccepted ? null : payoutReady ? (
        <div className="space-y-2 rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-neutral-900">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Payments accepted
          </p>
          <AdvisorPayAccepted tone="onLight" size="md" label="Apple Pay and card via Paystack" />
          <p className="text-xs text-slate-500">
            Open a card above, then pay. Apple Pay on Safari / iPhone; card and
            EFT via Paystack.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
          Card / Apple Pay is not available right now. Ask reception to take
          payment.
        </p>
      )}

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
              {!profileReady ? (
                <p className="text-center text-[11px] text-slate-500">
                  {hideIdentity
                    ? 'Save your name and email under You → Profile before paying.'
                    : 'Enter your name and email above before paying.'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
