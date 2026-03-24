'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Drivers() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)

  const [drivers, setDrivers] = useState([
    { 
      id: 1, 
      name: 'John Mthembu', 
      idNumber: '8212312345678', 
      licenseNumber: 'DL12345678', 
      licenseExpiry: '2028-05-15', 
      address: '123 Port Road, Durban', 
      phone: '082 345 6789', 
      email: 'john@bigfivefoods.co.za', 
      dob: '1982-12-31', 
      bloodGroup: 'O+', 
      emergencyContact: 'Thandi Mthembu 083 456 7890', 
      assignedVehicle: 'ND 123 456', 
      status: 'Active',
      licenseFront: 'https://via.placeholder.com/300x200/10b981/fff?text=License+Front',
      licenseBack: 'https://via.placeholder.com/300x200/10b981/fff?text=License+Back'
    },
    { 
      id: 2, 
      name: 'Sizwe Nkosi', 
      idNumber: '9010105678901', 
      licenseNumber: 'DL87654321', 
      licenseExpiry: '2027-11-20', 
      address: '45 Church Street, Pietermaritzburg', 
      phone: '083 456 7890', 
      email: 'sizwe@bigfivefoods.co.za', 
      dob: '1990-10-10', 
      bloodGroup: 'B+', 
      emergencyContact: 'Nomsa Nkosi 084 567 8901', 
      assignedVehicle: 'ND 789 012', 
      status: 'Active',
      licenseFront: 'https://via.placeholder.com/300x200/10b981/fff?text=License+Front',
      licenseBack: 'https://via.placeholder.com/300x200/10b981/fff?text=License+Back'
    }
  ])

  const [newDriver, setNewDriver] = useState({
    name: '', idNumber: '', licenseNumber: '', licenseExpiry: '', address: '', phone: '', email: '', dob: '', bloodGroup: 'O+', emergencyContact: '', assignedVehicle: '', status: 'Active',
    licenseFront: '', licenseBack: ''
  })

  const [licenseFrontPreview, setLicenseFrontPreview] = useState('')
  const [licenseBackPreview, setLicenseBackPreview] = useState('')

  const openModal = (driver?: any) => {
    if (driver) {
      setNewDriver({ ...driver })
      setLicenseFrontPreview(driver.licenseFront)
      setLicenseBackPreview(driver.licenseBack)
      setEditingDriver(driver)
    } else {
      setNewDriver({ name: '', idNumber: '', licenseNumber: '', licenseExpiry: '', address: '', phone: '', email: '', dob: '', bloodGroup: 'O+', emergencyContact: '', assignedVehicle: '', status: 'Active', licenseFront: '', licenseBack: '' })
      setLicenseFrontPreview('')
      setLicenseBackPreview('')
      setEditingDriver(null)
    }
    setShowModal(true)
  }

  const handleImageUpload = (e: any, side: 'front' | 'back') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (side === 'front') {
          setLicenseFrontPreview(ev.target?.result as string)
          setNewDriver({ ...newDriver, licenseFront: ev.target?.result as string })
        } else {
          setLicenseBackPreview(ev.target?.result as string)
          setNewDriver({ ...newDriver, licenseBack: ev.target?.result as string })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const saveDriver = () => {
    if (!newDriver.name || !newDriver.licenseNumber) return

    if (editingDriver) {
      setDrivers(drivers.map(d => d.id === editingDriver.id ? { ...newDriver, id: d.id } : d))
    } else {
      setDrivers([...drivers, { ...newDriver, id: Date.now() }])
    }

    setShowModal(false)
    setEditingDriver(null)
  }

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.licenseNumber.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ marginLeft: '25px', marginRight: '25px' }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/logistics" style={{ color: '#10b981', textDecoration: 'none' }}>← Back to Logistics</Link>
        <span style={{ color: '#aaa' }}>/ Drivers</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>Drivers</h3>
        <button onClick={() => openModal()} style={{ background: '#10b981', color: '#000', padding: '14px 32px', borderRadius: '12px', fontWeight: 'bold' }}>
          + Add New Driver
        </button>
      </div>

      <input 
        type="text" 
        placeholder="Search driver or license number..." 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
        style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff', marginBottom: '30px' }} 
      />

      <div style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(24px)', borderRadius: '28px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>License No.</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Expiry Date</th>
              <th style={{ textAlign: 'left', padding: '20px', color: '#aaa' }}>Assigned Vehicle</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Status</th>
              <th style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '20px', color: '#fff', fontWeight: 'bold' }}>{d.name}</td>
                <td style={{ padding: '20px', color: '#ccc' }}>{d.licenseNumber}</td>
                <td style={{ padding: '20px', textAlign: 'center', color: new Date(d.licenseExpiry) < new Date() ? '#ef4444' : '#10b981' }}>
                  {d.licenseExpiry}
                </td>
                <td style={{ padding: '20px', color: '#10b981' }}>{d.assignedVehicle || 'Unassigned'}</td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <span style={{ padding: '6px 20px', borderRadius: '999px', background: d.status === 'Active' ? '#10b98133' : '#ef444433', color: d.status === 'Active' ? '#10b981' : '#ef4444' }}>
                    {d.status}
                  </span>
                </td>
                <td style={{ padding: '20px', textAlign: 'center' }}>
                  <button onClick={() => openModal(d)} style={{ background: '#333', color: '#fff', padding: '8px 18px', borderRadius: '8px', fontSize: '14px' }}>✏️ Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT DRIVER MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', padding: '40px', borderRadius: '28px', width: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ color: '#fff', marginBottom: '30px' }}>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Full Name</label>
                <input value={newDriver.name} onChange={e => setNewDriver({ ...newDriver, name: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>ID Number</label>
                <input value={newDriver.idNumber} onChange={e => setNewDriver({ ...newDriver, idNumber: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>License Number</label>
                <input value={newDriver.licenseNumber} onChange={e => setNewDriver({ ...newDriver, licenseNumber: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>License Expiry Date</label>
                <input 
                  type="date" 
                  value={newDriver.licenseExpiry} 
                  onChange={e => setNewDriver({ ...newDriver, licenseExpiry: e.target.value })} 
                  style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} 
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Address</label>
                <input value={newDriver.address} onChange={e => setNewDriver({ ...newDriver, address: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Phone</label>
                <input value={newDriver.phone} onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Email</label>
                <input value={newDriver.email} onChange={e => setNewDriver({ ...newDriver, email: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Date of Birth</label>
                <input type="date" value={newDriver.dob} onChange={e => setNewDriver({ ...newDriver, dob: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Blood Group</label>
                <select value={newDriver.bloodGroup} onChange={e => setNewDriver({ ...newDriver, bloodGroup: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  <option>O+</option>
                  <option>O-</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Emergency Contact</label>
                <input value={newDriver.emergencyContact} onChange={e => setNewDriver({ ...newDriver, emergencyContact: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }} />
              </div>

              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Assigned Vehicle</label>
                <select value={newDriver.assignedVehicle} onChange={e => setNewDriver({ ...newDriver, assignedVehicle: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  <option>Unassigned</option>
                  <option>ND 123 456</option>
                  <option>ND 789 012</option>
                  <option>ND 456 789</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>Status</label>
                <select value={newDriver.status} onChange={e => setNewDriver({ ...newDriver, status: e.target.value })} style={{ width: '100%', padding: '16px', background: '#000', borderRadius: '12px', color: '#fff' }}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>

              {/* License Images */}
              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>License Front</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'front')} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                {licenseFrontPreview && <img src={licenseFrontPreview} alt="Front" style={{ width: '100%', marginTop: '12px', borderRadius: '12px' }} />}
              </div>

              <div>
                <label style={{ color: '#aaa', marginBottom: '8px', display: 'block' }}>License Back</label>
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'back')} style={{ width: '100%', padding: '12px', background: '#000', borderRadius: '12px', color: '#fff' }} />
                {licenseBackPreview && <img src={licenseBackPreview} alt="Back" style={{ width: '100%', marginTop: '12px', borderRadius: '12px' }} />}
              </div>
            </div>

            {/* FUTURE NOTIFICATION NOTE */}
            <div style={{ marginTop: '20px', padding: '12px', background: '#1a1a1a', borderRadius: '12px', fontSize: '14px', color: '#666' }}>
              Note: License expiry notifications (email 30 days before & after expiry) will be added in a future update.
            </div>

            <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
              <button onClick={saveDriver} style={{ flex: 1, background: '#10b981', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 'bold' }}>
                {editingDriver ? 'Save Changes' : 'Add Driver'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#333', color: '#fff', padding: '18px', borderRadius: '14px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}