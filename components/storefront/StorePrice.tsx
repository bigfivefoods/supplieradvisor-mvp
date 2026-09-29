import type { StoreProduct } from '@/lib/storefront/types';
import { formatStoreMoney } from '@/lib/storefront/money';

export function StorePrice({
  product,
  size = 'sm',
}: {
  product: StoreProduct;
  size?: 'sm' | 'lg';
}) {
  const label = formatStoreMoney(product.price, product.currency);
  if (!label) {
    return (
      <span className="block">
        <span
          className={
            size === 'lg'
              ? 'text-xl font-black text-slate-800'
              : 'text-sm font-bold text-slate-800'
          }
        >
          Price on request
        </span>
        {product.quoteFirst ? (
          <span className="block text-[10px] font-semibold text-violet-700">
            Quote-first (institutional)
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="block">
      <span
        className={
          size === 'lg'
            ? 'text-2xl font-black text-slate-900 tracking-tight'
            : 'text-sm font-black text-slate-900'
        }
      >
        {label}
      </span>
      <span className="block text-[10px] font-semibold text-slate-500">
        excl. VAT
        {product.packSize ? ` · ${product.packSize}` : ''}
      </span>
      {product.quoteFirst ? (
        <span className="block text-[10px] font-semibold text-violet-700">
          Quote to confirm
        </span>
      ) : null}
    </span>
  );
}
