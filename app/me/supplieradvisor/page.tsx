import type { Metadata } from 'next';
import { SaOsDemoPortal } from '@/components/b2c/SaOsDemoPortal';

export const metadata: Metadata = {
  title: 'SupplierAdvisor OS demo',
  description:
    'Experience the SupplierAdvisor business OS from SA Member — trade, gym, clinic, hire, finance. Then start a company trial.',
};

export default function SupplierAdvisorOsDemoPage() {
  return <SaOsDemoPortal />;
}
