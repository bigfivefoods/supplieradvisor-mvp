'use client';

export default function PulseDashboard() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <a href="/dashboard/ai-lab" className="hover:text-neutral-700">AI Lab</a>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Supply Chain Pulse</span>
      </div>

      <h1 className="font-black text-6xl tracking-[-3px] text-[#00b4d8]">Supply Chain Pulse</h1>
      <p className="text-xl text-neutral-600 mt-3">Live heartbeat of your entire operation</p>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-10 border border-neutral-100 shadow-sm">
          <div className="text-5xl font-black text-emerald-500">98.7%</div>
          <p className="text-neutral-600 mt-2">OTIFEF Score • Live</p>
        </div>
        <div className="bg-white rounded-3xl p-10 border border-neutral-100 shadow-sm">
          <div className="text-5xl font-black text-amber-500">12</div>
          <p className="text-neutral-600 mt-2">Active Risk Signals</p>
        </div>
      </div>
    </div>
  );
}