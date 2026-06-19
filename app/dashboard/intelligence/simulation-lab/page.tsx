'use client';

export default function SimulationLab() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <a href="/dashboard/ai-lab" className="hover:text-neutral-700">AI Lab</a>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Simulation Lab</span>
      </div>

      <h1 className="font-black text-6xl tracking-[-3px] text-[#00b4d8]">Simulation Lab</h1>
      <p className="text-xl text-neutral-600 mt-3">What-if scenarios in real time</p>

      <div className="mt-12 bg-white rounded-3xl p-12 border border-neutral-100 shadow-sm text-center">
        <div className="text-7xl mb-8">🔬</div>
        <h3 className="text-3xl font-bold">Run 1,000 scenarios in seconds</h3>
        <p className="mt-4 max-w-md mx-auto text-neutral-600">Test port strikes, supplier failure, demand spikes — before they happen</p>
      </div>
    </div>
  );
}