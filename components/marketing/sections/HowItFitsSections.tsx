export default function HowItFitsSections() {
  const steps = [
    'Map your current process and data flow.',
    'Enable Core OS and the modules you need first.',
    'Connect suppliers, customers, and internal teams.',
    'Run live operations with shared accountability.',
  ];

  return (
    <>
      <section id="packaging" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Packaging that fits your operation</h2>
        <p className="mt-3 text-slate-600">
          Start with Core OS, then layer sector and industry modules without breaking your operating rhythm.
        </p>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Four steps to live ops</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
              <span className="font-semibold text-slate-900">{index + 1}. </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
