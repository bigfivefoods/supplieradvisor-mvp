'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SRM_Search() {
  const [searchTerm, setSearchTerm] = useState('')

  // Dropdown visibility
  const [showLocation, setShowLocation] = useState(false)
  const [showIndustry, setShowIndustry] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const [showBusinessType, setShowBusinessType] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [showSize, setShowSize] = useState(false)

  // Selected values
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([])
  const [selectedVerificationMethods, setSelectedVerificationMethods] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])

  const [pendingOnPlatform, setPendingOnPlatform] = useState<any[]>([])
  const [invitedByEmail, setInvitedByEmail] = useState<any[]>([])

  // Invite Form
  const [inviteForm, setInviteForm] = useState({ company: '', contact: '', email: '' })
  const [inviteMessage, setInviteMessage] = useState(
    `Dear [Contact Name],

I came across your company and believe we could create real value together on SupplierAdvisor.

SupplierAdvisor is an on-chain B2B platform that connects verified businesses, streamlines purchase orders, payments, ratings and performance tracking with full transparency and trust.

I'd love to connect and explore potential collaboration opportunities.

Click here to join and connect with me directly: https://supplieradvisor.com/onboarding

Best regards,
[Your Name]
[Your Company Name]`
  )

  const allSuppliers = [
    { id: 1, name: 'BigFive Foods', vat: '42696969', location: 'Durban', industry: 'Foods', certifications: 'HACCP, ISO 22000', businessType: 'Foods', verificationMethod: 'Third-Party', businessSize: 'Medium', rating: 94, otifef: { ot: 98, if: 95, ef: 100 } },
    { id: 2, name: 'KZN Fresh Produce', vat: '98765432', location: 'Pietermaritzburg', industry: 'Agriculture', certifications: 'GlobalGAP', businessType: 'Agriculture', verificationMethod: 'Self-Verified', businessSize: 'Small', rating: 89, otifef: { ot: 92, if: 88, ef: 95 } },
    { id: 3, name: 'Cape Agri Supply', vat: '11223344', location: 'Cape Town', industry: 'Foods', certifications: 'BRCGS', businessType: 'Foods', verificationMethod: 'Third-Party', businessSize: 'Large', rating: 97, otifef: { ot: 100, if: 96, ef: 99 } },
  ]

  const filteredSuppliers = allSuppliers.filter(s => 
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedLocations.length === 0 || selectedLocations.includes(s.location)) &&
    (selectedIndustries.length === 0 || selectedIndustries.includes(s.industry)) &&
    (selectedCerts.length === 0 || selectedCerts.some(c => s.certifications.includes(c))) &&
    (selectedBusinessTypes.length === 0 || selectedBusinessTypes.includes(s.businessType)) &&
    (selectedVerificationMethods.length === 0 || selectedVerificationMethods.includes(s.verificationMethod)) &&
    (selectedSizes.length === 0 || selectedSizes.includes(s.businessSize))
  )

  const toggle = (list: string[], setList: any, value: string) => {
    if (list.includes(value)) setList(list.filter(v => v !== value))
    else setList([...list, value])
  }

  const sendConnectionRequest = (supplier: any) => {
    if (pendingOnPlatform.find(p => p.id === supplier.id)) return alert('Request already sent!')
    setPendingOnPlatform([...pendingOnPlatform, { ...supplier, timestamp: new Date() }])
    alert(`✅ Connection request sent to ${supplier.name}. They must approve.`)
  }

  const sendCustomInvitation = () => {
    if (!inviteForm.company || !inviteForm.contact || !inviteForm.email) return alert('Please fill all fields')
    const timestamp = new Date()
    setInvitedByEmail([...invitedByEmail, { 
      name: inviteForm.company, 
      email: inviteForm.email, 
      contact: inviteForm.contact, 
      message: inviteMessage,
      timestamp 
    }])
    alert(`📧 Invitation sent to ${inviteForm.email} for ${inviteForm.company}!\n\nThey received a direct link to the onboarding page.`)
    setInviteForm({ company: '', contact: '', email: '' })
  }

  return (
    <div>
      {/* TIGHT ALIGNMENT — JUST 25px OFF THE VERTICAL SIDEBAR */}
      <div style={{ marginLeft: '25px', marginRight: '25px' }}>

        {/* BREADCRUMB */}
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/srm" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ← Back to SRM
          </Link>
          <div style={{ color: '#666' }}>/</div>
          <span style={{ color: '#aaa', fontSize: '18px' }}>Search Suppliers</span>
        </div>

        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '12px' }}>
          Search Suppliers
        </h3>

        {/* TOP ROW - 2 CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '70px' }}>
          {/* SEARCH SUPPLIERS CARD */}
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
            <input type="text" placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '20px', fontSize: '22px', background: '#000', borderRadius: '12px', color: '#fff', marginBottom: '30px' }} />

            {/* ROW 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowLocation(!showLocation)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Location {selectedLocations.length > 0 && `(${selectedLocations.length})`} ▼</div>
                {showLocation && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['Durban','Pietermaritzburg','Cape Town','Johannesburg'].map(loc => <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggle(selectedLocations, setSelectedLocations, loc)} />{loc}</label>)}</div>}
              </div>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowIndustry(!showIndustry)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Industry {selectedIndustries.length > 0 && `(${selectedIndustries.length})`} ▼</div>
                {showIndustry && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['Foods','Agriculture','Manufacturing','Logistics','Services'].map(ind => <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedIndustries.includes(ind)} onChange={() => toggle(selectedIndustries, setSelectedIndustries, ind)} />{ind}</label>)}</div>}
              </div>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowCert(!showCert)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Certifications {selectedCerts.length > 0 && `(${selectedCerts.length})`} ▼</div>
                {showCert && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['HACCP','ISO 22000','GlobalGAP','BRCGS'].map(cert => <label key={cert} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedCerts.includes(cert)} onChange={() => toggle(selectedCerts, setSelectedCerts, cert)} />{cert}</label>)}</div>}
              </div>
            </div>

            {/* ROW 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowBusinessType(!showBusinessType)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Business Type {selectedBusinessTypes.length > 0 && `(${selectedBusinessTypes.length})`} ▼</div>
                {showBusinessType && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['Foods','Agriculture','Manufacturing','Logistics','Services'].map(type => <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedBusinessTypes.includes(type)} onChange={() => toggle(selectedBusinessTypes, setSelectedBusinessTypes, type)} />{type}</label>)}</div>}
              </div>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowVerification(!showVerification)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Verification Method {selectedVerificationMethods.length > 0 && `(${selectedVerificationMethods.length})`} ▼</div>
                {showVerification && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['Self-Verified','Third-Party'].map(method => <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedVerificationMethods.includes(method)} onChange={() => toggle(selectedVerificationMethods, setSelectedVerificationMethods, method)} />{method}</label>)}</div>}
              </div>
              <div style={{ position: 'relative' }}>
                <div onClick={() => setShowSize(!showSize)} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>Business Size {selectedSizes.length > 0 && `(${selectedSizes.length})`} ▼</div>
                {showSize && <div style={{ marginTop: '8px', background: '#111', borderRadius: '12px', padding: '12px' }}>{['Small','Medium','Large'].map(size => <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', color: '#fff' }}><input type="checkbox" checked={selectedSizes.includes(size)} onChange={() => toggle(selectedSizes, setSelectedSizes, size)} />{size}</label>)}</div>}
              </div>
            </div>
          </div>

          {/* CAN’T FIND SUPPLIER CARD */}
          <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', padding: '40px', borderRadius: '28px' }}>
            <h3 style={{ fontSize: '28px', marginBottom: '20px', color: '#fff' }}>Can’t find the supplier?</h3>
            <p style={{ color: '#aaa', marginBottom: '24px' }}>Invite them now to join SupplierAdvisor.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <input type="text" placeholder="Company Name" value={inviteForm.company} onChange={e => setInviteForm({ ...inviteForm, company: e.target.value })} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              <input type="text" placeholder="Contact Name" value={inviteForm.contact} onChange={e => setInviteForm({ ...inviteForm, contact: e.target.value })} style={{ padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
            </div>
            <input type="email" placeholder="Email Address" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', marginBottom: '24px', color: '#fff' }} />

            <div style={{ marginBottom: '8px', color: '#aaa' }}>Message to send</div>
            <textarea value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} style={{ width: '100%', height: '140px', padding: '16px', background: '#000', borderRadius: '12px', fontSize: '16px', color: '#fff', marginBottom: '24px' }} />

            <button onClick={sendCustomInvitation} style={{ width: '100%', background: '#10b981', color: 'black', padding: '18px', fontSize: '18px', fontWeight: 'bold', borderRadius: '14px' }}>Send Invitation</button>
          </div>
        </div>

        {/* SUPPLIERS ON SUPPLIERADVISOR */}
        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '20px' }}>Suppliers on SupplierAdvisor</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px' }}>
          {filteredSuppliers.map(sup => {
            const isPending = pendingOnPlatform.find(p => p.id === sup.id)
            return (
              <div key={sup.id} style={{ 
                background: 'rgba(17,17,17,0.9)', 
                backdropFilter: 'blur(24px)', 
                padding: '32px', 
                borderRadius: '28px'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', color: '#fff' }}>{sup.name}</div>
                <div style={{ color: '#10b981', marginBottom: '16px' }}>📍 {sup.location} • {sup.industry}</div>
                <div style={{ color: '#888', marginBottom: '24px' }}>Cert: {sup.certifications}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                  <div><div style={{ color: '#10b981', fontSize: '18px' }}>Rating</div><div style={{ fontSize: '42px', fontWeight: '900', color: '#fff' }}>{sup.rating}<span style={{ fontSize: '22px' }}>%</span></div></div>
                  <div><div style={{ color: '#10b981', fontSize: '18px' }}>OTIFEF</div><div style={{ fontSize: '20px', color: '#fff' }}>OT {sup.otifef.ot}% • IF {sup.otifef.if}% • EF {sup.otifef.ef}%</div></div>
                </div>
                <button 
                  onClick={() => sendConnectionRequest(sup)}
                  style={{ 
                    width: '100%', 
                    background: isPending ? '#f59e0b' : '#10b981', 
                    color: 'black', 
                    padding: '16px', 
                    borderRadius: '14px', 
                    fontWeight: 'bold' 
                  }}
                >
                  {isPending ? 'Pending Request' : 'Send Connection Request'}
                </button>
              </div>
            )
          })}
        </div>

        {/* PENDING REQUESTS */}
        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginTop: '70px', marginBottom: '20px' }}>Pending Requests</h3>
        <div style={{ background: '#111', padding: '40px', borderRadius: '28px' }}>
          {pendingOnPlatform.length === 0 && invitedByEmail.length === 0 && <p style={{ color: '#888' }}>No pending requests yet.</p>}
          
          {pendingOnPlatform.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h4 style={{ color: '#ffaa00', marginBottom: '16px' }}>On Platform</h4>
              {pendingOnPlatform.map((item, index) => (
                <div key={index} style={{ padding: '16px', background: '#0a0a0a', borderRadius: '12px', marginBottom: '12px' }}>
                  Awaiting approval from <strong>{item.name}</strong> — sent {item.timestamp.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              ))}
            </div>
          )}

          {invitedByEmail.length > 0 && (
            <div>
              <h4 style={{ color: '#f59e0b', marginBottom: '16px' }}>By Email</h4>
              {invitedByEmail.map((inv, index) => (
                <div key={index} style={{ padding: '16px', background: '#0a0a0a', borderRadius: '12px', marginBottom: '12px' }}>
                  Invitation sent to <strong>{inv.email}</strong> — sent {inv.timestamp.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}