'use client';

import InvoiceWorkspace from '@/components/accounting/InvoiceWorkspace';

export default function AccountsReceivablePage() {
  return (
    <InvoiceWorkspace
      direction="receivable"
      title="Accounts"
      titleAccent="receivable"
      description="Customer invoices, collections, partial payments, and overdue balances — one AR ledger."
    />
  );
}
