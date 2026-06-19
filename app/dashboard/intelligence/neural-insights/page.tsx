'use client';

export default function NeuralInsights() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      {/* CLEAN MANUAL BREADCRUMB */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <a href="/dashboard/ai-lab" className="hover:text-neutral-700">AI Lab</a>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Neural Insights</span>
      </div>

      <h1 className="font-black text-6xl tracking-[-3px] text-[#00b4d8]">Neural Insights</h1>
      <p className="text-xl text-neutral-600 mt-3">Deep pattern recognition across your entire supply chain</p>

      <div className="mt-12 bg-white rounded-3xl p-12 border border-neutral-100 shadow-sm">
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-6xl mb-8">🧠</div>
          <h3 className="text-3xl font-bold mb-4">Real-time Anomaly Detection</h3>
          <p className="max-w-md mx-auto text-neutral-600">Neural networks scanning supplier risk, quality deviations, and market signals 24/7</p>
        </div>
      </div>
    </div>
  );
}