'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

export default function TestPage() {
  const [showSuccess, setShowSuccess] = useState(false)

  const handleClick = () => {
    toast.success('Test toast working!', { duration: 4000 })
    setShowSuccess(true)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-black mb-12">Test Page</h1>

      {!showSuccess ? (
        <button
          onClick={handleClick}
          className="px-12 py-6 bg-green-600 hover:bg-green-700 rounded-3xl text-white font-bold text-2xl transition shadow-2xl"
        >
          Click Me - Show Success View
        </button>
      ) : (
        <div className="bg-green-900/40 border border-green-700 rounded-3xl p-12 text-center max-w-2xl">
          <h2 className="text-5xl font-bold text-green-400 mb-8">Success!</h2>
          <p className="text-2xl text-gray-300 mb-8">
            This is the "Profile Already Complete" view. Form should be hidden.
          </p>
          <button
            onClick={() => setShowSuccess(false)}
            className="px-10 py-5 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-bold text-xl transition"
          >
            Back to Form
          </button>
        </div>
      )}
    </div>
  )
}
