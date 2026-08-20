import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Gym check-in · GymAdvisor',
  description: 'Scan the gym QR and check in on your phone.',
  appleWebApp: {
    capable: false,
    title: 'SA Member',
  },
};

export const viewport: Viewport = {
  themeColor: '#E8E830',
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
