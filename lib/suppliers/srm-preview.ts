/**
 * Client-only sample supply book. Negative ids never match a saved row.
 * Nothing here is written to the database.
 */
import type { SrmSupplierRecord, SupplierOtifefRow } from '@/lib/suppliers/types';

export function isSrmPreviewId(id: number | null | undefined): boolean {
  return typeof id === 'number' && Number.isFinite(id) && id < 0;
}

function day(today: string, offset: number): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export type SrmPreviewBook = {
  today: string;
  suppliers: SrmSupplierRecord[];
  purchaseOrders: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  scorecards: SupplierOtifefRow[];
};

export function srmPreviewBook(today = new Date().toISOString().slice(0, 10)): SrmPreviewBook {
  const ago = (n: number) => day(today, -n);
  const suppliers: SrmSupplierRecord[] = [
    {
      id: -11,
      trading_name: 'Kelpac Marine',
      legal_name: 'Kelpac Marine (Pty) Ltd',
      contact_name: 'Ayesha Khan',
      job_title: 'Sales director',
      email: 'ayesha@kelpac.example',
      phone: '+27 21 555 2200',
      website: 'https://kelpac.example',
      industry: 'Food & Beverage Processing',
      sub_industry: 'Seaweed extracts',
      category: 'Ingredients',
      city: 'Cape Town',
      province: 'Western Cape',
      country: 'South Africa',
      continent: 'Africa',
      address: '18 Harbour Road, Paarden Eiland',
      postal_code: '7405',
      vat_number: '4123456789',
      registration_number: '2008/009911/07',
      payment_terms: 'Net 30',
      status: 'preferred',
      invite_status: 'accepted',
      certifications: ['HACCP', 'ISO 22000', 'Organic'],
      bee_level: 'Level 1',
      verified: true,
      trust_score: 91,
      otifef_pct: 96,
      rating_avg: 4.8,
      rating_count: 12,
      owner_name: 'Craig Muller',
      notes: 'Preferred kelp supplier. Confirm the cold chain on Friday loads.',
      tags: ['Preferred', 'Cold chain'],
      metadata: {
        vat_certificate_url: 'https://example.invalid/kelpac-vat.pdf',
        bee_certificate_url: 'https://example.invalid/kelpac-bee.pdf',
        registration_certificate_url: 'https://example.invalid/kelpac-cipc.pdf',
        contacts: [
          {
            name: 'Pieter Visser',
            role: 'Dispatch',
            email: 'pieter@kelpac.example',
            phone: '+27 21 555 2204',
          },
        ],
      },
      invited_at: ago(80),
      invite_accepted_at: ago(70),
      created_at: ago(120),
      updated_at: ago(2),
    },
    {
      id: -12,
      trading_name: 'Noord Mill',
      legal_name: 'Noord Mill Co-op',
      status: 'prospect',
      invite_status: 'not_invited',
      city: 'Polokwane',
      country: 'South Africa',
      industry: 'Agriculture & Farming',
      notes: null,
      created_at: ago(9),
      updated_at: ago(9),
    },
  ];

  const purchaseOrders = [
    {
      id: -501,
      po_number: 'PO-4410',
      status: 'accepted',
      total_amount: 186400,
      currency: 'ZAR',
      supplier_id: -11,
      supplier_name: 'Kelpac Marine',
      created_at: ago(6),
    },
    {
      id: -502,
      po_number: 'PO-4388',
      status: 'completed',
      total_amount: 94200,
      currency: 'ZAR',
      supplier_id: -11,
      supplier_name: 'Kelpac Marine',
      created_at: ago(28),
    },
  ];

  const documents = [
    {
      id: -801,
      supplier_id: -11,
      title: 'Kelpac price list Q4',
      doc_type: 'price_list',
      file_url: 'https://example.invalid/kelpac-prices.pdf',
      updated_at: ago(4),
    },
  ];

  const scorecards: SupplierOtifefRow[] = [
    {
      supplier_id: -11,
      srm_supplier_id: -11,
      name: 'Kelpac Marine',
      overall: 96,
      ot_percent: 98,
      if_percent: 99,
      ef_percent: 99,
      ot_days: 0.4,
      total_pos: 18,
    },
  ];

  return { today, suppliers, purchaseOrders, documents, scorecards };
}

/** Answers SRM GETs with the sample book. Returns null for anything else. */
export function srmPreviewJson(url: string): unknown | null {
  let path = url;
  let params = new URLSearchParams();
  try {
    const parsed = new URL(url, 'http://preview.local');
    path = parsed.pathname;
    params = parsed.searchParams;
  } catch {
    return null;
  }
  if (!path.startsWith('/api/')) return null;
  const book = srmPreviewBook();
  if (path === '/api/suppliers' || path.startsWith('/api/suppliers?')) {
    const id = Number(params.get('id') || 0);
    if (id) {
      const found = book.suppliers.find((row) => row.id === id);
      return { success: true, suppliers: found ? [found] : [] };
    }
    return { success: true, suppliers: book.suppliers };
  }
  if (path.startsWith('/api/suppliers/purchase-orders')) {
    return { success: true, purchaseOrders: book.purchaseOrders, counts: { total: book.purchaseOrders.length } };
  }
  if (path.startsWith('/api/suppliers/documents')) {
    const supplierId = Number(params.get('supplierId') || 0);
    const documents = supplierId
      ? book.documents.filter((doc) => Number(doc.supplier_id) === supplierId)
      : book.documents;
    return { success: true, documents };
  }
  if (path.startsWith('/api/suppliers/otifef')) {
    return { success: true, rows: book.scorecards, summary: null };
  }
  if (path.startsWith('/api/accounting/parties')) return { parties: [] };
  return { success: true };
}
