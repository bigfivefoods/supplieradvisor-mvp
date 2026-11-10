import SecurityStrip from '@/components/marketing/SecurityStrip';

export default function TrustPageSections() {
  return (
    <>
      <section id="trust" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-black text-slate-900">Trust at every trade step</h2>
        <p className="mt-3 text-slate-600">
          SupplierAdvisor® records verification, accountability, and execution signals so your team can prove what happened and what comes next.
        </p>
      </section>
      <SecurityStrip />
    </>
  );
}
