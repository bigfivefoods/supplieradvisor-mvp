'use client';

import SuperCubeTraining from '@/components/leadership/SuperCubeTraining';

/**
 * Container operator portal — Super-Cube® leadership training.
 * Local progress + optional cloud save when company context exists.
 */
export default function ContractorLeadershipPage() {
  return <SuperCubeTraining audience="operator" embedded />;
}
