import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white">
        {children}
      </body>
    </html>
  );
}
