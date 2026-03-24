'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SRM() {
  const [expanded, setExpanded] = useState({
    metrics: true,
    operations: false,
  })

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="pl-[25px]">   {/* Exactly 25px from sidebar */}

      {/* Breadcrumb */}
      <div className="flex items-center gap-4 breadcrumb mb-12">
        <Link href="/dashboard" className="hover:text-slate-900">← Dashboard</Link>
        <span>/</span>
        <span className="text-[#00b4d8] font-medium">SRM</span>
      </div>

      <h1 className="text-5xl font-black tracking-tighter mb-12">
        Supplier Relationship Management
      </h1>

      {/* 1. SRM Metrics – ONLY OTIFEF card */}
      <div className="mb-16">
        <button
          onClick={() => toggleSection('metrics')}
          className="w-full flex items-center gap-4 text-left hover:bg-transparent transition-none mb-6"
        >
          <h2 className="text-4xl font-black tracking-tighter" style={{ color: '#00b4d8' }}>
            SRM Metrics
          </h2>
          <span className={`text-4xl transition-transform ${expanded.metrics ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
            ▼
          </span>
        </button>

        {expanded.metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Link href="/dashboard/srm/otifef" className="block">
              <div className="card text-center hover:shadow-md transition-shadow h-full">
                <div className="flex justify-center text-6xl mb-6">📊</div>
                <div className="text-2xl font-semibold mb-2">OTIFEF Metrics</div>
                <div className="text-slate-600">Track On-Time, In-Full & Error-Free performance</div>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* 2. SRM Operations */}
      <div>
        <button
          onClick={() => toggleSection('operations')}
          className="w-full flex items-center gap-4 text-left hover:bg-transparent transition-none mb-6"
        >
          <h2 className="text-4xl font-black tracking-tighter" style={{ color: '#00b4d8' }}>
            SRM Operations
          </h2>
          <span className={`text-4xl transition-transform ${expanded.operations ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
            ▼
          </span>
        </button>

        {expanded.operations && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Link href="/dashboard/srm/search" className="block">
              <div className="card text-center hover:shadow-md transition-shadow h-full">
                <div className="flex justify-center text-6xl mb-6">🔍</div>
                <div className="text-2xl font-semibold mb-2">Search Suppliers</div>
                <div className="text-slate-600">Find verified suppliers by location, industry, certifications and more</div>
              </div>
            </Link>

            <Link href="/dashboard/srm/connect" className="block">
              <div className="card text-center hover:shadow-md transition-shadow h-full">
                <div className="flex justify-center text-6xl mb-6">🤝</div>
                <div className="text-2xl font-semibold mb-2">My Connections</div>
                <div className="text-slate-600">Manage approved suppliers and pending connection requests</div>
              </div>
            </Link>

            <Link href="/dashboard/srm/po" className="block">
              <div className="card text-center hover:shadow-md transition-shadow h-full">
                <div className="flex justify-center text-6xl mb-6">📦</div>
                <div className="text-2xl font-semibold mb-2">Raise PO</div>
                <div className="text-slate-600">Create and send purchase orders to connected suppliers</div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}