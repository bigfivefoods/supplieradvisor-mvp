/**
 * BankServ / Netcash unpaid reason codes used on debit-order statements.
 * Retryable codes are the ones a gym can sensibly collect again
 * (not provided for, effects not cleared, technical). Closed accounts,
 * stopped payments, and no-authority codes are not retried.
 */

export type ReasonInfo = {
  code: string;
  label: string;
  retryable: boolean;
  suspendSuggested: boolean;
};

const REASONS: Record<string, ReasonInfo> = {
  '00': { code: '00', label: 'Paid', retryable: false, suspendSuggested: false },
  '02': { code: '02', label: 'Not provided for', retryable: true, suspendSuggested: false },
  '03': { code: '03', label: 'Debits not allowed to this account', retryable: false, suspendSuggested: true },
  '04': { code: '04', label: 'Payment stopped', retryable: false, suspendSuggested: true },
  '06': { code: '06', label: 'Account frozen', retryable: false, suspendSuggested: true },
  '08': { code: '08', label: 'Account in sequestration', retryable: false, suspendSuggested: true },
  '10': { code: '10', label: 'Account in liquidation', retryable: false, suspendSuggested: true },
  '12': { code: '12', label: 'Account closed', retryable: false, suspendSuggested: true },
  '18': { code: '18', label: 'Account holder deceased', retryable: false, suspendSuggested: true },
  '22': { code: '22', label: 'Account effects not cleared', retryable: true, suspendSuggested: false },
  '26': { code: '26', label: 'No such account', retryable: false, suspendSuggested: true },
  '28': { code: '28', label: 'Recall / reversal', retryable: false, suspendSuggested: false },
  '30': { code: '30', label: 'No authority to debit', retryable: false, suspendSuggested: true },
  '32': { code: '32', label: 'Debit in contravention of payer authority', retryable: false, suspendSuggested: true },
  '34': { code: '34', label: 'Authorisation cancelled', retryable: false, suspendSuggested: true },
  '36': { code: '36', label: 'Previously stopped', retryable: false, suspendSuggested: true },
  '56': { code: '56', label: 'Not FICA compliant', retryable: false, suspendSuggested: true },
  '99': { code: '99', label: 'Unpaid — technical', retryable: true, suspendSuggested: false },
};

export function reasonInfo(code: string): ReasonInfo {
  const key = String(code || '').padStart(2, '0');
  return (
    REASONS[key] || {
      code: key,
      label: 'Unpaid',
      retryable: false,
      suspendSuggested: false,
    }
  );
}

export function reasonCatalogue(): ReasonInfo[] {
  return Object.values(REASONS);
}
