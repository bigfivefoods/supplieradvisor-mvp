'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Package, ShieldCheck, Link2 } from 'lucide-react';

/**
 * Public product card — destination of inventory QR codes.
 * Read-only product identity + on-chain hash for trust.
 */
export default function PublicProductPage() {
  const { publicId } = useParams() as { publicId: string };
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) return;
    fetch(`/api/inventory/products/public?publicId=${encodeURIComponent(publicId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setProduct(d.product);
      })
      .catch(() => setError('Failed to load product'))
      .finally(() => setLoading(false));
  }, [publicId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <Package className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Product not found</h1>
          <p className="text-neutral-600 text-sm">{error || 'Invalid QR code'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className="max-w-md mx-auto bg-white border rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-br from-[#00b4d8] to-[#0077b6] px-6 py-8 text-white text-center">
          <div className="text-xs uppercase tracking-widest opacity-90 mb-2">SupplierAdvisor®</div>
          <h1 className="text-2xl font-black tracking-tight">{String(product.name)}</h1>
          {product.sku ? (
            <p className="font-mono text-sm mt-2 opacity-90">SKU {String(product.sku)}</p>
          ) : null}
        </div>
        <div className="p-6 space-y-4">
          {product.short_description ? (
            <p className="text-neutral-700 text-sm">{String(product.short_description)}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-neutral-50 p-3">
              <div className="text-xs text-neutral-500">Category</div>
              <div className="font-semibold">{String(product.category || '—')}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 p-3">
              <div className="text-xs text-neutral-500">Unit</div>
              <div className="font-semibold">{String(product.uom || 'unit')}</div>
            </div>
          </div>
          {product.onchain_hash ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-2">
                <ShieldCheck className="w-4 h-4" /> On-chain identity
              </div>
              <div className="text-[11px] font-mono break-all text-emerald-900/80">
                {String(product.onchain_hash)}
              </div>
              <div className="text-xs text-emerald-700 mt-2 capitalize flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                {String(product.onchain_status || 'hashed')} · {String(product.onchain_chain || 'base')}
              </div>
            </div>
          ) : null}
          <p className="text-[11px] text-neutral-400 text-center pt-2">
            Scanned from inventory QR · Verified product passport
          </p>
        </div>
      </div>
    </div>
  );
}
