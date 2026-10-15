'use client';

import type { ComponentType } from 'react';
import { ConstructiongraphPage, ConstructiongraphRequired } from '@/components/construction/ConstructiongraphShell';
import { useConstructionDesk, type DeskProps } from '@/components/construction/desk';

export function DeskScreen({ View }: { View: ComponentType<DeskProps> }) {
  const desk = useConstructionDesk();
  return (
    <ConstructiongraphRequired>
      <ConstructiongraphPage>
        <View {...desk} />
      </ConstructiongraphPage>
    </ConstructiongraphRequired>
  );
}
