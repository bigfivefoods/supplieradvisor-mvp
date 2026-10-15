'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { CommandView } from '@/components/construction/views/CommandView';

export default function Page() {
  return <DeskScreen View={CommandView} />;
}
