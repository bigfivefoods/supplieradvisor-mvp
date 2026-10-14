/** Load the supplier payout address at the moment the buyer pays on-chain. */
export async function fetchOnchainPayeeWallet(args: {
  companyId: number;
  poId?: number | null;
  supplierProfileId?: number | null;
  privyUserId?: string | null;
}): Promise<string> {
  const params = new URLSearchParams({
    companyId: String(args.companyId),
    intent: 'onchain_payment',
  });
  if (args.poId && args.poId > 0) params.set('poId', String(args.poId));
  if (args.supplierProfileId && args.supplierProfileId > 0) {
    params.set('supplierProfileId', String(args.supplierProfileId));
  }
  if (args.privyUserId) params.set('privyUserId', args.privyUserId);
  const res = await fetch(`/api/suppliers/purchase-orders/payee?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not load the supplier payout wallet');
  }
  const address = String(data.wallet_address || '');
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('This supplier has not set a payout wallet on SupplierAdvisor®');
  }
  return address;
}
