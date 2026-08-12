import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Gym check-in · GymAdvisor',
  description: 'Scan the gym QR and check in on your phone.',
  appleWebApp: {
    capable: true,
    title: 'Gym check-in',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function GymCheckinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
