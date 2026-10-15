'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { DiaryView } from '@/components/construction/views/OpsViews';

export default function Page() {
  return <DeskScreen View={DiaryView} />;
}
