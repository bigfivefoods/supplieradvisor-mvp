'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Package, ShieldCheck, Link2, FileText, ExternalLink } from 'lucide-react';

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
        {product.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={String(product.primary_image_url)}
            alt={String(product.name)}
            className="w-full h-48 object-cover"
          />
        ) : null}
        <div className="p-6 space-y-4">
          {product.short_description ? (
            <p className="text-neutral-700 text-sm">{String(product.short_description)}</p>
          ) : null}
          {product.specs_sheet_url ? (
            <a
              href={String(product.specs_sheet_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-2xl border border-[#00b4d8]/20 bg-[#00b4d8]/5 px-4 py-3 text-sm font-medium text-[#0077b6] hover:bg-[#00b4d8]/10"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {product.specs_sheet_name
                  ? String(product.specs_sheet_name)
                  : 'Specifications sheet'}
              </span>
              <ExternalLink className="w-4 h-4" />
            </a>
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
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" /> What this proves on-chain
              </div>
              <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                A content hash of this product identity was recorded so buyers can
                check the listing was not altered after mint. Status:{' '}
                <strong className="capitalize">
                  {String(product.onchain_status || 'hashed')}
                </strong>
                .
              </p>
              <div className="text-[11px] font-mono break-all text-emerald-900/80 bg-white/60 rounded-lg p-2">
                Hash: {String(product.onchain_hash)}
              </div>
              {product.onchain_tx_hash ? (
                <a
                  href={
                    String(product.onchain_chain || '').toLowerCase().includes('sepolia')
                      ? `https://sepolia.etherscan.io/tx/${product.onchain_tx_hash}`
                      : String(product.onchain_chain || '').toLowerCase().includes('base')
                        ? `https://basescan.org/tx/${product.onchain_tx_hash}`
                        : `https://etherscan.io/tx/${product.onchain_tx_hash}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View transaction on explorer
                </a>
              ) : (
                <div className="text-xs text-emerald-700 capitalize flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Chain: {String(product.onchain_chain || 'configured chain')}
                  {String(product.onchain_status || '').includes('sim')
                    ? ' · simulated (set passport env for live mint)'
                    : ''}
                </div>
              )}
            </div>
          ) : null}
          <p className="text-[11px] text-neutral-400 text-center pt-2">
            Scanned from inventory QR · Product passport via SupplierAdvisor®
          </p>
        </div>
      </div>
    </div>
  );
}
