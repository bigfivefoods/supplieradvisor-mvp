'use client';

import { Vat201Screen } from '@/components/accounting/Vat201Screen';

export default function Vat201PreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <Vat201Screen fixture />
    </main>
  );
}
