/**
 * Public, human-readable trust score documentation.
 * Formula must stay aligned with lib/suppliers/types.ts computeTrustScore.
 */

export const TRUST_FORMULA = {
  weights: {
    otifef: 0.45,
    peerStars: 0.35,
    verification: 0.2,
  },
  description:
    'Trust combines delivery performance (OTIFEF), peer star ratings from suppliers and customers, and verification status.',
} as const;

export function explainTrustComponents(opts: {
  otifef?: number | null;
  starAvg?: number | null;
  starCount?: number;
  verified?: boolean;
  trustScore?: number | null;
}) {
  const ot = Math.max(0, Math.min(100, Number(opts.otifef || 0)));
  const stars = Math.max(0, Math.min(5, Number(opts.starAvg || 0)));
  const ratingPts = (stars / 5) * 100;
  const verifiedBonus = opts.verified ? 100 : 40;
  const w = TRUST_FORMULA.weights;

  const otContrib = Math.round(ot * w.otifef * 10) / 10;
  const starContrib = Math.round(ratingPts * w.peerStars * 10) / 10;
  const verContrib = Math.round(verifiedBonus * w.verification * 10) / 10;
  const computed = Math.round(otContrib + starContrib + verContrib);

  return {
    formula: TRUST_FORMULA,
    inputs: {
      otifefPct: ot || null,
      starAvg: stars > 0 ? stars : null,
      starCount: opts.starCount || 0,
      verified: Boolean(opts.verified),
      storedTrust: opts.trustScore ?? null,
    },
    contributions: {
      otifef: otContrib,
      peerStars: starContrib,
      verification: verContrib,
    },
    computed,
    howToImprove: [
      {
        title: 'Improve OTIFEF',
        body: 'Deliver On-Time, In-Full, Error-Free. Close POs and shipments with accurate dates and quantities.',
      },
      {
        title: 'Earn peer stars',
        body: 'Trade with network partners and request ratings after delivery. You are rated by suppliers and customers in a continuous loop.',
      },
      {
        title: 'Get verified',
        body: 'Complete company verification so counterparties trust your identity and legal standing.',
      },
      {
        title: 'Invite real partners',
        body: 'Grow your network with companies you actually trade with — density increases ratings and OTIFEF signal quality.',
      },
    ],
  };
}

export const TRUST_PUBLIC_COPY = {
  loopTitle: 'Continuous trust loop',
  loopBody:
    'Companies are rated by their suppliers and customers — peer stars for how they trade, and OTIFEF (On-Time · In-Full · Error-Free) for delivery. That loop helps every business improve and builds trust you can see before you trade.',
  emptyTrust: 'New on the network — trade and collect ratings to build trust',
  emptyOtifef: 'No OTIFEF yet — complete deliveries to earn a score',
  emptyStars: 'No peer stars yet — rate after your first trade',
} as const;
