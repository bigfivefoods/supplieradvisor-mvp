import { whoWrites, writeRolesForCap, type CoreCapKey } from '../core-caps';
import type { FlowStepDef, FlowTarget } from '../types';

export function target(
  scope: 'module' | 'app',
  path: string,
  label: string,
  needs: CoreCapKey
): FlowTarget {
  return { scope, path, label, needs };
}

export function flowStep(
  step: Omit<FlowStepDef, 'roles' | 'who'> & { needs: CoreCapKey }
): FlowStepDef {
  const { needs, ...rest } = step;
  return {
    ...rest,
    roles: writeRolesForCap(needs),
    who: whoWrites(needs),
  };
}
