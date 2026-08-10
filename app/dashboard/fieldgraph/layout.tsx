import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'CropAdvisor®',
    template: '%s · CropAdvisor® · SupplierAdvisor',
  },
  description:
    'CropAdvisor® — multi-crop field book, estimates, harvest planner, inputs, fleet, labour, regen, and farm-to-buyer trade on SupplierAdvisor.',
};

export default function CropAdvisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
