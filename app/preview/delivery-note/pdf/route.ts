import { NextResponse } from 'next/server';
import {
  buildDeliveryNotePdf,
  deliveryNotePdfFilename,
} from '@/lib/customers/delivery-note-pdf';
import { SAMPLE_DELIVERY_NOTE } from '@/lib/customers/delivery-note-sample';

/** Sample PDF for the preview page. Does not read or write the database. */
export async function GET() {
  const pdf = await buildDeliveryNotePdf(SAMPLE_DELIVERY_NOTE);
  const filename = deliveryNotePdfFilename(SAMPLE_DELIVERY_NOTE.number);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
