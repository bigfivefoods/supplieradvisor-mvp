/**
 * FleetAdvisor® cost-per-kilometre copy. The screen and the how-to share it.
 * Distance is not taken from a position.
 */
import { TEAM_ROLE_OPTIONS } from '../business/permissions';
import { capabilitiesFor, resolveFleetRole } from './roles';

export const CPK_DISTANCE_NOTE =
  'Distance uses completed trip readings when they exist, otherwise odometer pairs. Planned kilometres are never used. A partial result names what is still missing. Targets are yours. There is no external benchmark.';

/** Company roles whose fleet role can open cost per kilometre. */
export function costPerKmOpenerLabels(): string[] {
  return TEAM_ROLE_OPTIONS.filter((option) => capabilitiesFor(resolveFleetRole(option.value)).seesCosts).map(
    (option) => option.label
  );
}

function andList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] || 'An owner';
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function costPerKmHiddenHint(): string {
  return `${andList(costPerKmOpenerLabels())} can open cost per kilometre. You can still work with vehicles, drivers and jobs.`;
}
