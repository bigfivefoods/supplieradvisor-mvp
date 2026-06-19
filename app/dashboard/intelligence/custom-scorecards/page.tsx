'use client';

export default function CustomScorecards() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <a href="/dashboard/ai-lab" className="hover:text-neutral-700">AI Lab</a>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Custom Scorecards</span>
      </div>

      <h1 className="font-black text-6xl tracking-[-3px] text-[#00b4d8]">Custom Scorecards</h1>
      <p className="text-xl text-neutral-600 mt-3">Build your own on-chain KPIs</p>

      <div className="mt-12 bg-white rounded-3xl p-12 border border-neutral-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Supplier Trust Score', 'Sustainability Index', 'On-Chain Compliance'].map((title, i) => (
            <div key={i} className="bg-neutral-50 rounded-3xl p-8 text-center">
              <div className="text-4xl font-black text-[#00b4d8] mb-3">94</div>
              <p className="font-medium">{title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}