import { after } from 'next/server';
import { setActivityScheduler } from '@/lib/business/access';

type AfterFn = (task: () => void) => void;

/**
 * Register the stamp with Next's after() so the serverless isolate keeps it.
 * If after() is unavailable (no request scope), the task still runs.
 * This file is loaded from instrumentation, not from the client graph.
 */
export function scheduleWithAfter(
  task: () => Promise<void>,
  afterFn: AfterFn = after
): void {
  try {
    afterFn(() => {
      void task().catch(() => undefined);
    });
  } catch {
    void task().catch(() => undefined);
  }
}

export function installActivityAfter(): void {
  setActivityScheduler((task) => scheduleWithAfter(task));
}
