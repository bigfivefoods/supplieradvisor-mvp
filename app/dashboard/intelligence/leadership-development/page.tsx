'use client';

import {
  CompanyRequired,
} from '@/components/intelligence/IntelligenceShell';
import SuperCubeTraining from '@/components/leadership/SuperCubeTraining';

export default function LeadershipDevelopmentPage() {
  return (
    <CompanyRequired>
      <SuperCubeTraining audience="dashboard" />
    </CompanyRequired>
  );
}
