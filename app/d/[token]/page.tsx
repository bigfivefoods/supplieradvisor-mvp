import type { Metadata } from 'next';
import DeliveryNoteAckForm from '@/components/customers/DeliveryNoteAckForm';
import DeliveryNotePublicView from '@/components/customers/DeliveryNotePublicView';
import { normalizeDeliveryNoteToken } from '@/lib/customers/delivery-note-token';
import { loadPublicDeliveryNote } from '@/lib/customers/delivery-note-store';

type Props = { params: Promise<{ token: string }> };

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delivery note',
  description: 'Delivery note on SupplierAdvisor®. Quantities only.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicDeliveryNotePage({ params }: Props) {
  const { token: raw } = await params;
  const token = normalizeDeliveryNoteToken(raw);
  let loaded: Awaited<ReturnType<typeof loadPublicDeliveryNote>>;
  try {
    loaded = await loadPublicDeliveryNote(token);
  } catch {
    loaded = {
      ok: false,
      error: 'This delivery note link is not available.',
      status: 503,
    };
  }
  if (!loaded.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0077b6]">
            SupplierAdvisor®
          </p>
          <h1 className="mt-2 text-xl font-black text-slate-900">Delivery note unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            This link is invalid, expired, or has been revoked. Ask the sender for a new delivery note link.
          </p>
        </div>
      </main>
    );
  }
  const pdfHref = `/api/public/delivery-note/pdf?token=${encodeURIComponent(token)}&download=1`;
  return (
    <>
      <DeliveryNotePublicView note={loaded.view} pdfHref={pdfHref} />
      <div className="bg-[#eef2f7] px-3 pb-10">
        <DeliveryNoteAckForm
          token={token}
          initialName={loaded.view.receivedByName}
          initialDate={loaded.view.receivedByDate}
        />
      </div>
    </>
  );
}
