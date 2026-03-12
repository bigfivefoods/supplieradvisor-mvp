'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function Onboarding() {
  const { ready, authenticated, user, getAccessToken } = usePrivy()
  const [formData, setFormData] = useState({
    address: '',
    bankAccount: '',
    vatNumber: '',
    businessType: 'Foods',
    npoNumber: '',
    certificates: [] as File[],
    verificationMethod: 'Self-Verified' as 'Third-Party' | 'Self-Verified',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [hasProfile, setHasProfile] = useState(false)
  const [editMode, setEditMode] = useState(true)

  // Fetch profile
  const fetchProfile = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setHasProfile(true)
        setEditMode(false)
        setFormData({
          address: data.address || '',
          bankAccount: data.bank_account || '',
          vatNumber: data.vat_number || '',
          businessType: data.business_type || 'Foods',
          npoNumber: data.npo_number || '',
          certificates: [],
          verificationMethod: 'Self-Verified',
        })
        toast.success('Profile already saved!', { duration: 4000 })
      } else {
        setHasProfile(false)
        setEditMode(true)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ready && authenticated && user?.id) {
      fetchProfile()
    }
  }, [ready, authenticated, user?.id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setFormData(prev => ({ ...prev, certificates: files }))
      setErrors(prev => ({ ...prev, certificates: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.address.trim()) newErrors.address = 'Physical address is required'
    if (!formData.bankAccount.trim()) newErrors.bankAccount = 'Bank account details are required'
    if (formData.businessType === 'Foundation' && !formData.npoNumber.trim()) {
      newErrors.npoNumber = 'NPO registration number is required for Foundation'
    }
    if (formData.certificates.length === 0) {
      newErrors.certificates = 'Please upload at least one certificate'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('No access token')

      const profileData = {
        address: formData.address.trim(),
        bank_account: formData.bankAccount.trim(),
        vat_number: formData.vatNumber.trim() || null,
        business_type: formData.businessType,
        npo_number: formData.businessType === 'Foundation' ? formData.npoNumber.trim() : null,
      }

      const { data, error } = await supabase.functions.invoke('onboard-profile', {
        body: { token: accessToken, profileData },
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed')

      toast.success('Profile saved!', { duration: 4000 })
      setHasProfile(true)
      setEditMode(false)
      fetchProfile() // Force refresh UI

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return <div>Loading...</div>
  if (!authenticated) return <div>Please log in</div>

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-black text-center mb-8">Complete Your Profile</h1>
        <p className="text-xl text-gray-400 text-center mb-12">
          Wallet: {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
        </p>

        {loading ? (
          <p className="text-center text-xl">Loading...</p>
        ) : hasProfile && !editMode ? (
          <div className="bg-green-900/40 border border-green-700 rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-bold text-green-400 mb-6">Profile Complete!</h2>
            <p className="text-xl text-gray-300 mb-8">
              Your profile is saved. You can view or edit it.
            </p>
            <div className="flex justify-center gap-6">
              <Link href="/dashboard" className="px-10 py-5 bg-green-600 hover:bg-green-700 rounded-xl text-white font-bold">
                View Dashboard
              </Link>
              <button onClick={() => setEditMode(true)} className="px-10 py-5 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold">
                Edit Profile
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-12">
            {/* Your form fields here - keep your existing ones */}
            {/* ... copy your form content from previous version ... */}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-3xl text-2xl"
            >
              {loading ? 'Saving...' : 'Complete Onboarding & Verify'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
