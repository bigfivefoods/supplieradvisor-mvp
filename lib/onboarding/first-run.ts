/**
 * First-run checklist for a new company.
 * Completion is derived from records the workspace already keeps.
 * Dismissal is localStorage only — no new table and no write to progress storage.
 */

export const FIRST_RUN_PROFILE_PCT = 70;

export const FIRST_RUN_DISMISS_KEY = 'sa_first_run_dismissed';

export type FirstRunStepId =
  | 'profile'
  | 'supplier'
  | 'customer'
  | 'purchase_order'
  | 'team'
  | 'verification';

export type FirstRunSignals = {
  profileCompleteness?: number | null;
  suppliers?: number | null;
  customers?: number | null;
  /** Buyer purchase orders of any status. Null when the payload has no total. */
  purchaseOrders?: number | null;
  openPurchaseOrders?: number | null;
  onchainPurchaseOrders?: number | null;
  teamActive?: number | null;
  teamInvited?: number | null;
  verified?: boolean | null;
};

export type FirstRunStep = {
  id: FirstRunStepId;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  optional: boolean;
};

export type FirstRunChecklist = {
  steps: FirstRunStep[];
  required: FirstRunStep[];
  doneRequired: number;
  requiredTotal: number;
  percent: number;
  complete: boolean;
  next: FirstRunStep | null;
};

function num(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Raised POs: an explicit total wins, including zero. Open/on-chain is the fallback. */
export function purchaseOrdersRaised(signals: FirstRunSignals): number {
  if (signals.purchaseOrders != null && Number.isFinite(Number(signals.purchaseOrders))) {
    return Math.max(0, Number(signals.purchaseOrders));
  }
  return Math.max(num(signals.openPurchaseOrders), num(signals.onchainPurchaseOrders));
}

export function firstRunDismissStorageKey(companyId: number): string {
  return `${FIRST_RUN_DISMISS_KEY}_${companyId}`;
}

export function deriveFirstRun(signals: FirstRunSignals): FirstRunChecklist {
  const profilePct = Math.max(0, Math.round(Number(signals.profileCompleteness) || 0));
  const suppliers = num(signals.suppliers);
  const customers = num(signals.customers);
  const purchaseOrders = purchaseOrdersRaised(signals);
  const teamActive = num(signals.teamActive);
  const teamInvited = num(signals.teamInvited);
  const verified = signals.verified === true;

  const steps: FirstRunStep[] = [
    {
      id: 'profile',
      title: 'Complete company profile',
      body: `Profile is ${profilePct}%. ${FIRST_RUN_PROFILE_PCT}% is complete — trading name, industry, and location.`,
      href: '/dashboard/my-business/profile',
      cta: 'Edit profile',
      done: profilePct >= FIRST_RUN_PROFILE_PCT,
      optional: false,
    },
    {
      id: 'supplier',
      title: 'Add first supplier',
      body:
        suppliers > 0
          ? `${suppliers} supplier${suppliers === 1 ? '' : 's'} on the book.`
          : 'Add the supplier you buy from before you raise an order.',
      href: '/dashboard/suppliers/add',
      cta: 'Add supplier',
      done: suppliers > 0,
      optional: false,
    },
    {
      id: 'customer',
      title: 'Add first customer',
      body:
        customers > 0
          ? `${customers} customer${customers === 1 ? '' : 's'} on the book.`
          : 'Add the customer you sell to.',
      href: '/dashboard/customers/onboard',
      cta: 'Add customer',
      done: customers > 0,
      optional: false,
    },
    {
      id: 'purchase_order',
      title: 'Raise first PO',
      body:
        purchaseOrders > 0
          ? `${purchaseOrders} purchase order${purchaseOrders === 1 ? '' : 's'} on record.`
          : 'One purchase order starts the trade loop.',
      href: '/dashboard/suppliers/po',
      cta: 'Raise PO',
      done: purchaseOrders > 0,
      optional: false,
    },
    {
      id: 'team',
      title: 'Invite a team member',
      body:
        teamInvited > 0
          ? `${teamInvited} invitation${teamInvited === 1 ? '' : 's'} waiting.`
          : teamActive >= 2
            ? `${teamActive} people can open this workspace.`
            : 'Invite one person so the workspace is not a single login.',
      href: '/dashboard/my-business/team',
      cta: 'Invite teammate',
      done: teamInvited > 0 || teamActive >= 2,
      optional: false,
    },
    {
      id: 'verification',
      title: 'Verify the company',
      body: verified
        ? 'Verified. The trust badge is on the company.'
        : 'Optional. Verification adds a trust badge. The workspace works without it.',
      href: '/dashboard/my-business/verifications',
      cta: 'Verify company',
      done: verified,
      optional: true,
    },
  ];

  const required = steps.filter((step) => !step.optional);
  const doneRequired = required.filter((step) => step.done).length;
  const requiredTotal = required.length;
  const percent =
    requiredTotal === 0 ? 0 : Math.round((doneRequired / requiredTotal) * 100);

  return {
    steps,
    required,
    doneRequired,
    requiredTotal,
    percent,
    complete: doneRequired === requiredTotal,
    next: required.find((step) => !step.done) || null,
  };
}
