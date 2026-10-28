/**
 * In-memory sample for the delivery-note preview.
 * Negative ids are never saved. This module does not touch the database.
 */
import type { PublicDeliveryNote } from '@/lib/customers/delivery-note';

export const SAMPLE_DELIVERY_NOTE: PublicDeliveryNote = {
  number: 'DN-INV-1042',
  invoiceNumber: 'INV-1042',
  deliveryDate: '2026-10-28',
  customerName: 'Harbour Cafe',
  contactName: 'Ada Moyo',
  contactPhone: '+27 82 555 0142',
  deliveryAddress: 'Warehouse 3, Duncan Road, Cape Town',
  deliveredBy: 'Sam Nkosi',
  vehicleReg: 'CA 123-456',
  notes: 'Leave with the kitchen lead if the cafe is closed.',
  sellerName: 'Atlantic Roast Co',
  sellerAddress: '14 Jetty Street, Cape Town',
  sellerPhone: '+27 21 555 0100',
  sellerEmail: 'orders@atlantic-roast.example',
  logoUrl: null,
  lines: [
    {
      name: 'House blend 1kg',
      sku: 'HB-1',
      uom: 'bag',
      invoicedQty: 10,
      deliveredQty: 6,
    },
    {
      name: 'Oat milk 1L',
      sku: 'OM-1',
      uom: 'case',
      invoicedQty: 4,
      deliveredQty: 4,
    },
  ],
  receivedByName: '',
  receivedByDate: '',
  partial: true,
};
