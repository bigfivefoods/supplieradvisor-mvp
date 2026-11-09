/**
 * Shared sales segment. Auth stays in the portal group layout.
 * /sales/agreement does not inherit that layout, so its first scripts
 * do not include the Privy SDK.
 */
export default function SalesSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
