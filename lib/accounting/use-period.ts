'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import type { PeriodPreset } from '@/lib/accounting/fiscal';

/** Load company FY start and keep a PeriodSlicer in sync (cash-flow page pattern). */
export function useAccountingPeriod(
  companyId: number,
  privyUserId: string | null | undefined,
  preset: Exclude<PeriodPreset, 'custom'> = 'full_fy'
): {
  fyStartMonth: number;
  period: PeriodSlicerValue;
  setPeriod: Dispatch<SetStateAction<PeriodSlicerValue>>;
} {
  const [fyStartMonth, setFyStartMonth] = useState(3);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue(preset, 3)
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/accounting/settings?${params}`);
        const data = await res.json();
        const sm = Number(data.settings?.fiscal_year_start_month || 3);
        if (!cancelled && sm >= 1 && sm <= 12) {
          setFyStartMonth(sm);
          setPeriod((prev) =>
            prev.preset === preset ? initialPeriodSlicerValue(preset, sm) : prev
          );
        }
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId, preset]);

  return { fyStartMonth, period, setPeriod };
}
