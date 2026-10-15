'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { DocumentsView } from '@/components/construction/views/AssureViews';

export default function Page() {
  return <DeskScreen View={DocumentsView} />;
}
