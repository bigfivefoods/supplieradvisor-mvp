'use client';

import { useStoreOrderOptional } from '@/components/storefront/StoreOrderCart';
import type { StoreProduct } from '@/lib/storefront/types';

export function StoreProductAdd({ product }: { product: StoreProduct }) {
  const cart = useStoreOrderOptional();
  if (!cart) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        cart.add(product);
      }}
      className="mt-2 w-full rounded-xl border border-[#00b4d8]/40 bg-sky-50 px-3 py-2 text-xs font-black text-[#0077b6] hover:bg-sky-100"
    >
      Add to order
    </button>
  );
}
