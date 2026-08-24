/**
 * How SupplierAdvisor OTIFEF is calculated — same formula everywhere.
 * OTIFEF = On-Time × In-Full × Error-Free, each as a 0–100 score.
 */
export const OTIFEF_FORMULA =
  'OTIFEF = (On-time % × In-full % × Error-free %) ÷ 10,000';

export const OTIFEF_STEPS: Array<{ label: string; body: string }> = [
  {
    label: 'On time',
    body: 'Share of delivered orders where the actual date is on or before the promised date.',
  },
  {
    label: 'In full',
    body: 'Quantity delivered ÷ quantity ordered (capped at 100%).',
  },
  {
    label: 'Error-free',
    body: '(Quantity delivered − damaged / rejected) ÷ quantity delivered.',
  },
  {
    label: 'OTIFEF',
    body: 'The three percentages are multiplied, then divided by 10,000 so a 90 × 90 × 90 run is 72.9%, not 90%.',
  },
];

export function otifefExplainFor(kind: 'customer' | 'supplier'): string {
  return kind === 'supplier'
    ? 'Supplier OTIFEF is how they delivered to you on purchase orders.'
    : 'Customer OTIFEF is how you delivered to them on sales orders.';
}
