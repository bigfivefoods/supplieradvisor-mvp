'use client';

import { computeFleetCpk } from '@/lib/fleet/cpk';
import { sample01Input } from '@/lib/fleet/cpk-fixtures';
import { formatPerKm, formatRandFromCents } from '@/lib/fleet/format';
import { FleetIllustration } from './FleetUi';

export function FleetRegisterArt() {
  return (
    <FleetIllustration>
      <ul className="space-y-2 text-sm text-slate-700">
        <li className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
          <span className="font-black">SAMPLE 01</span>
          <span>Rigid · active</span>
        </li>
        <li className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
          <span className="font-black">SAMPLE 02</span>
          <span>Van · workshop</span>
        </li>
      </ul>
    </FleetIllustration>
  );
}

export function ExpiryStripArt() {
  return (
    <FleetIllustration>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white px-3 py-1 text-slate-700">Disc · dated</span>
        <span className="rounded-full bg-white px-3 py-1 text-slate-700">PrDP · dated</span>
        <span className="rounded-full bg-white px-3 py-1 text-slate-700">Medical · no date yet</span>
      </div>
    </FleetIllustration>
  );
}

export function MapSketchArt() {
  return (
    <FleetIllustration>
      <svg viewBox="0 0 320 160" className="h-40 w-full" role="img" aria-label="Sketch of a fleet map">
        <rect width="320" height="160" rx="16" fill="#ffffff" />
        <path d="M10 130 H310" stroke="#e2e8f0" strokeWidth="10" />
        <path d="M40 20 V150" stroke="#e2e8f0" strokeWidth="8" />
        <path d="M20 120 C 80 40, 140 140, 200 70 S 280 40, 300 90" fill="none" stroke="#0077b6" strokeWidth="3" />
        <rect x="48" y="96" width="54" height="22" rx="6" fill="#ffffff" stroke="#0f172a" />
        <text x="54" y="111" fontSize="10" fill="#0f172a">Depot</text>
        <circle cx="70" cy="78" r="8" fill="#00b4d8" stroke="#0f172a" />
        <circle cx="180" cy="86" r="8" fill="#00b4d8" stroke="#0f172a" />
        <circle cx="250" cy="64" r="8" fill="#00b4d8" stroke="#0f172a" />
        <text x="82" y="74" fontSize="11" fill="#0f172a">SAMPLE 01</text>
        <text x="192" y="104" fontSize="11" fill="#0f172a">SAMPLE 02</text>
      </svg>
    </FleetIllustration>
  );
}

export function CpkWaterfallArt() {
  const row = computeFleetCpk(sample01Input())[0];
  const lines = [
    ['Running', formatRandFromCents(row.running_cents)],
    ['Standing', formatRandFromCents(row.standing_cents)],
    ['Capital', formatRandFromCents(row.capital_cents)],
    ['Overhead', formatRandFromCents(row.overhead_cents)],
    ['Fully loaded', `${formatPerKm(row.fully_loaded_per_km)}/km`],
  ];
  return (
    <FleetIllustration>
      <ul className="space-y-1 text-sm">
        {lines.map(([label, value]) => (
          <li key={label} className="flex justify-between rounded-xl bg-white px-3 py-1.5 font-bold text-slate-800">
            <span>{label}</span>
            <span className="tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
    </FleetIllustration>
  );
}

export function DispatchArt() {
  return (
    <FleetIllustration>
      <p className="text-sm text-slate-700">A dispatch board will sit here when trips can be assigned.</p>
    </FleetIllustration>
  );
}

export function PodArt() {
  return (
    <FleetIllustration>
      <p className="text-sm text-slate-700">A proof-of-delivery card will sit here when capture is switched on.</p>
    </FleetIllustration>
  );
}
