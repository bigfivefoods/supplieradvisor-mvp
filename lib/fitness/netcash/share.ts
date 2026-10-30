import { formatZar } from '@/lib/fitness/netcash/money';

export function invoiceEmail(input: {
  gymName: string;
  memberName: string;
  invoiceNumber: string;
  totalCents: number;
  actionDate: string;
}): { subject: string; text: string } {
  const amount = formatZar(input.totalCents);
  return {
    subject: `${input.gymName} invoice ${input.invoiceNumber}`,
    text: [
      `Hello ${input.memberName},`,
      '',
      `${input.gymName} has issued invoice ${input.invoiceNumber} for ${amount}.`,
      `The debit order action date is ${input.actionDate}.`,
      'Please make sure the account has funds before that date.',
      '',
      'SupplierAdvisor® · GymAdvisor®',
    ].join('\n'),
  };
}

export function dunningEmail(input: {
  gymName: string;
  memberName: string;
  invoiceNumber: string;
  totalCents: number;
  reason: string;
}): { subject: string; text: string } {
  return {
    subject: `${input.gymName} debit order unpaid`,
    text: [
      `Hello ${input.memberName},`,
      '',
      `The debit order for invoice ${input.invoiceNumber} (${formatZar(input.totalCents)}) was unpaid.`,
      `Bank reason: ${input.reason}.`,
      'Please contact the gym so the membership can stay active.',
      '',
      'SupplierAdvisor® · GymAdvisor®',
    ].join('\n'),
  };
}

export function whatsappHref(phone: string, text: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function whatsappInvoiceText(input: {
  gymName: string;
  invoiceNumber: string;
  totalCents: number;
  actionDate: string;
}): string {
  return `${input.gymName} invoice ${input.invoiceNumber} for ${formatZar(input.totalCents)}. Debit date ${input.actionDate}. SupplierAdvisor® · GymAdvisor®`;
}
