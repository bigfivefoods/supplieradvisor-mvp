export function maskId(last4: string | null | undefined): string {
  const tail = String(last4 || '').replace(/\D/g, '').slice(-4);
  if (tail.length !== 4) return '••••••';
  return `•••••• ${tail}`;
}
