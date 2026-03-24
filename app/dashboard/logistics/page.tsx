'use client'

import Link from 'next/link'

export default function LogisticsHub() {
  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>

      {/* BREADCRUMB */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to Dashboard
        </Link>
        <div style={{ color: '#666' }}>/</div>
        <span style={{ color: '#aaa', fontSize: '18px' }}>Logistics</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '50px' }}>
        Logistics Management
      </h3>

      {/* ==================== 1. LOGISTICS KPIs ==================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Logistics KPIs</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px', marginBottom: '70px' }}>
        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '32px', borderRadius: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#aaa' }}>Active Shipments</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', margin: '12px 0' }}>28</div>
          <div style={{ color: '#10b981' }}>12 Inbound • 16 Outbound</div>
        </div>

        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '32px', borderRadius: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#aaa' }}>Fleet Vehicles</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', margin: '12px 0' }}>14</div>
          <div style={{ color: '#10b981' }}>9 On Road • 5 Available</div>
        </div>

        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '32px', borderRadius: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#aaa' }}>On-Time Delivery</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', margin: '12px 0' }}>94.7%</div>
          <div style={{ color: '#10b981' }}>This month</div>
        </div>

        <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '32px', borderRadius: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#aaa' }}>External Providers</div>
          <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff', margin: '12px 0' }}>7</div>
          <div style={{ color: '#10b981' }}>Active contracts</div>
        </div>
      </div>

      {/* ==================== 2. LOGISTICS LEADERSHIP ==================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Logistics Leadership</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '70px' }}>

        <Link href="/dashboard/logistics/inbound" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📥</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Inbound Shipments</div>
          </div>
        </Link>

        <Link href="/dashboard/logistics/tracking" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📍</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Live Tracking</div>
          </div>
        </Link>

        <Link href="/dashboard/logistics/outbound" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📤</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Outbound Shipments</div>
          </div>
        </Link>
      </div>

      {/* ==================== 3. LOGISTICS MAINTENANCE ==================== */}
      <h4 style={{ fontSize: '24px', color: '#fff', marginBottom: '24px' }}>Logistics Maintenance</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

        <Link href="/dashboard/logistics/drivers" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>👷</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Drivers</div>
          </div>
        </Link>

        <Link href="/dashboard/logistics/vehicles" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚛</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Fleet & Vehicles</div>
          </div>
        </Link>

        <Link href="/dashboard/logistics/providers" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '48px', borderRadius: '28px', textAlign: 'center', transition: 'all 0.2s', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🤝</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>External Providers<br />(suppliers on supplieradvisor)</div>
          </div>
        </Link>
      </div>
    </div>
  )
}