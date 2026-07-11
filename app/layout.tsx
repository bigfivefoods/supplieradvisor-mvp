import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'SupplierAdvisor® — Supply Chain Operating System',
    template: '%s · SupplierAdvisor®',
  },
  description:
    'The verified supply-chain operating system for B2B, B2G & B2C — network trade, inventory, manufacturing, distribution, accounting, and AI intelligence. Light, precise, on-chain ready.',
  icons: {
    icon: '/sa-logo.png',
  },
  openGraph: {
    title: 'SupplierAdvisor® — Supply Chain Operating System',
    description:
      'Verified trade, inventory, manufacturing, distribution, and intelligence in one company workspace.',
    type: 'website',
    url: 'https://www.supplieradvisor.com',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Paystack Inline Script */}
        <script src="https://js.paystack.co/v1/inline.js" async />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}