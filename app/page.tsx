'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function Home() {
  // ✅ Proper typing to fix all TS errors
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    financial: true,
    customer: true,
    supplier: true,
    inventory: true,
    operations: true,
  });

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const sections = [
    {
      key: 'financial',
      title: 'Financial',
      icon: '💰',
      color: '#00b4d8',
      metrics: [
        { label: 'Total Revenue', value: 'R 1.2M', icon: '📈' },
        { label: 'Gross Profit', value: 'R 428k', icon: '📊' },
        { label: 'Cash on Hand', value: 'R 892k', icon: '💵' },
        { label: 'Operating Expenses', value: 'R 312k', icon: '📉' },
      ]
    },
    {
      key: 'customer',
      title: 'Customer Relationship Metrics',
      icon: '🤝',
      color: '#00b4d8',
      metrics: [
        { label: 'Active Customers', value: '184', icon: '👥' },
        { label: 'Avg Order Value', value: 'R 6,840', icon: '🛒' },
        { label: 'Retention Rate', value: '94%', icon: '🔄' },
        { label: 'NPS Score', value: '82', icon: '⭐' },
      ]
    },
    {
      key: 'supplier',
      title: 'Supplier Relationship Metrics',
      icon: '🔗',
      color: '#00b4d8',
      metrics: [
        { label: 'Active Suppliers', value: '42', icon: '🏭' },
        { label: 'OTIFEF Rate', value: '96.8%', icon: '📦' },
        { label: 'Avg Supplier Rating', value: '4.7', icon: '⭐' },
        { label: 'On-time Delivery', value: '98%', icon: '🚚' },
      ]
    },
    {
      key: 'inventory',
      title: 'Inventory Metrics',
      icon: '📦',
      color: '#00b4d8',
      metrics: [
        { label: 'Total Inventory Value', value: 'R 1.8M', icon: '📊' },
        { label: 'Stock Turnover', value: '8.4x', icon: '🔄' },
        { label: 'Low Stock Items', value: '7', icon: '⚠️' },
        { label: 'Warehouse Utilization', value: '82%', icon: '🏬' },
      ]
    },
  ];

  return (
    <div className="pl-[25px]">
      <h1 className="text-7xl font-black tracking-tighter mb-12 text-[#00b4d8]">
        Operations Overview
      </h1>

      <div className="space-y-12">
        {sections.map(section => (
          <div key={section.key}>
            {/* Expandable Heading */}
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between py-6 text-left hover:bg-transparent transition-none"
            >
              <div className="flex items-center gap-5">
                <span className="text-5xl" style={{ color: section.color }}>{section.icon}</span>
                <h2 className="text-5xl font-black tracking-tighter" style={{ color: section.color }}>
                  {section.title}
                </h2>
              </div>
              <span className={`text-4xl transition-transform ${expanded[section.key] ? 'rotate-180' : ''}`} style={{ color: section.color }}>
                ▼
              </span>
            </button>

            {/* Expandable Content */}
            {expanded[section.key] && (
              <div className="pl-14">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {section.metrics.map((stat, i) => (
                    <div key={i} className="card text-center">
                      <div className="flex justify-center text-6xl mb-6 opacity-80">
                        {stat.icon}
                      </div>
                      <div className="text-5xl font-black text-slate-900 mb-3">
                        {stat.value}
                      </div>
                      <div className="text-xl text-slate-600 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}