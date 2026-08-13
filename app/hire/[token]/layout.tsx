import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'My hire portal · HireAdvisor',
  description:
    'Browse gear, request hires, complete requirements, and track bookings.',
  appleWebApp: {
    capable: true,
    title: 'Hire portal',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0891b2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function HireCustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
