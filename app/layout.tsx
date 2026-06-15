import type { Metadata } from 'next';
import "./globals.css";

export const metadata: Metadata = {
  title: 'SupplierAdvisor',
  description: 'Business Network for Africa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/sa-logo.png" type="image/png" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}