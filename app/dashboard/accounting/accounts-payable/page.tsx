'use client';

import InvoiceWorkspace from '@/components/accounting/InvoiceWorkspace';

export default function AccountsPayablePage() {
  return (
    <InvoiceWorkspace
      direction="payable"
      title="Accounts"
      titleAccent="payable"
      description="Supplier bills, credit notes, and payment runs — track what you owe and clear it cleanly."
    />
  );
}
