'use client';

import { useEffect, useState } from 'react';
import DeliveryNoteFlow from '@/components/customers/DeliveryNoteFlow';
import DeliveryNotePublicView from '@/components/customers/DeliveryNotePublicView';
import DeliveryNoteShareActions from '@/components/customers/DeliveryNoteShareActions';
import { SAMPLE_DELIVERY_NOTE } from '@/lib/customers/delivery-note-sample';

/**
 * Sample delivery note for layout review. Nothing here is written to the database.
 */
export default function DeliveryNotePreviewPage() {
  const [viewUrl, setViewUrl] = useState(
    'https://www.supplieradvisor.com/preview/delivery-note'
  );
  useEffect(() => {
    setViewUrl(`${window.location.origin}/preview/delivery-note`);
  }, []);
  const pdfUrl = '/preview/delivery-note/pdf';
  return (
    <div className="bg-[#eef2f7]">
      <div className="mx-auto w-full max-w-lg space-y-3 px-3 pt-4 md:max-w-3xl md:pt-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sample only · SupplierAdvisor® · not saved
        </p>
        <DeliveryNoteFlow />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Share this delivery note</h2>
          <DeliveryNoteShareActions
            customerName={SAMPLE_DELIVERY_NOTE.customerName}
            contactName={SAMPLE_DELIVERY_NOTE.contactName}
            phone={SAMPLE_DELIVERY_NOTE.contactPhone}
            number={SAMPLE_DELIVERY_NOTE.number}
            invoiceNumber={SAMPLE_DELIVERY_NOTE.invoiceNumber}
            viewUrl={viewUrl}
            pdfUrl={pdfUrl}
          />
        </div>
      </div>
      <DeliveryNotePublicView note={SAMPLE_DELIVERY_NOTE} pdfHref={pdfUrl} />
    </div>
  );
}
