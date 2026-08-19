'use client';

import { Loader2 } from 'lucide-react';
import type { GymShopItem } from '@/lib/fitness/gym-shop';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';

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
  joining?: { fee_zar: number; waived?: boolean; note?: string } | null;
  subscribedIds?: string[];
  classSubscribe?: boolean;
}) {
  const already = new Set(subscribedIds || []);
  const classMode =
    classSubscribe === true ||
    items.some((i) => i.kind === 'membership' && Boolean(i.schedule_label));
  if (!items.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {classMode
          ? 'No classes are open for subscription yet. Ask the gym to publish the timetable.'
          : 'No memberships or programmes are for sale yet. Ask the gym to publish a priced plan.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {classMode ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Subscribe to the class or classes you train. Your monthly fee is
            the total of those classes
            {requirePaid ? ' — then you or a coach book each session' : ''}.
            Card, Apple Pay (Safari / iPhone) or EFT.
          </p>
        ) : requirePaid ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pay first — then you can book classes. Card, Apple Pay (Safari /
            iPhone), EFT and other Paystack methods.
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Buy a membership or programme. Pay with card, Apple Pay (Safari /
            iPhone) or EFT.
          </p>
        )}
        {payoutReady ? <AdvisorPayAccepted tone="onLight" size="sm" /> : null}
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
          This gym has not connected card / Apple Pay yet. You can still leave
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const busy = buyingId === `${item.kind}:${item.id}`;
          const subscribed =
            item.kind === 'membership' && already.has(item.id);
          return (
            <div
              key={`${item.kind}:${item.id}`}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {item.kind === 'programme'
                  ? 'Programme'
                  : item.addon
                    ? 'Add-on'
                    : item.unlocks_all || item.code === 'VUKA_UNLIM'
                      ? 'Unlimited'
                      : classMode
                        ? 'Class'
                        : 'Membership'}
              </p>
              <div className="font-bold text-sm">{item.name}</div>
              {item.schedule_label ? (
                <p className="text-[11px] font-bold text-slate-500">
                  {item.schedule_label}
                </p>
              ) : null}
              {item.audience && item.audience !== 'all' ? (
                <p className="text-[10px] font-black uppercase text-amber-700">
                  {item.audience === 'gents'
                    ? 'Gents only'
                    : item.audience === 'women'
                      ? 'Women only'
                      : item.audience === 'kids'
                        ? 'Kids'
                        : item.audience}
                </p>
              ) : null}
              <div className="text-lg font-black tabular-nums" style={{ color }}>
                R{item.price_zar}
                <span className="ml-1 text-[11px] font-bold text-slate-400">
                  / {item.billing}
                </span>
              </div>
              {item.description ? (
                <p className="mt-1 text-[12px] text-slate-600">
                  {item.description}
                </p>
              ) : null}
              {item.class_credits != null ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.class_credits} class credits
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy || !payoutReady || !name.trim() || !email.includes('@')}
                className="mt-3 min-h-11 rounded-xl py-2 text-xs font-black disabled:opacity-50"
                style={{ backgroundColor: color, color: advisorBrandInk(color) }}
                onClick={() => onBuy(item)}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening Paystack…
                  </span>
                ) : subscribed ? (
                  'Subscribed · renew'
                ) : classMode && item.kind === 'membership' ? (
                  `Subscribe · R${item.price_zar}/pm`
                ) : (
                  'Pay & join'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
