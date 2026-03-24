'use client'

import Link from 'next/link'

export default function SRM_Connect() {
  return (
    <div>
      {/* BACK NAVIGATION + BREADCRUMBS */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/srm" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to SRM
        </Link>
        <div style={{ color: '#666' }}>/</div>
        <span style={{ color: '#aaa', fontSize: '18px' }}>My Connections</span>
      </div>

      <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#10b981', marginBottom: '40px' }}>
        My Connections
      </h1>
      <p style={{ color: '#888', fontSize: '20px' }}>Connected suppliers + Awaiting Connection requests</p>

      {/* Add your connected / awaiting list here later - for now placeholder */}
      <div style={{ background: '#111', padding: '40px', borderRadius: '28px', textAlign: 'center', marginTop: '40px' }}>
        Connected suppliers and pending requests will appear here
      </div>
    </div>
  )
}