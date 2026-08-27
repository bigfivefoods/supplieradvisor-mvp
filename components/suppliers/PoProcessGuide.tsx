'use client';

import { FileText, Shield } from 'lucide-react';
import { ESCROW_LIFECYCLE, getPoEscrowAddress } from '@/lib/contracts/escrow';
import { CONTRACTS } from '@/lib/contracts/config';

const PO_ESCROW_ADDRESS = getPoEscrowAddress() || CONTRACTS.POEscrowV2.address;

export default function PoProcessGuide({
  escrowEnabled,
}: {
  escrowEnabled: boolean;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white border rounded-3xl p-6">
        <div className="inline-flex p-2 rounded-xl bg-emerald-100 text-emerald-800 mb-3">
          <FileText className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-2">Standard PO process</h3>
        <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside">
          <li>Select a connected supplier from your book</li>
          <li>Add line items, promised date, payment terms</li>
          <li>
            Allocate cost — business unit, work centre, station, and/or asset
            (posts to cost centres + GL on complete)
          </li>
          <li>Send (or save draft) — status machine enforced server-side</li>
          <li>Mark accepted when supplier confirms</li>
          <li>Record delivery quantities → feeds OTIFEF scorecards</li>
          <li>Rate supplier quality / delivery / communication / value</li>
        </ol>
        <p className="text-xs text-neutral-500 mt-4">
          Cost objects live under Manufacturing → Cost centres. Journals carry
          the same dimensions for P&amp;L rollups.
        </p>
      </div>
      <div className="bg-white border rounded-3xl p-6">
        <div className="inline-flex p-2 rounded-xl bg-[#00b4d8]/15 text-[#0077b6] mb-3">
          <Shield className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-2">Escrow PO (on-chain)</h3>
        {escrowEnabled ? (
          <ol className="text-sm text-neutral-600 space-y-2 list-decimal list-inside">
            <li>
              On Create tab, choose <strong>Escrow PO</strong>
            </li>
            <li>Connect wallet and enter supplier 0x address</li>
            {ESCROW_LIFECYCLE.map((s) => (
              <li key={s.fn}>
                <code className="text-xs bg-neutral-100 px-1 rounded">{s.fn}</code> — {s.label} (
                {s.role})
              </li>
            ))}
            <li>Server verifies receipt before saving on-chain refs</li>
            <li>Record OTIFEF delivery + rate supplier off-chain</li>
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">
            Escrow is disabled. Set NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED=true (default is on) to
            enable escrow POs alongside standard POs.
          </p>
        )}
        <p className="text-xs text-neutral-500 mt-4">
          ETH contract: {String(PO_ESCROW_ADDRESS).slice(0, 10)}… · client-signed · receipt verified
        </p>
      </div>
    </div>
  );
}
