'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LiveTracking() {
  const [search, setSearch] = useState('')

  const vehicles = [
    { id: 'V-001', reg: 'ND 123 456', driver: 'John Mthembu', status: 'In Transit', location: 'N3 Highway - 45km from Durban', eta: '14:20', load: 'Outbound - Shoprite' },
    { id: 'V-002', reg: 'ND 789 012', driver: 'Sizwe Nkosi', status: 'Loading', location: 'Durban Main Warehouse', eta: '—', load: 'Inbound - KZN Fresh' },
    { id: 'V-003', reg: 'ND 456 789', driver: 'Thandiwe Mthembu', status: 'Delivered', location: 'Pietermaritzburg', eta: 'Completed', load: 'Outbound - Pick n Pay' },
  ]

  const filtered = vehicles.filter(v => 
    v.reg.toLowerCase().includes(search.toLowerCase()) || 
    v.driver.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/logistics" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Logistics</Link>
        <span style={{ color: '#aaa' }}>/ Live Tracking</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '30px' }}>Live Fleet Tracking</h3>

      <input type="text" placeholder="Search vehicle or driver..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', marginBottom: '30px' }} />

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Vehicle</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Driver</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Current Location</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>ETA</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Load</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '20px', color: '#fff', fontWeight: 'bold' }}>{v.reg}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{v.driver}</td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <span style={{ padding: '6px 20px', borderRadius: '999px', background: v.status === 'In Transit' ? '#10b98133' : v.status === 'Loading' ? '#f59e0b33' : '#666', color: v.status === 'In Transit' ? '#10b981' : v.status === 'Loading' ? '#f59e0b' : '#aaa' }}>
                    {v.status}
                  </span>
                </td>
                <td style={{ padding: '20px', color: '#ccc' }}>{v.location}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>{v.eta}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{v.load}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}