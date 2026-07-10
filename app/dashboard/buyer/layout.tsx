'use client';

/**
 * Buyer portal layout — company-scoped via selected company + membership checks
 * on server APIs. Child pages use BuyerCompanyRequired for the switcher gate.
 */
export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">{children}</div>;
}
