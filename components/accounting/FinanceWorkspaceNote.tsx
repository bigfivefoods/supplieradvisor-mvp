'use client';

export function FinanceWorkspaceNote({ className = '' }: { className?: string }) {
  return (
    <p
      className={`text-[11px] leading-relaxed text-slate-500 ${className}`}
      role="note"
    >
      Posted books are the <strong className="font-semibold text-slate-700">company ledger</strong>{' '}
      — one set of accounts (IFRS / GAAP). Your login keeps its own period, report tab, journal
      drafts, and unpublished budget so a colleague’s working copy does not overwrite yours until
      they post or publish.
    </p>
  );
}
