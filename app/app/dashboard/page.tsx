'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

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

  // Clear errors on input change
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
      if (!accessToken) throw new Error('No access token from Privy')

      const profileData = {
        address: formData.address.trim(),
        bank_account: formData.bankAccount.trim(),
        vat_number: formData.vatNumber.trim() || null,
        business_type: formData.businessType,
        npo_number: formData.businessType === 'Foundation' ? formData.npoNumber.trim() : null,
      }

      console.log('Sending to Edge Function:', profileData)

      const { data, error: functionError } = await supabase.functions.invoke('onboard-profile', {
        body: {
          token: accessToken,
          profileData,
        },
      })

      if (functionError) throw new Error(functionError.message || 'Failed to call function')
      if (!data?.success) throw new Error(data?.error || 'Onboarding failed')

      toast.success('Profile saved successfully!')

    } catch (err: any) {
      console.error('Onboarding error:', err)
      toast.error(err.message || 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter">
          SupplierAdvisor
        </h1>
        <p className="text-2xl md:text-3xl text-gray-400 mb-12 text-center max-w-3xl">
          Secure on-chain supply chain platform. Connect to begin.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-12 py-6 bg-white text-black font-bold text-2xl rounded-full hover:bg-gray-200 transition-all shadow-2xl"
        >
          Return to Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 lg:px-32 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 text-white">
            Complete Your Profile
          </h1>
          <p className="text-xl md:text-2xl text-gray-400">
            Wallet: {user?.wallet?.address ? (
              <>
                {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
              </>
            ) : (
              'Wallet connected but no address'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Business Details */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
            <h2 className="text-3xl font-bold mb-8 text-green-400">Business Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-medium text-gray-300 mb-3">Physical Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={`w-full px-6 py-5 bg-black border ${errors.address ? 'border-red-500' : 'border-gray-700'} rounded-2xl text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 transition-all text-lg`}
                  placeholder="123 Main St, Durban, KwaZulu-Natal"
                  required
                />
                {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-300 mb-3">Bank Account Details *</label>
                <input
                  type="text"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  className={`w-full px-6 py-5 bg-black border ${errors.bankAccount ? 'border-red-500' : 'border-gray-700'} rounded-2xl text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 transition-all text-lg`}
                  placeholder="FNB | Acc: 12345678901 | Branch: 250655"
                  required
                />
                {errors.bankAccount && <p className="text-red-500 text-sm mt-1">{errors.bankAccount}</p>}
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-300 mb-3">VAT Number</label>
                <input
                  type="text"
                  name="vatNumber"
                  value={formData.vatNumber}
                  onChange={handleChange}
                  className="w-full px-6 py-5 bg-black border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 transition-all text-lg"
                  placeholder="4123456789 (optional)"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-300 mb-3">Business Type</label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full px-6 py-5 bg-black border border-gray-700 rounded-2xl text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/30 transition-all text-lg appearance-none"
                >
                  <option value="Foods">Big Five Foods (Main)</option>
                  <option value="Access">Big Five Access (Tenders)</option>
                  <option value="Foundation">Big Five Foundation (NPO)</option>
                  <option value="Direct">Big Five Direct (Containers)</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Logistics">Logistics</option>
                </select>
              </div>
            </div>

            {formData.businessType === 'Foundation' && (
              <div className="mt-10 p-6 bg-green-900/30 border border-green-800 rounded-2xl">
                <label className="block text-lg font-medium text-green-300 mb-3">NPO Registration Number *</label>
                <input
                  type="text"
                  name="npoNumber"
                  value={formData.npoNumber}
                  onChange={handleChange}
                  className={`w-full px-6 py-5 bg-black border ${errors.npoNumber ? 'border-red-500' : 'border-green-700'} rounded-2xl text-white placeholder-gray-500 focus:border-green-400 focus:ring-2 focus:ring-green-400/30 transition-all text-lg`}
                  placeholder="123-456-NPO-789"
                  required
                />
                {errors.npoNumber && <p className="text-red-500 text-sm mt-1">{errors.npoNumber}</p>}
              </div>
            )}
          </div>

          {/* Certificates */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
            <h2 className="text-3xl font-bold mb-8 text-green-400">Certificates</h2>
            <p className="text-gray-300 mb-6 text-lg">
              Upload ISO, Halal, Kosher, Sedex, BBBEE, etc. (multiple files OK)
            </p>

            <label className="block w-full px-6 py-10 bg-black border-2 border-dashed border-gray-700 rounded-3xl text-center cursor-pointer hover:border-green-500 transition-all">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="text-gray-300 text-xl block mb-2">
                {formData.certificates.length > 0
                  ? `${formData.certificates.length} file${formData.certificates.length > 1 ? 's' : ''} selected`
                  : 'Click or drag & drop files'}
              </span>
              <span className="text-sm text-gray-500">Max 10MB per file</span>
              {errors.certificates && <p className="text-red-500 text-sm mt-2">{errors.certificates}</p>}
            </label>

            {formData.certificates.length > 0 && (
              <div className="mt-6 space-y-2">
                {formData.certificates.map((file, i) => (
                  <div key={i} className="text-gray-300 text-sm">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <label className="block text-lg font-medium text-gray-300 mb-3">Verification Method</label>
              <select
                value={formData.verificationMethod}
                onChange={e => setFormData({ ...formData, verificationMethod: e.target.value as any })}
                className="w-full px-6 py-5 bg-black border border-gray-700 rounded-2xl text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/30 transition-all text-lg"
              >
                <option value="Third-Party">Third-Party Verified</option>
                <option value="Self-Verified">Self-Verified (with documents)</option>
              </select>
              {formData.verificationMethod === 'Self-Verified' && (
                <p className="mt-3 text-yellow-400 text-sm">
                  Self-Verified certificates will show with yellow badge.
                </p>
              )}
            </div>
          </div>

          {/* TEMPORARY TEST BUTTON */}
          <button
            type="button"
            onClick={() => toast.success('Test toast working!')}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition mt-6"
          >
            Test Toast (click me!)
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-3xl text-2xl shadow-2xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving Profile...' : 'Complete Onboarding & Verify'}
          </button>
        </form>
      </div>
    </div>
  )
}
