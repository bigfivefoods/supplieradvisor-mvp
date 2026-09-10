import type { ReactNode } from 'react';

/** Desks live on the dashboard process rail and sidenav — no in-page tab strip. */
export default function ConstructiongraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
