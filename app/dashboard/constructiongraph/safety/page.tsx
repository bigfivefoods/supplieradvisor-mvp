'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { SafetyView } from '@/components/construction/views/OpsViews';

export default function Page() {
  return <DeskScreen View={SafetyView} />;
}
