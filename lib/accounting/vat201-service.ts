import { readCompanyProfile, readVatReturn, readVatSettings } from '@/lib/accounting/vat201-store';
import { loadVat201Report } from '@/lib/accounting/vat201-load';
import {
  currentOpenPeriod,
  periodByEnd,
  todayInJohannesburg,
  vatPeriods,
  type Vat201Report,
} from '@/lib/accounting/vat201-model';
import type { StoredVatReturn, StoredVatSettings } from '@/lib/accounting/vat201-store';
import type { VatPeriod } from '@/lib/accounting/vat201-model';

export async function composeVat201(profileId: number, periodEnd: string | null): Promise<{
  settings: StoredVatSettings;
  periods: VatPeriod[];
  period: VatPeriod | null;
  report: Vat201Report | null;
  stored: StoredVatReturn | null;
  warning?: string;
  drift: boolean;
}> {
  const today = todayInJohannesburg();
  const settings = await readVatSettings(profileId);
  const periods = vatPeriods(settings, today);
  const period =
    (periodEnd && periodByEnd(periods, periodEnd)) ||
    currentOpenPeriod(periods, today) ||
    periods[periods.length - 1] ||
    null;
  if (!period) {
    return { settings, periods, period: null, report: null, stored: null, warning: settings.warning, drift: false };
  }
  const stored = await readVatReturn(profileId, period.start, period.end);
  const profile = await readCompanyProfile(profileId);
  const loaded = await loadVat201Report({
    profileId,
    settings,
    period,
    today,
    companyName: profile.tradingName,
    companyAddress: profile.address,
    status: stored.status,
  });
  let report = loaded.report;
  let drift = false;
  if (stored.locked && stored.snapshot && typeof stored.snapshot === 'object') {
    const snap = stored.snapshot as Vat201Report;
    drift =
      Math.abs(Number(snap.totals?.outputTax || 0) - report.totals.outputTax) >= 0.05 ||
      Math.abs(Number(snap.totals?.inputTax || 0) - report.totals.inputTax) >= 0.05;
    report = { ...snap, status: stored.status, reminder: report.reminder, today };
  }
  const warning = [settings.warning, stored.warning, loaded.warning].filter(Boolean).join(' ') || undefined;
  return { settings, periods, period, report, stored, warning, drift };
}
