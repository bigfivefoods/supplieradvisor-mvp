'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SRM_PO() {
  // Metadata filters
  const [showCompanyName, setShowCompanyName] = useState(false)
  const [showLocation, setShowLocation] = useState(false)
  const [showIndustry, setShowIndustry] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const [showBusinessType, setShowBusinessType] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [showSize, setShowSize] = useState(false)

  const [selectedCompanyNames, setSelectedCompanyNames] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([])
  const [selectedVerificationMethods, setSelectedVerificationMethods] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])

  // PO Form
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({})

  // Recent POs — now with full date AND time
  const [recentPOs, setRecentPOs] = useState([
    { id: 1, supplier: 'BigFive Foods', totalPrice: 22750.00, status: 'Sent', date: '2026-03-21 14:35' },
  ])

  // Mock suppliers
  const allSuppliers = [
    { 
      name: 'BigFive Foods', location: 'Durban', industry: 'Foods', certifications: 'HACCP', businessType: 'Foods', verification: 'Third-Party', size: 'Large',
      inventory: [
        { sku: 'Tomato Paste 1kg', uom: 'kg', price: 45.50 },
        { sku: 'Fresh Chicken 2kg', uom: 'pack', price: 68.00 },
        { sku: 'Rice 5kg', uom: 'bag', price: 32.75 }
      ],
      otifef: { ot: 96.4, if: 94.2, ef: 97.1, average: 95.9 }
    },
    { 
      name: 'KZN Fresh Produce', location: 'Pietermaritzburg', industry: 'Agriculture', certifications: 'GlobalGAP', businessType: 'Agriculture', verification: 'Self-Verified', size: 'Medium',
      inventory: [
        { sku: 'Fresh Chicken 2kg', uom: 'pack', price: 67.25 },
        { sku: 'Eggs 30pk', uom: 'box', price: 28.90 }
      ],
      otifef: { ot: 89.7, if: 91.3, ef: 88.5, average: 89.8 }
    },
    { 
      name: 'Cape Agri Supply', location: 'Cape Town', industry: 'Foods', certifications: 'BRCGS', businessType: 'Foods', verification: 'Third-Party', size: 'Large',
      inventory: [
        { sku: 'Rice 5kg', uom: 'bag', price: 31.50 },
        { sku: 'Potatoes 10kg', uom: 'sack', price: 18.75 }
      ],
      otifef: { ot: 93.8, if: 95.1, ef: 92.4, average: 93.8 }
    },
  ]

  const filteredSuppliers = allSuppliers.filter(s => {
    const matchesCompany = selectedCompanyNames.length === 0 || selectedCompanyNames.includes(s.name)
    const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(s.location)
    const matchesIndustry = selectedIndustries.length === 0 || selectedIndustries.includes(s.industry)
    const matchesCert = selectedCerts.length === 0 || selectedCerts.some(c => s.certifications.includes(c))
    const matchesType = selectedBusinessTypes.length === 0 || selectedBusinessTypes.includes(s.businessType)
    const matchesVerification = selectedVerificationMethods.length === 0 || selectedVerificationMethods.includes(s.verification)
    const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(s.size)
    return matchesCompany && matchesLocation && matchesIndustry && matchesCert && matchesType && matchesVerification && matchesSize
  })

  const currentSupplierData = allSuppliers.find(s => s.name === selectedSupplier)

  const updateQuantity = (sku: string, qty: number) => {
    setSkuQuantities(prev => ({ ...prev, [sku]: qty }))
  }

  const lineTotal = (sku: string) => {
    const item = currentSupplierData?.inventory.find(i => i.sku === sku)
    const qty = skuQuantities[sku] || 0
    return (item?.price || 0) * qty
  }

  const grandTotal = currentSupplierData 
    ? currentSupplierData.inventory.reduce((sum, item) => sum + lineTotal(item.sku), 0) 
    : 0

  const submitPO = () => {
    if (!selectedSupplier || Object.keys(skuQuantities).length === 0) {
      alert('Please select a supplier and at least one SKU with quantity')
      return
    }

    const newPO = {
      id: Date.now(),
      supplier: selectedSupplier,
      totalPrice: grandTotal,
      status: 'Sent',
      date: new Date().toLocaleString('en-ZA')   // ← FULL DATE + TIME
    }

    setRecentPOs([newPO, ...recentPOs])
    alert(`✅ Purchase Order sent successfully! Grand Total: R${grandTotal.toFixed(2)}`)

    setSelectedSupplier('')
    setSkuQuantities({})
  }

  return (
    <div>
      <div style={{ marginLeft: '25px', marginRight: '25px' }}>

        {/* BREADCRUMB */}
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/srm" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ← Back to SRM
          </Link>
          <div style={{ color: '#666' }}>/</div>
          <span style={{ color: '#aaa', fontSize: '18px' }}>Raise Purchase Order</span>
        </div>

        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '40px' }}>
          Raise New Purchase Order
        </h3>

        {/* TOP ROW — FILTER (HALF) + OTIFEF METRICS (HALF) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }}>

          {/* FILTER CONNECTED SUPPLIER — HALF WIDTH */}
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(16,185,129,0.25)', padding: '40px', borderRadius: '28px' }}>
            <h4 style={{ fontSize: '22px', color: '#fff', marginBottom: '24px' }}>Filter Connected Supplier</h4>
            <select 
              value={selectedSupplier} 
              onChange={e => {
                setSelectedSupplier(e.target.value)
                setSkuQuantities({})
              }}
              style={{ width: '100%', padding: '20px', background: '#000', borderRadius: '14px', color: '#fff', fontSize: '18px' }}
            >
              <option value="">— Select Supplier —</option>
              {filteredSuppliers.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* OTIFEF METRICS CARD — HALF WIDTH + OTIFEF AVERAGE FIRST */}
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
            <h4 style={{ fontSize: '22px', color: '#fff', marginBottom: '24px' }}>
              {selectedSupplier ? `OTIFEF Metrics — ${selectedSupplier}` : 'OTIFEF Metrics'}
            </h4>
            
            {selectedSupplier && currentSupplierData ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ textAlign: 'center', background: '#10b981', padding: '24px', borderRadius: '14px', color: '#000' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>OTIFEF Average</div>
                  <div style={{ fontSize: '48px', fontWeight: '900' }}>{currentSupplierData.otifef.average.toFixed(1)}<span style={{ fontSize: '24px' }}>%</span></div>
                </div>
                <div style={{ textAlign: 'center', background: '#111', padding: '24px', borderRadius: '14px' }}>
                  <div style={{ fontSize: '18px', color: '#aaa' }}>On-Time</div>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{currentSupplierData.otifef.ot.toFixed(1)}<span style={{ fontSize: '24px' }}>%</span></div>
                </div>
                <div style={{ textAlign: 'center', background: '#111', padding: '24px', borderRadius: '14px' }}>
                  <div style={{ fontSize: '18px', color: '#aaa' }}>In-Full</div>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{currentSupplierData.otifef.if.toFixed(1)}<span style={{ fontSize: '24px' }}>%</span></div>
                </div>
                <div style={{ textAlign: 'center', background: '#111', padding: '24px', borderRadius: '14px' }}>
                  <div style={{ fontSize: '18px', color: '#aaa' }}>Error-Free</div>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#fff' }}>{currentSupplierData.otifef.ef.toFixed(1)}<span style={{ fontSize: '24px' }}>%</span></div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: '80px 20px' }}>
                Select a supplier to see OTIFEF metrics
              </div>
            )}
          </div>
        </div>

        {/* SKU TABLE */}
        {selectedSupplier && currentSupplierData && (
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '50px', borderRadius: '28px', marginBottom: '40px' }}>
            <h4 style={{ fontSize: '22px', color: '#fff', marginBottom: '30px' }}>SKUs for {selectedSupplier}</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: '16px', color: '#aaa' }}>UOM</th>
                    <th style={{ textAlign: 'right', padding: '16px', color: '#aaa' }}>Price per UOM</th>
                    <th style={{ textAlign: 'center', padding: '16px', color: '#aaa' }}>Quantity Required</th>
                    <th style={{ textAlign: 'right', padding: '16px', color: '#aaa' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSupplierData.inventory.map(item => {
                    const qty = skuQuantities[item.sku] || ''
                    const lineTotal = (item.price * (parseFloat(qty) || 0)).toFixed(2)
                    return (
                      <tr key={item.sku} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '20px', color: '#fff' }}>{item.sku}</td>
                        <td style={{ padding: '20px', color: '#aaa' }}>{item.uom}</td>
                        <td style={{ padding: '20px', color: '#10b981', textAlign: 'right' }}>R{item.price}</td>
                        <td style={{ padding: '20px', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            value={qty} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value)
                              setSkuQuantities(prev => ({ ...prev, [item.sku]: val }))
                            }}
                            placeholder="0"
                            style={{ width: '120px', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff', textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ padding: '20px', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>R{lineTotal}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'right', fontSize: '26px', color: '#fff' }}>
              Grand Total: <span style={{ color: '#10b981', fontWeight: 'bold' }}>R{grandTotal.toFixed(2)}</span>
            </div>

            <button 
              onClick={submitPO}
              style={{ marginTop: '40px', width: '100%', background: '#10b981', color: '#000', padding: '24px', fontSize: '22px', fontWeight: 'bold', borderRadius: '16px', cursor: 'pointer' }}
            >
              Submit Purchase Order
            </button>
          </div>
        )}

        {/* RECENT PURCHASE ORDERS — ONE ROW PER PO WITH TOTAL + DATE + TIME */}
        <h4 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '20px', marginTop: '60px' }}>
          Recent Purchase Orders
        </h4>
        <div style={{ background: '#111', padding: '40px', borderRadius: '28px' }}>
          {recentPOs.map(po => (
            <div key={po.id} style={{ padding: '24px', background: '#0a0a0a', borderRadius: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '18px' }}>{po.supplier}</div>
                <div style={{ color: '#aaa' }}>PO Total</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>R{po.totalPrice.toFixed(2)}</div>
                <div style={{ color: '#666', fontSize: '14px' }}>{po.date}</div>   {/* ← FULL DATE + TIME */}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}