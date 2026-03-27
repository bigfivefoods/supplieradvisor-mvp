'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    financial: true,
    customer: true,
    supplier: true,
    inventory: true,
    logistics: true,
    ai: true,
  });

  // Widget system – users can add KPI cards from other modules
  const [widgets, setWidgets] = useState([
    { id: 1, title: 'Total Revenue', value: 'R 1.2M', icon: '📈', color: '#00b4d8' },
    { id: 2, title: 'OTIFEF Rate', value: '96.8%', icon: '📦', color: '#00b4d8' },
    { id: 3, title: 'Active Suppliers', value: '42', icon: '🏭', color: '#00b4d8' },
  ]);

  const availableKPIs = [
    { title: 'Active Customers', value: '184', icon: '👥' },
    { title: 'Inventory Value', value: 'R 1.8M', icon: '📦' },
    { title: 'Cash on Hand', value: 'R 892k', icon: '💵' },
    { title: 'NPS Score', value: '82', icon: '⭐' },
    { title: 'Live Shipments', value: '12', icon: '🚚' },
    { title: 'AI Risk Alerts', value: '3', icon: '⚠️' },
  ];

  const [showWidgetModal, setShowWidgetModal] = useState(false);

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addWidget = (kpi: any) => {
    const newWidget = {
      id: Date.now(),
      title: kpi.title,
      value: kpi.value,
      icon: kpi.icon,
      color: '#00b4d8',
    };
    setWidgets(prev => [...prev, newWidget]);
    setShowWidgetModal(false);
  };

  const removeWidget = (id: number) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const sections = [
    { key: 'financial', title: 'Financial Overview', icon: '💰', metrics: [
      { label: 'Total Revenue', value: 'R 1.2M' },
      { label: 'Gross Profit', value: 'R 428k' },
      { label: 'Cash on Hand', value: 'R 892k' },
    ]},
    { key: 'customer', title: 'Customer Relationship', icon: '🤝', metrics: [
      { label: 'Active Customers', value: '184' },
      { label: 'Avg Order Value', value: 'R 6,840' },
      { label: 'Retention Rate', value: '94%' },
    ]},
    { key: 'supplier', title: 'Supplier Relationship', icon: '🔗', metrics: [
      { label: 'Active Suppliers', value: '42' },
      { label: 'OTIFEF Rate', value: '96.8%' },
      { label: 'Avg Rating', value: '4.7' },
    ]},
    { key: 'inventory', title: 'Inventory Health', icon: '📦', metrics: [
      { label: 'Total Value', value: 'R 1.8M' },
      { label: 'Stock Turnover', value: '8.4x' },
      { label: 'Low Stock Items', value: '7' },
    ]},
    { key: 'logistics', title: 'Logistics & Tracking', icon: '🚚', metrics: [
      { label: 'Shipments in Transit', value: '12' },
      { label: 'On-Time Delivery', value: '98%' },
    ]},
    { key: 'ai', title: 'AI Insights', icon: '🧠', metrics: [
      { label: 'Risk Alerts', value: '3' },
      { label: 'Predicted Savings', value: 'R 184k' },
    ]},
  ];

  return (
    <div className="pl-[25px] pr-12 py-12 bg-[#f8fafc] min-h-screen">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Supply Chain Pulse</h1>
          <p className="text-xl text-slate-600 mt-2">Real-time overview • Updated just now</p>
        </div>

        {/* Top Key KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Revenue', value: 'R 1.2M', change: '+12%' },
            { label: 'OTIFEF', value: '96.8%', change: '+2.1%' },
            { label: 'Active Suppliers', value: '42', change: '+3' },
            { label: 'Inventory Value', value: 'R 1.8M', change: '-4%' },
          ].map((kpi, i) => (
            <div key={i} className="card p-8 text-center">
              <div className="text-4xl font-black text-slate-900 mb-2">{kpi.value}</div>
              <div className="text-slate-600 font-medium">{kpi.label}</div>
              <div className="text-xs text-emerald-600 mt-3">{kpi.change} this month</div>
            </div>
          ))}
        </div>

        {/* Expandable Sections */}
        <div className="space-y-12">
          {sections.map(section => (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between py-6 text-left hover:bg-transparent"
              >
                <div className="flex items-center gap-5">
                  <span className="text-5xl" style={{ color: '#00b4d8' }}>{section.icon}</span>
                  <h2 className="text-5xl font-black tracking-tighter text-[#00b4d8]">{section.title}</h2>
                </div>
                <span className={`text-4xl transition-transform ${expanded[section.key] ? 'rotate-180' : ''}`} style={{ color: '#00b4d8' }}>
                  ▼
                </span>
              </button>

              {expanded[section.key] && (
                <div className="pl-14">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {section.metrics.map((stat, i) => (
                      <div key={i} className="card text-center p-8">
                        <div className="text-5xl font-black text-slate-900 mb-3">{stat.value}</div>
                        <div className="text-xl text-slate-600 font-medium">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Widget Area */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-4xl font-black tracking-tighter text-[#00b4d8]">My Widgets</h2>
            <button
              onClick={() => setShowWidgetModal(true)}
              className="flex items-center gap-3 px-8 py-4 bg-[#00b4d8] hover:bg-[#0099b8] text-white rounded-3xl font-medium transition-all"
            >
              <Plus size={20} /> Add Widget
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map(widget => (
              <div key={widget.id} className="card p-8 relative group">
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-red-500"
                >
                  <X size={20} />
                </button>
                <div className="text-6xl mb-6" style={{ color: widget.color }}>{widget.icon}</div>
                <div className="text-5xl font-black text-slate-900 mb-3">{widget.value}</div>
                <div className="text-xl text-slate-600 font-medium">{widget.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Widget Modal */}
      {showWidgetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-4xl font-black tracking-tighter">Add Widget</h3>
              <button onClick={() => setShowWidgetModal(false)} className="text-4xl">×</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {availableKPIs.map((kpi, i) => (
                <button
                  key={i}
                  onClick={() => addWidget(kpi)}
                  className="card p-8 text-left hover:border-[#00b4d8] hover:shadow-xl transition-all group"
                >
                  <div className="text-6xl mb-6 opacity-80 group-hover:scale-110 transition-transform">{kpi.icon}</div>
                  <div className="text-4xl font-black text-slate-900 mb-2">{kpi.value}</div>
                  <div className="text-xl font-medium text-slate-600">{kpi.title}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowWidgetModal(false)}
              className="mt-10 w-full py-5 text-slate-500 hover:text-slate-900 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
