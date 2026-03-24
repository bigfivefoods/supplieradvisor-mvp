'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function OutboundShipments() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const shipments = [
    { id: 'OUT-001', customer: 'Shoprite Checkers', item: 'Pasta Sauce Jar', qty: 450, etd: '2026-03-24 08:00', status: 'Ready', value: 'R13,500' },
    { id: 'OUT-002', customer: 'Pick n Pay', item: 'Ready Meal Pack', qty: 280, etd: '2026-03-24 12:00', status: 'In Transit', value: 'R22,400' },
    { id: 'OUT-003', customer: 'Spar', item: 'Organic Chicken', qty: 150, etd: '2026-03-25 09:00', status: 'Delivered', value: 'R12,000' },
  ]

  const filtered = shipments.filter(s => {
    const matchesSearch = s.customer.toLowerCase().includes(search.toLowerCase()) || s.item.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/logistics" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Logistics</Link>
        <span style={{ color: '#aaa' }}>/ Outbound Shipments</span>
      </div>

      <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '30px' }}>Outbound Shipments</h3>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
        <input type="text" placeholder="Search customer or item..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
          <option value="All">All Status</option>
          <option value="Ready">Ready</option>
          <option value="In Transit">In Transit</option>
          <option value="Delivered">Delivered</option>
        </select>
      </div>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Shipment ID</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Customer</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Qty</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>ETD</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '20px', color: '#aaa' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '20px', color: '#fff', fontWeight: 'bold' }}>{s.id}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{s.customer}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{s.item}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>{s.qty}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#10b981' }}>{s.etd}</td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <span style={{ padding: '6px 20px', borderRadius: '999px', background: s.status === 'Delivered' ? '#10b98133' : s.status === 'In Transit' ? '#f59e0b33' : '#666', color: s.status === 'Delivered' ? '#10b981' : s.status === 'In Transit' ? '#f59e0b' : '#aaa' }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '20px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}