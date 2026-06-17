export default function ManufacturingPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-black">Manufacturing • Full Suite</h1>
      <div className="grid grid-cols-2 gap-6 mt-6">
        <button className="btn-primary">Create BOM (Food + Film)</button>
        <button className="btn-primary">New Work Order + Routing</button>
        <button className="btn-primary">Capacity Planning + Grok Forecast</button>
        <button className="btn-primary">Yield & Costing Calculator</button>
      </div>
      <p className="mt-6 text-sm text-neutral-500">Grok AI button available on every card for instant assistance.</p>
    </div>
  );
}