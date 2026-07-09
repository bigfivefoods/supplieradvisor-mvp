'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import {
  BuyerCompanyRequired,
  BuyerHeader,
} from '@/components/buyer/BuyerShell';

/**
 * Placeholder for buyer-raised POs (full create/list lands in PR7).
 * Links from hub/suppliers land here so navigation is not a 404.
 */
export default function BuyerPosPlaceholderPage() {
  return (
    <BuyerCompanyRequired>
      <BuyerHeader
        title="Purchase orders"
        description="Raise and track purchase orders against connected suppliers. Full create flow arrives with the buyer PO PR."
      />
      <div className="bg-white border rounded-3xl p-10 text-center max-w-xl mx-auto">
        <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-[#00b4d8]" />
        <p className="text-neutral-600 text-sm mb-4">
          Buyer-raised purchase orders against connected (non-suspended) suppliers will live here.
          Until then, you can still browse suppliers and shared documents.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/buyer/suppliers"
            className="btn-primary !py-2.5 !px-4 text-sm"
          >
            Connected suppliers
          </Link>
          <Link
            href="/dashboard/buyer/documents"
            className="btn-secondary !py-2.5 !px-4 text-sm"
          >
            Shared documents
          </Link>
        </div>
      </div>
    </BuyerCompanyRequired>
  );
}
