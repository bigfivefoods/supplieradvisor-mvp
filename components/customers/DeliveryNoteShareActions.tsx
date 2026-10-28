'use client';

import { useState } from 'react';
import { Copy, FileDown, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  deliveryNoteWhatsAppHref,
  deliveryNoteWhatsAppText,
} from '@/lib/customers/delivery-note';
import { sharePdfFileViaNavigator } from '@/lib/invites/whatsapp';

type Props = {
  customerName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  number: string;
  invoiceNumber: string;
  viewUrl: string;
  pdfUrl: string;
};

function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function DeliveryNoteShareActions({
  customerName,
  contactName,
  phone,
  number,
  invoiceNumber,
  viewUrl,
  pdfUrl,
}: Props) {
  const [busy, setBusy] = useState(false);
  const message = deliveryNoteWhatsAppText({
    customerName,
    contactName,
    number,
    invoiceNumber,
    viewUrl,
    pdfUrl,
  });
  const attachedMessage = deliveryNoteWhatsAppText({
    customerName,
    contactName,
    number,
    invoiceNumber,
    viewUrl,
    pdfAttached: true,
  });
  const waMe = deliveryNoteWhatsAppHref({ text: message, phone, mode: 'wa.me' });
  const appHref = deliveryNoteWhatsAppHref({ text: message, phone, mode: 'whatsapp' });

  const share = async () => {
    setBusy(true);
    try {
      if (pdfUrl && typeof navigator !== 'undefined') {
        try {
          const pdfRes = await fetch(pdfUrl, { credentials: 'omit' });
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const pdfBlob =
              blob.type === 'application/pdf'
                ? blob
                : new Blob([blob], { type: 'application/pdf' });
            const shared = await sharePdfFileViaNavigator({
              blob: pdfBlob,
              filename: `${number || 'delivery-note'}.pdf`,
              title: `Delivery note ${number}`,
              text: attachedMessage,
            });
            if (shared.ok && shared.method === 'files') {
              toast.success('Share sheet opened with the PDF');
              return;
            }
            if (shared.error === 'cancelled') return;
          }
        } catch {
          /* fall through to WhatsApp link */
        }
      }
      const href = isMobileUa() ? appHref : waMe;
      window.open(href, '_blank', 'noopener,noreferrer');
      toast.message('WhatsApp opened with the delivery note link');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(viewUrl);
      toast.success('Delivery note link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void share()}
          disabled={busy || !viewUrl}
          className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5 border-emerald-300/70 text-emerald-800 hover:bg-emerald-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Share on WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!viewUrl}
          className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
        >
          <Copy className="h-4 w-4" />
          Copy link
        </button>
        <a
          href={pdfUrl || undefined}
          className={`btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5 ${
            pdfUrl ? '' : 'pointer-events-none opacity-50'
          }`}
          download
        >
          <FileDown className="h-4 w-4" />
          Download PDF
        </a>
      </div>
      <a
        href={waMe}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-xs font-medium text-[#0077b6] underline-offset-2 hover:underline"
      >
        {waMe}
      </a>
    </div>
  );
}
