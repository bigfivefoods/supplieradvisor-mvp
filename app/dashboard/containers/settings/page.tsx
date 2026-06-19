'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ContainersSettings() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="mb-8">
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">Container Settings</h1>
        <p className="text-xl text-neutral-600">Configure defaults, commission structures, and container types</p>
      </div>

      <div className="max-w-3xl space-y-8">
        
        <div className="bg-white rounded-3xl p-8 border">
          <h3 className="font-bold text-xl mb-6">Default Commission Rate</h3>
          <div className="flex items-center gap-4">
            <input type="number" defaultValue="15" className="w-24 px-4 py-3 rounded-2xl border text-center text-xl font-semibold" />
            <span className="text-xl text-neutral-600">%</span>
          </div>
          <p className="text-sm text-neutral-500 mt-2">This will be the default commission rate when creating new contracts.</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border">
          <h3 className="font-bold text-xl mb-6">Container Types</h3>
          <div className="space-y-3">
            {["Standard (6m)", "Large (12m)", "Custom / Modified"].map((type, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-2xl">
                <span>{type}</span>
                <button className="text-sm text-red-600 hover:underline">Remove</button>
              </div>
            ))}
            <button className="text-sm text-[#00b4d8] font-medium mt-2">+ Add New Container Type</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border">
          <h3 className="font-bold text-xl mb-4">Other Settings</h3>
          <p className="text-neutral-500">Additional configuration options (auto code generation, notification rules, payout schedules, etc.) will be added here.</p>
        </div>
      </div>
    </div>
  );
}