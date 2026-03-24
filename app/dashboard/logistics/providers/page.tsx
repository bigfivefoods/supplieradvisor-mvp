'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ExternalProviders() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const providers = [
    { id: 'P-001', name: 'DHL Supply Chain', service: 'Express Delivery', contract: 'Active', rating: '4.9', shipments: 124, cost: 'R1.2m' },
    { id: 'P-002', name: 'Imperial Logistics', service: 'Full Logistics', contract: 'Active', rating: '4.8', shipments: 89, cost: 'R890k' },
    { id: 'P-003', name: 'Bidvest Freight', service: 'Bulk Transport', contract: 'Active', rating: '4.7', shipments: 67, cost: 'R650k' },
    { id: 'P-004', name: 'FastMovers SA', service: 'Last Mile', contract: 'Expired', rating: '4.2', shipments: 34, cost: 'R320k' },
  ]

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.service.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || p.contract === statusFilter
    return matchesSearch && matchesStatus
  })

  const getContractColor = (contract: string) => {
    if (contract === 'Active') return '#10b981'
    return '#ef4444'
  }

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/logistics" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Logistics</Link>
        <span style={{ color: '#aaa' }}>/ External Providers</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>External Providers</h3>
        <button style={{ background: '#10b981', color: '#000', padding: '14px 32px', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px' }}>
          + Add New Provider
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '30px' }}>
        <input 
          type="text" 
          placeholder="Search by provider or service..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }} 
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', fontSize: '16px' }}>
          <option value="All">All Contracts</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Provider ID</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Service</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Contract</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Shipments</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Rating</th>
              <th style={{ textAlign: 'right', padding: '20px', color: '#aaa' }}>Cost (YTD)</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '20px', color: '#fff', fontWeight: 'bold' }}>{p.id}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{p.name}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{p.service}</td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <span style={{ padding: '6px 20px', borderRadius: '999px', background: getContractColor(p.contract) + '33', color: getContractColor(p.contract), fontSize: '14px', fontWeight: 'bold' }}>
                    {p.contract}
                  </span>
                </td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>{p.shipments}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>⭐ {p.rating}</td>
                <td style={{ padding: '20px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{p.cost}</td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <button style={{ background: '#333', color: '#fff', padding: '8px 18px', borderRadius: '8px', fontSize: '14px' }}>View Contract</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}