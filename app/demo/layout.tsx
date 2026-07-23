import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive demo',
  description:
    'Click through SupplierAdvisor® product mocks — operations, suppliers, finance, quality, and more — without signing up.',
  alternates: { canonical: 'https://www.supplieradvisor.com/demo' },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
