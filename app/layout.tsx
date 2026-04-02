'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import "./globals.css";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/sa-logo.png" type="image/png" />
      </head>
      <body className="antialiased">
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          config={{ 
            loginMethods: ['email', 'wallet'], 
            appearance: { theme: 'light' } 
          }}
        >
          {children}
          <Toaster position="top-center" />
        </PrivyProvider>
      </body>
    </html>
  );
}