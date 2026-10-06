'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  PlatformGateState,
  PlatformOverview,
  PlatformShell,
  usePlatformConsole,
} from '@/components/platform/PlatformConsole';
import { useApiAuth } from '@/lib/client/use-api-auth';

/**
 * SupplierAdvisor platform admin console — system-wide control plane.
 * Owners come from env PLATFORM_OWNER_EMAILS (never hardcoded inboxes).
 */
export default function PlatformConsolePage() {
  const { withAuth } = useApiAuth();
  const { data, loading, error, forbidden, load, switchToPlatform } =
    usePlatformConsole();
  const [migrating, setMigrating] = useState<'dry' | 'copy' | 'delete' | null>(null);

  const runStorageMigration = async (mode: 'dry' | 'copy' | 'delete') => {
    setMigrating(mode);
    try {
      const qs =
        mode === 'copy'
          ? '?apply=1'
          : mode === 'delete'
            ? '?deleteOriginals=1'
            : '?dryRun=1';
      const res = await withAuth(`/api/system/platform-console/storage-migrate${qs}`, {
        method: 'POST',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Migration request failed');
      toast.success(
        `Sensitive storage ${mode === 'dry' ? 'dry run' : mode === 'copy' ? 'copy' : 'delete'} complete`,
        {
          description: `Candidates: ${payload.candidates ?? 0}; copied: ${payload.copied ?? 0}; deleted: ${payload.deleted ?? 0}`,
        }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Migration failed');
    } finally {
      setMigrating(null);
    }
  };

  return (
    <PlatformShell
      title="Platform"
      description="Admin portal for supplieradvisor.com — how the whole system is working."
      onRefresh={() => void load()}
      loading={loading}
    >
      <PlatformGateState
        loading={loading}
        forbidden={forbidden}
        error={error}
        onRetry={() => void load()}
      />
      {!loading && !forbidden && !error && data ? (
        <div className="space-y-5">
          <PlatformOverview data={data} onSwitch={switchToPlatform} />
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="text-sm font-black text-slate-900">Sensitive storage migration</h3>
            <p className="mt-1 text-xs text-slate-500">
              Dry-run by default. Copy migrates legacy sensitive files to private storage. Delete
              originals only removes files with a verified private copy.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-3 text-xs"
                disabled={migrating != null}
                onClick={() => void runStorageMigration('dry')}
              >
                {migrating === 'dry' ? 'Running…' : 'Dry run'}
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-3 text-xs"
                disabled={migrating != null}
                onClick={() => void runStorageMigration('copy')}
              >
                {migrating === 'copy' ? 'Copying…' : 'Copy'}
              </button>
              <button
                type="button"
                className="btn-secondary !py-2 !px-3 text-xs"
                disabled={migrating != null}
                onClick={() => void runStorageMigration('delete')}
              >
                {migrating === 'delete' ? 'Deleting…' : 'Delete originals'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PlatformShell>
  );
}
