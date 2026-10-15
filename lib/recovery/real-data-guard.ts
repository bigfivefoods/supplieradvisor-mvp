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

export class DemoBookBlockedError extends Error {
  constructor() {
    super('The fictional Harbour demo book can be loaded only while real debtor data is off.');
    this.name = 'DemoBookBlockedError';
  }
}

/** Demo book load is the inverse of the real-data gate. */
export function assertDemoBookAllowed(
  workspace: Pick<RecoverWorkspace, 'real_data_enabled'> | null | undefined
): void {
  if (workspace?.real_data_enabled) {
    throw new DemoBookBlockedError();
  }
}
