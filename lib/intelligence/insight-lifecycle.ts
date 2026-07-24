/**
 * Insight auto-close + dismiss persistence (client + server-friendly).
 * When the underlying pulse metric heals, critical/warning insights drop.
 */
import type { Insight, PulseInput } from '@/lib/intelligence/engine';

/** Map insight id → predicate that returns true when the issue is still open */
const STILL_OPEN: Record<string, (p: PulseInput) => boolean> = {
  'pending-in': (p) => p.networkPendingIn > 0,
  'no-network': (p) => p.networkAccepted === 0,
  'pricing-gap': (p) => p.pricingActive === 0 && p.networkAccepted > 0,
  'wallet-missing': (p) => !p.walletReady,
  'otifef-low': (p) => p.srmAvgOtifef > 0 && p.srmAvgOtifef < 80,
  'no-suppliers': (p) => p.srmBook === 0,
  'supplier-concentration': (p) => p.topSupplierShare >= 60 && p.supplierPoCount > 1,
  'po-backlog': (p) => p.openPos > 10,
  'leads-stuck': (p) => p.openLeads > 5 && p.openOpps === 0,
  'quote-win': (p) => p.quoteWinRate > 0 && p.quoteWinRate < 25 && p.quotesCount >= 4,
  'no-customers': (p) => p.customersActive === 0 && p.customers === 0,
  'ar-exposure': (p) => p.arBalance > 0 && p.arOpen > 0,
  'ap-pressure': (p) => p.apOpen > 8,
  'low-stock': (p) => p.lowStock > 0,
  'no-products': (p) => p.products === 0,
  'qa-failed': (p) => (p.qualityFailed || 0) > 0,
  'qa-pass-low': (p) =>
    p.qualityPassRate != null &&
    p.qualityPassRate < 85 &&
    (p.qualityOpen || 0) + (p.qualityFailed || 0) >= 3,
  'sheq-open': (p) => (p.sheqOpen || 0) > 0,
  'esg-certs-expiring': (p) => (p.esgCertExpiring || 0) > 0,
  'esg-no-targets': (p) =>
    (p.esgTargetsActive || 0) === 0 && (p.esgTotalKg || 0) > 0,
  'esg-no-inventory': (p) => (p.esgTotalKg || 0) === 0 && p.products > 0,
  'pm-riads': (p) => (p.projectsOpenRiads || 0) > 0,
  'dmaic-stuck': (p) => (p.dmaicStuck || 0) > 0,
  'leadership-weak-edge': (p) =>
    typeof p.leadershipWeakScore === 'number' && p.leadershipWeakScore < 6,
  'leadership-physical-burnout': (p) =>
    typeof p.leadershipPhysical === 'number' &&
    p.leadershipPhysical < 6 &&
    ((p.sheqOpen || 0) > 0 || p.lowStock > 3),
  'leadership-emotional-safety': (p) =>
    typeof p.leadershipEmotional === 'number' &&
    p.leadershipEmotional < 6 &&
    (p.sheqOpen || 0) > 2,
  'stuck-receive': (p) => (p.stuckReceive || 0) > 0,
  'stuck-settle': (p) => (p.stuckSettle || 0) > 0,
  'escrow-release': (p) => (p.escrowAwaitingRelease || 0) > 0,
  'leadership-not-assessed': (p) => !p.leadershipAssessed,
  'leadership-choices-settle': (p) =>
    typeof p.leadershipChoices === 'number' &&
    p.leadershipChoices < 6 &&
    (p.stuckSettle || 0) + (p.escrowAwaitingRelease || 0) > 0,
};

export function isInsightStillOpen(insightId: string, pulse: PulseInput): boolean {
  const fn = STILL_OPEN[insightId];
  if (!fn) return true; // unknown ids stay unless dismissed
  return fn(pulse);
}

/** Drop healed issues; keep positive/info unless dismissed */
export function filterHealedInsights(
  insights: Insight[],
  pulse: PulseInput,
  dismissedIds: Set<string> | string[] = []
): Insight[] {
  const dismissed = dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds);
  return insights.filter((ins) => {
    if (dismissed.has(ins.id)) return false;
    if (ins.severity === 'positive') return true;
    return isInsightStillOpen(ins.id, pulse);
  });
}

const DISMISS_KEY = 'sa-insight-dismissed';

export function loadDismissedInsightIds(companyId: number | null): string[] {
  if (typeof window === 'undefined' || !companyId) return [];
  try {
    const raw = localStorage.getItem(`${DISMISS_KEY}-${companyId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ids?: string[]; at?: string };
    return Array.isArray(parsed.ids) ? parsed.ids : [];
  } catch {
    return [];
  }
}

export function dismissInsightId(companyId: number, insightId: string): string[] {
  const ids = new Set(loadDismissedInsightIds(companyId));
  ids.add(insightId);
  const list = [...ids].slice(-80);
  try {
    localStorage.setItem(
      `${DISMISS_KEY}-${companyId}`,
      JSON.stringify({ ids: list, at: new Date().toISOString() })
    );
  } catch {
    /* ignore */
  }
  return list;
}

export function clearDismissedInsights(companyId: number) {
  try {
    localStorage.removeItem(`${DISMISS_KEY}-${companyId}`);
  } catch {
    /* ignore */
  }
}
