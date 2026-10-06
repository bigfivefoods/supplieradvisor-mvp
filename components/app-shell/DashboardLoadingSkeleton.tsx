export default function DashboardLoadingSkeleton() {
  return (
    <main className="w-full p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="h-8 w-64 rounded-xl bg-slate-200/80" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200/70" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-40 rounded-2xl bg-slate-200/70" />
          <div className="h-40 rounded-2xl bg-slate-200/70" />
          <div className="h-40 rounded-2xl bg-slate-200/70" />
        </div>
        <div className="h-72 rounded-3xl bg-slate-200/65" />
      </div>
    </main>
  );
}
