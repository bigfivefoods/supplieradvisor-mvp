'use client';

import { Loader2 } from 'lucide-react';
import type { GymShopItem } from '@/lib/fitness/gym-shop';

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
}) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-500">
        No memberships or programmes are for sale yet. Ask the gym to publish a
        priced plan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {requirePaid ? (
        <p className="text-sm text-slate-600">
          Pay first — then you can book classes. Card, Apple Pay (Safari /
          iPhone), EFT and other Paystack methods.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Buy a membership or programme. Pay with card, Apple Pay (Safari /
          iPhone) or EFT.
        </p>
      )}
      {!payoutReady ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
          This gym has not connected card / Apple Pay yet. You can still leave
          your details — ask reception to take payment.
        </p>
      ) : null}
      {!hideIdentity ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Your name *"
            value={name}
            onChange={(e) => onName(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email *"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Phone / WhatsApp"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
          />
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const busy = buyingId === `${item.kind}:${item.id}`;
          return (
            <div
              key={`${item.kind}:${item.id}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {item.kind === 'programme' ? 'Programme' : 'Membership'}
              </p>
              <div className="font-bold text-sm">{item.name}</div>
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
                className="mt-3 rounded-xl py-2 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: color }}
                onClick={() => onBuy(item)}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening Paystack…
                  </span>
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
