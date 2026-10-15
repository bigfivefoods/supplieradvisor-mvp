import type { RecoverWorkspace } from './types';

export class RealDataBlockedError extends Error {
  constructor() {
    super(
      'RecoverAdvisor® is in demo-data mode until data-location and operator-agreement sign-off is complete.'
    );
    this.name = 'RealDataBlockedError';
  }
}

/** Later briefs that ingest debtor data must call this first. */
export function assertRealDataAllowed(
  workspace: Pick<RecoverWorkspace, 'real_data_enabled'> | null | undefined
): void {
  if (!workspace?.real_data_enabled) {
    throw new RealDataBlockedError();
  }
}
