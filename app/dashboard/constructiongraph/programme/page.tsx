'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { ProgrammeView } from '@/components/construction/views/OpsViews';

export default function Page() {
  return <DeskScreen View={ProgrammeView} />;
}
