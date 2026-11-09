/**
 * Persistent note when a financial report could not place every balance.
 * Toasts disappear. This stays on the statement.
 */
export default function LedgerCoverageNote({
  warning,
}: {
  warning?: string | null;
}) {
  const text = String(warning || '').trim();
  if (!text) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      {text}
    </p>
  );
}
