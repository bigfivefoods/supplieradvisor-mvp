/**
 * Advisor invoices on a patient / member portal payload.
 */
import {
  chargesForMember,
  readMemberAccountStore,
} from '@/lib/b2c/member-account';
import type { AdvisorAccountKind } from '@/lib/b2c/member-account-types';

export type PortalInvoice = {
  id: string;
  description: string;
  amount_zar: number;
  status: string;
  invoice_number?: string | null;
  due_date?: string | null;
  created_at: string;
};

export function portalInvoicesForPerson(
  meta: Record<string, unknown>,
  opts: {
    kind: AdvisorAccountKind;
    refId: string;
    email?: string | null;
    userId?: string | null;
  }
): PortalInvoice[] {
  return chargesForMember(readMemberAccountStore(meta), {
    kind: opts.kind,
    ref_id: opts.refId,
    email: opts.email,
    userId: opts.userId,
  })
    .filter((c) => c.status !== 'void')
    .map((c) => ({
      id: c.id,
      description: c.description,
      amount_zar: c.amount_zar,
      status: c.status,
      invoice_number: c.invoice_number || null,
      due_date: c.due_date || null,
      created_at: c.created_at,
    }));
}

export function withPortalInvoices<T extends object>(
  portal: T,
  meta: Record<string, unknown>,
  opts: {
    kind: AdvisorAccountKind;
    refId: string;
    email?: string | null;
    userId?: string | null;
  }
): T & { invoices: PortalInvoice[] } {
  return {
    ...portal,
    invoices: portalInvoicesForPerson(meta, opts),
  };
}
