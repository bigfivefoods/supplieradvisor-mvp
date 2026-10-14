/**
 * TradeAdvisor® PWA roles, mirroring GymAdvisor.
 * Owner opens the business app. Technicians get the work app (the coach
 * pattern). Clients get the customer app. Money follows the company
 * permission matrix: operations and employed technicians do not see it.
 */
import { canAccess, canManageTeam, normalizeTeamRole } from '../business/permissions';

export type TradePwaRole = 'owner' | 'technician' | 'client';

export type TradePwaCapabilities = {
  role: TradePwaRole;
  allJobs: boolean;
  team: boolean;
  money: boolean;
  reports: boolean;
  quotes: boolean;
  variations: boolean;
  photos: boolean;
  time: boolean;
  materials: boolean;
};

export function tradePwaCapabilities(role: string | null | undefined): TradePwaCapabilities {
  const normalized = normalizeTeamRole(role);
  const money = canAccess(normalized, 'accounting', 'view');
  const ownerLike = normalized === 'owner' || normalized === 'admin' || normalized === 'finance';
  return {
    role: ownerLike ? 'owner' : 'technician',
    allJobs: ownerLike,
    team: ownerLike || canManageTeam(normalized),
    money,
    reports: ownerLike,
    quotes: ownerLike || normalized === 'sales' || normalized === 'sales_contractor',
    variations: ownerLike || normalized === 'operations',
    photos: true,
    time: true,
    materials: true,
  };
}

export function tradeClientCapabilities(): TradePwaCapabilities {
  return {
    role: 'client',
    allJobs: false,
    team: false,
    money: true,
    reports: false,
    quotes: true,
    variations: true,
    photos: true,
    time: false,
    materials: false,
  };
}

/** Gym coach portal is /coach/fitgraph. Technicians use the same shape. */
export function technicianPortalPath(token: string): string {
  return `/crew/tradegraph/${encodeURIComponent(token)}`;
}

export function clientPortalPath(token: string): string {
  return `/customer/tradegraph/${encodeURIComponent(token)}`;
}

export function ownerPortalPath(): string {
  return '/work/tradegraph';
}
