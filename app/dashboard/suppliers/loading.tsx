import { SrmSkeleton } from '@/components/suppliers/srm/SrmDesk';

export default function DashboardSectionLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-28 animate-pulse rounded-3xl bg-slate-200/80" />
      <SrmSkeleton variant="cards" rows={4} />
      <SrmSkeleton rows={5} />
    </div>
  );
}
