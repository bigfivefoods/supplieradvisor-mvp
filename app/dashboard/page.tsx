'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Users,
  Truck,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
  Target,
  ShieldCheck,
  Network,
  FileText,
  RefreshCw,
  Building2,
} from 'lucide-react';

type CompanyData = {
  id: number;
  trading_name: string;
  legal_name: string | null;
  industry: string | null;
  verification_status?: string | null;
  country?: string | null;
  city?: string | null;
  trust_score?: number | null;
  short_description?: string | null;
};

type Kpis = {
  teamActive: number;
  teamInvited: number;
  teamTotal: number;
  networkAccepted: number;
  networkPending: number;
  networkTotal: number;
  suppliersTotal: number;
  suppliersActive: number;
  suppliersInvited: number;
  openRisks: number;
  highRisks: number;
  products: number;
  documents: number;
  projects: number;
  pendingInvites: number;
};

type Health = {
  supplierHealth: number;
  fulfillmentSignal: number;
  riskScoreLabel: string;
  riskBar: number;
};

type Activity = {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  type: string;
};

type AlertItem = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  href: string;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatRelative(iso: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function healthLabel(score: number) {
  if (score >= 85) return { text: 'Excellent', color: 'text-emerald-600' };
  if (score >= 65) return { text: 'Good', color: 'text-amber-600' };
  if (score >= 40) return { text: 'Fair', color: 'text-orange-600' };
  return { text: 'Needs attention', color: 'text-red-600' };
}

export default function DashboardHome() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const companyId =
      typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null;

    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/dashboard/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard');
        setCompany(null);
        return;
      }

      setCompany(data.company);
      setKpis(data.kpis);
      setHealth(data.health);
      setActivity(data.activity || []);
      setAlerts(data.alerts || []);
      setGeneratedAt(data.generatedAt || null);

      if (data.company?.trading_name) {
        try {
          localStorage.setItem('selectedCompanyName', data.company.trading_name);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error(e);
      setError('Network error loading live dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Loading live dashboard…</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4 text-slate-900">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">
          {error || 'Please select a company to view your live dashboard.'}
        </p>
        <Link href="/dashboard/select-company" className="btn-primary px-8 py-3 inline-block">
          Select Company
        </Link>
      </div>
    );
  }

  const supplierLabel = health ? healthLabel(health.supplierHealth) : null;
  const fulfillLabel = health ? healthLabel(health.fulfillmentSignal) : null;

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500 mb-1">{greeting()}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-[-2.5px] text-[#00b4d8]">
                {company.trading_name}
              </h1>
              {company.verification_status === 'verified' ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <Link
                  href="/dashboard/my-business/profile"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
                >
                  Get verified
                </Link>
              )}
            </div>
            <p className="text-base sm:text-lg md:text-xl text-neutral-600 mt-2">
              {[company.industry, company.city, company.country].filter(Boolean).join(' · ') ||
                'Your business command center'}
            </p>
            {generatedAt && (
              <p className="text-xs text-neutral-400 mt-2">
                Live from Supabase · updated {formatRelative(generatedAt) || 'just now'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-3 rounded-2xl border border-neutral-200 bg-white font-medium hover:border-neutral-300 transition-colors inline-flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link
              href="/dashboard/select-company"
              className="px-4 sm:px-5 py-3 rounded-2xl border border-neutral-200 bg-white font-medium hover:border-neutral-300 transition-colors text-sm"
            >
              Switch company
            </Link>
            <Link
              href="/dashboard/my-business"
              className="px-4 sm:px-5 py-3 rounded-2xl border border-neutral-200 bg-white font-medium hover:border-neutral-300 transition-colors flex items-center gap-2 text-sm"
            >
              Manage Business <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/suppliers/add"
              className="btn-primary px-5 sm:px-6 py-3 flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards — live */}
      <p className="text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wide">
        Live workspace metrics
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            {kpis && kpis.teamInvited > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
                {kpis.teamInvited} pending
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-1 text-slate-900">
            {kpis?.teamActive ?? 0}
          </div>
          <div className="text-sm text-neutral-600">Active team members</div>
          <div className="text-xs text-neutral-400 mt-3">{kpis?.teamTotal ?? 0} total on roster</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
            {kpis && kpis.suppliersInvited > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
                {kpis.suppliersInvited} invited
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-1 text-slate-900">
            {kpis?.suppliersActive ?? 0}
          </div>
          <div className="text-sm text-neutral-600">Active suppliers</div>
          <div className="text-xs text-neutral-400 mt-3">{kpis?.suppliersTotal ?? 0} in directory</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-100 rounded-2xl">
              <Network className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-700" />
            </div>
            {kpis && kpis.networkPending > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
                {kpis.networkPending} pending
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-1 text-slate-900">
            {kpis?.networkAccepted ?? 0}
          </div>
          <div className="text-sm text-neutral-600">Network connections</div>
          <div className="text-xs text-neutral-400 mt-3">{kpis?.networkTotal ?? 0} total requests</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            {kpis && kpis.highRisks > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                {kpis.highRisks} high
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-1 text-slate-900">
            {kpis?.openRisks ?? 0}
          </div>
          <div className="text-sm text-neutral-600">Open RIAD items</div>
          <div className="text-xs text-neutral-400 mt-3">
            {kpis?.products ?? 0} products · {kpis?.documents ?? 0} docs
          </div>
        </div>
      </div>

      {/* Quick Actions + Business Pulse */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
        <div className="lg:col-span-1 bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
          <h3 className="font-bold text-lg sm:text-xl mb-5 tracking-tight text-slate-900">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Add New Supplier', href: '/dashboard/suppliers/add', icon: Truck },
              { label: 'Create Purchase Order', href: '/dashboard/suppliers/po', icon: Package },
              { label: 'View Team', href: '/dashboard/my-business/team', icon: Users },
              { label: 'Network', href: '/dashboard/network', icon: Network },
              { label: 'Documents', href: '/dashboard/my-business/documents', icon: FileText },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-100 rounded-2xl group-hover:bg-white transition-colors">
                      <Icon className="w-5 h-5 text-neutral-700" />
                    </div>
                    <span className="font-medium text-sm sm:text-base text-slate-800">{action.label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg sm:text-xl tracking-tight text-slate-900">Business Pulse</h3>
            <Link
              href="/dashboard/intelligence"
              className="text-sm text-[#00b4d8] hover:underline flex items-center gap-1"
            >
              Intelligence <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-neutral-500 mb-2">Supplier health</div>
              <div className="text-3xl font-black tracking-tighter mb-1 text-slate-900">
                {health?.supplierHealth ?? 0}
              </div>
              <div className={`text-sm font-medium ${supplierLabel?.color || ''}`}>
                {supplierLabel?.text || '—'}
              </div>
              <div className="h-2 bg-neutral-100 rounded-full mt-3">
                <div
                  className="h-2 bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, health?.supplierHealth ?? 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-500 mb-2">Catalogue readiness</div>
              <div className="text-3xl font-black tracking-tighter mb-1 text-slate-900">
                {health?.fulfillmentSignal ?? 0}
              </div>
              <div className={`text-sm font-medium ${fulfillLabel?.color || ''}`}>
                {fulfillLabel?.text || '—'}
              </div>
              <div className="h-2 bg-neutral-100 rounded-full mt-3">
                <div
                  className="h-2 bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, health?.fulfillmentSignal ?? 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-500 mb-2">Risk posture</div>
              <div className="text-3xl font-black tracking-tighter mb-1 text-slate-900">
                {health?.riskScoreLabel ?? '—'}
              </div>
              <div className="text-sm font-medium text-neutral-600">
                {kpis?.openRisks ?? 0} open items
              </div>
              <div className="h-2 bg-neutral-100 rounded-full mt-3">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (health?.riskBar || 0) > 60 ? 'bg-red-500' : (health?.riskBar || 0) > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, health?.riskBar ?? 0)}%` }}
                />
              </div>
            </div>
          </div>

          {typeof company.trust_score === 'number' && (
            <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center gap-3 text-sm text-neutral-600">
              <Target className="w-4 h-4 text-[#00b4d8]" />
              Trust score on profile: <strong className="text-slate-900">{company.trust_score}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Activity + Alerts */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg sm:text-xl tracking-tight text-slate-900">Recent activity</h3>
            <Link href="/dashboard/my-business" className="text-sm text-[#00b4d8]">
              Workspace
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-sm">
              No recent activity yet. Invite a teammate or add a supplier to get started.
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {activity.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b border-neutral-100 last:border-none last:pb-0">
                  <div
                    className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center ${
                      item.type === 'risk'
                        ? 'bg-amber-100'
                        : item.type === 'team'
                          ? 'bg-blue-100'
                          : item.type === 'network'
                            ? 'bg-cyan-100'
                            : 'bg-neutral-100'
                    }`}
                  >
                    {item.type === 'risk' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : item.type === 'team' ? (
                      <Users className="w-4 h-4 text-blue-600" />
                    ) : item.type === 'network' ? (
                      <Network className="w-4 h-4 text-cyan-700" />
                    ) : item.type === 'supplier' ? (
                      <Truck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-neutral-500 text-xs mt-0.5">
                      {item.subtitle}
                      {item.at ? ` · ${formatRelative(item.at)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg sm:text-xl tracking-tight flex items-center gap-2 text-slate-900">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Alerts &amp; attention
            </h3>
            <Link href="/dashboard/suppliers" className="text-sm text-[#00b4d8]">
              Suppliers
            </Link>
          </div>

          {alerts.length === 0 ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
              All clear — no critical alerts for this workspace right now.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className={`flex gap-4 p-4 rounded-2xl border transition-colors hover:opacity-95 ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-100'
                      : alert.severity === 'warning'
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-blue-50 border-blue-100'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      alert.severity === 'critical'
                        ? 'text-red-600'
                        : alert.severity === 'warning'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                    }`}
                  />
                  <div>
                    <div className="font-medium text-sm text-slate-900">{alert.title}</div>
                    <div
                      className={`text-xs mt-1 ${
                        alert.severity === 'critical'
                          ? 'text-red-700'
                          : alert.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                      }`}
                    >
                      {alert.detail}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
