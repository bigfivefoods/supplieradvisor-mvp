import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: {
    default: 'SupplierAdvisor®',
    template: '%s · SupplierAdvisor®',
  },
  description:
    'Verified, transparent supply-chain platform for B2B, B2G, and B2C — blockchain verification, AI insights, and ethical transparency.',
  icons: {
    icon: '/sa-logo.png',
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