'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function OTIFEF() {
  const [expanded, setExpanded] = useState({
    metricFilters: true,
    companyFilter: true,
    periodFilter: true,
    companyName: true,     // ← New expandable for Company Name
    businessType: true,
    region: true,
    industry: true,
    verification: true,
    year: true,
    month: true,
    metrics: true,
  })

  // Company Filter
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedVerification, setSelectedVerification] = useState<string[]>([])

  // Period Filter
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedYears, setSelectedYears] = useState<string[]>(['2026'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCheckbox = (array: string[], setter: any, value: string) => {
    if (array.includes(value)) {
      setter(array.filter(item => item !== value))
    } else {
      setter([...array, value])
    }
  }

  const periodText = `${fromDate || 'Jan 2026'} – ${toDate || 'Dec 2026'} • ${selectedYears.join(', ') || '2026'} • ${selectedMonths.length ? selectedMonths.join(', ') : 'All Months'}`

  // Mock connected companies on SupplierAdvisor
  const connectedCompanies = [
    'BigFive Foods',
    'KZN Fresh Produce',
    'Cape Agri Supply',
    'Durban Spice Co',
    'East Coast Packers',
    'Natal Farms Ltd',
    'Pietermaritzburg Fresh',
    'Western Cape Packers'
  ]

  return (
    <div className="pl-[25px]">   {/* Exactly 25px from sidebar */}

      {/* Breadcrumb */}
      <div className="flex items-center gap-4 breadcrumb mb-12">
        <Link href="/dashboard/srm" className="hover:text-slate-900">← SRM</Link>
        <span>/</span>
        <span className="text-[#00b4d8] font-medium">OTIFEF Metrics</span>
      </div>

      <h1 className="text-5xl font-black tracking-tighter mb-12">
        OTIFEF Metrics
      </h1>

      {/* METRIC FILTERS – Two cards side-by-side */}
      <div className="mb-16">
        <button
          onClick={() => toggle('metricFilters')}
          className="w-full flex items-center gap-4 text-left mb-6"
        >
          <h2 className="text-4xl font-black tracking-tighter" style={{ color: '#00b4d8' }}>
            Metric Filters
          </h2>
          <span className={`text-4xl transition-transform ${expanded.metricFilters ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
            ▼
          </span>
        </button>

        {expanded.metricFilters && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* COMPANY FILTER CARD */}
            <div className="card p-10">
              <button
                onClick={() => toggle('companyFilter')}
                className="w-full flex items-center justify-between text-left mb-8"
              >
                <h3 className="text-2xl font-semibold text-slate-900">Company Filter</h3>
                <span className={`text-3xl transition-transform ${expanded.companyFilter ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
                  ▼
                </span>
              </button>

              {expanded.companyFilter && (
                <div className="space-y-10">

                  {/* Company Name – Expandable with multi-select tickboxes */}
                  <div>
                    <button
                      onClick={() => toggle('companyName')}
                      className="w-full flex justify-between text-left mb-4 font-medium text-slate-800"
                    >
                      Company Name (select one, more, or all)
                      <span className={`transition-transform ${expanded.companyName ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.companyName && (
                      <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-4 bg-slate-50">
                        {connectedCompanies.map(company => (
                          <label key={company} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(company)}
                              onChange={() => toggleCheckbox(selectedCompanies, setSelectedCompanies, company)}
                              className="w-5 h-5 accent-[#00b4d8]"
                            />
                            {company}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Business Type – Expandable tickboxes */}
                  <div>
                    <button onClick={() => toggle('businessType')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Business Type
                      <span className={`transition-transform ${expanded.businessType ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.businessType && (
                      <div className="grid grid-cols-2 gap-3 pl-4">
                        {['Foods', 'Agriculture', 'Manufacturing', 'Retail', 'Logistics'].map(type => (
                          <label key={type} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={selectedBusinessTypes.includes(type)} onChange={() => toggleCheckbox(selectedBusinessTypes, setSelectedBusinessTypes, type)} className="w-5 h-5 accent-[#00b4d8]" />
                            {type}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Region – Expandable tickboxes */}
                  <div>
                    <button onClick={() => toggle('region')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Region
                      <span className={`transition-transform ${expanded.region ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.region && (
                      <div className="grid grid-cols-2 gap-3 pl-4">
                        {['KwaZulu-Natal', 'Gauteng', 'Western Cape', 'Eastern Cape', 'Limpopo'].map(region => (
                          <label key={region} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={selectedRegions.includes(region)} onChange={() => toggleCheckbox(selectedRegions, setSelectedRegions, region)} className="w-5 h-5 accent-[#00b4d8]" />
                            {region}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Industry – Expandable tickboxes */}
                  <div>
                    <button onClick={() => toggle('industry')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Industry
                      <span className={`transition-transform ${expanded.industry ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.industry && (
                      <div className="space-y-3 pl-4">
                        {['Food Production', 'Fresh Produce', 'Processed Goods', 'Packaging'].map(ind => (
                          <label key={ind} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={selectedIndustries.includes(ind)} onChange={() => toggleCheckbox(selectedIndustries, setSelectedIndustries, ind)} className="w-5 h-5 accent-[#00b4d8]" />
                            {ind}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verification Method – Expandable tickboxes */}
                  <div>
                    <button onClick={() => toggle('verification')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Verification Method
                      <span className={`transition-transform ${expanded.verification ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.verification && (
                      <div className="space-y-3 pl-4">
                        {['Third-Party Verified', 'Self-Verified'].map(v => (
                          <label key={v} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={selectedVerification.includes(v)} onChange={() => toggleCheckbox(selectedVerification, setSelectedVerification, v)} className="w-5 h-5 accent-[#00b4d8]" />
                            {v}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PERIOD FILTER CARD – unchanged */}
            <div className="card p-10">
              <button
                onClick={() => toggle('periodFilter')}
                className="w-full flex items-center justify-between text-left mb-8"
              >
                <h3 className="text-2xl font-semibold text-slate-900">Period Filter</h3>
                <span className={`text-3xl transition-transform ${expanded.periodFilter ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
                  ▼
                </span>
              </button>

              {expanded.periodFilter && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">From Date</label>
                      <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#00b4d8]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">To Date</label>
                      <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-[#00b4d8]" />
                    </div>
                  </div>

                  <div>
                    <button onClick={() => toggle('year')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Year
                      <span className={`transition-transform ${expanded.year ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.year && (
                      <div className="flex gap-6 pl-2">
                        {['2025', '2026', '2027'].map(y => (
                          <label key={y} className="flex items-center gap-3 cursor-pointer text-slate-700">
                            <input type="checkbox" checked={selectedYears.includes(y)} onChange={() => toggleCheckbox(selectedYears, setSelectedYears, y)} className="w-5 h-5 accent-[#00b4d8]" />
                            {y}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <button onClick={() => toggle('month')} className="w-full flex justify-between text-left mb-3 font-medium">
                      Month
                      <span className={`transition-transform ${expanded.month ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {expanded.month && (
                      <div className="grid grid-cols-4 gap-3 pl-2 text-sm">
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedMonths.includes(m)} onChange={() => toggleCheckbox(selectedMonths, setSelectedMonths, m)} className="w-5 h-5 accent-[#00b4d8]" />
                            {m}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* OTIFEF METRICS KPI CARDS */}
      <div>
        <button onClick={() => toggle('metrics')} className="w-full flex items-center gap-4 text-left mb-6">
          <h2 className="text-4xl font-black tracking-tighter" style={{ color: '#00b4d8' }}>
            OTIFEF Metrics
          </h2>
          <span className={`text-4xl transition-transform ${expanded.metrics ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
            ▼
          </span>
        </button>

        {expanded.metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card text-center hover:shadow-md transition-shadow h-full border-2 border-[#00b4d8]">
              <div className="flex justify-center text-6xl mb-6">📈</div>
              <div className="text-5xl font-black text-[#00b4d8] mb-2">97.7%</div>
              <div className="text-xl font-semibold">OTIFEF Average</div>
              <div className="text-slate-500 text-sm mt-6">Period: {periodText}</div>
            </div>

            <div className="card text-center hover:shadow-md transition-shadow h-full">
              <div className="flex justify-center text-6xl mb-6">⏰</div>
              <div className="text-5xl font-black text-slate-900 mb-2">98.4%</div>
              <div className="text-xl font-semibold">On-Time Delivery</div>
              <div className="text-slate-500 text-sm mt-6">Period: {periodText}</div>
            </div>

            <div className="card text-center hover:shadow-md transition-shadow h-full">
              <div className="flex justify-center text-6xl mb-6">📦</div>
              <div className="text-5xl font-black text-slate-900 mb-2">96.7%</div>
              <div className="text-xl font-semibold">In-Full Delivery</div>
              <div className="text-slate-500 text-sm mt-6">Period: {periodText}</div>
            </div>

            <div className="card text-center hover:shadow-md transition-shadow h-full">
              <div className="flex justify-center text-6xl mb-6">✅</div>
              <div className="text-5xl font-black text-slate-900 mb-2">97.9%</div>
              <div className="text-xl font-semibold">Error-Free Delivery</div>
              <div className="text-slate-500 text-sm mt-6">Period: {periodText}</div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}