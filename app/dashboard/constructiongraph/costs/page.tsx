'use client';

import { DeskScreen } from '@/components/construction/DeskScreen';
import { CostsView } from '@/components/construction/views/MoneyViews';

export default function Page() {
  return <DeskScreen View={CostsView} />;
}
