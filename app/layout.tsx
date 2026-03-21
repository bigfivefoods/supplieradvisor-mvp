import type { Metadata } from "next";
import "./globals.css";
import { PrivyWrapper } from "@/lib/privy-provider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SupplierAdvisor MVP",
  description: "On-chain B2B/B2C supply chain platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="antialiased bg-black text-white min-h-screen overflow-hidden">
        <PrivyWrapper>{children}</PrivyWrapper>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}