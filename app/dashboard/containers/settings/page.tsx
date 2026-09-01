'use client';

import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function ContainersSettings() {
  return (
    <CompanyRequired>
      <ContainersPage>
        <ContainersHeader
          title="Container"
          titleAccent="settings"
          description="Defaults, commission structures, and container types for the network."
        />

        <div className="max-w-3xl space-y-4">
          <Panel title="Default commission rate">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  defaultValue={15}
                  className="input !w-24 !p-3 !text-center !text-lg font-semibold"
                />
                <span className="text-neutral-600 font-medium">%</span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Default commission when creating new contractor contracts.
              </p>
            </div>
          </Panel>

          <Panel title="Container types">
            <div className="p-5 space-y-2">
              {['Standard (6m)', 'Large (12m)', 'Custom / Modified'].map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-100"
                >
                  <span className="text-sm font-medium text-slate-800">{type}</span>
                  <button type="button" className="text-xs text-red-600 hover:underline cursor-pointer">
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-[#00b4d8] mt-2 cursor-pointer"
              >
                + Add container type
              </button>
            </div>
          </Panel>

          <Panel title="Other settings">
            <div className="p-5 text-sm text-neutral-500 leading-relaxed">
              Auto code generation, notification rules, and payout schedules will land here next —
              same light product language as My Business settings.
            </div>
          </Panel>
        </div>
      </ContainersPage>
    </CompanyRequired>
  );
}
