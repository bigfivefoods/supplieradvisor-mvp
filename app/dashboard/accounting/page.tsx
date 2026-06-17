export default function AccountingPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-black">Accounting</h1>
      <div className="flex gap-4 mt-4">
        <button className="px-5 py-2 bg-neutral-900 text-white rounded-xl">Commercial</button>
        <button className="px-5 py-2 border rounded-xl">Financials & Ledger</button>
      </div>
    </div>
  );
}