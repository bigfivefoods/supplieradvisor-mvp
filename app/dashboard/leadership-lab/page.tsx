'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function LeadershipLab() {
  const [selectedFace, setSelectedFace] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)

  // Auto-rotate the cube smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(r => r + 0.6)
    }, 40)
    return () => clearInterval(interval)
  }, [])

  const faces = [
    { name: 'Choices', color: '#FF6B6B' },
    { name: 'Principles', color: '#4ECDC4' },
    { name: 'Mind', color: '#45B7D1' },
    { name: 'Heart', color: '#96CEB4' },
    { name: 'Body', color: '#FFEEAD' },
    { name: 'Spirit', color: '#D4A5A5' },
  ]

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      
      {/* BREADCRUMB */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard" style={{ color: '#10b981', textDecoration: 'none', fontSize: '18px' }}>
          ← Back to Dashboard
        </Link>
        <span style={{ color: '#aaa' }}>/ Leadership Lab</span>
      </div>

      <h1 className="text-6xl font-black text-center mb-6 text-emerald-400">Super-Cube® Leadership Lab</h1>
      <p className="text-center text-xl text-gray-400 mb-12 max-w-3xl mx-auto">
        Develop all six dimensions of leadership. Proven +28.6% average skill growth.
      </p>

      {/* CUBE — SHIFTED RIGHT 50px + DOWN 100px */}
      <div className="flex justify-center mb-16" style={{ marginLeft: '50px', marginTop: '100px' }}>
        <div style={{ width: '240px', height: '240px', perspective: '1000px' }}>
          <div 
            id="cube" 
            style={{
              width: '100%', 
              height: '100%', 
              position: 'relative', 
              transformStyle: 'preserve-3d',
              transition: 'transform 0.08s linear',
              transform: `rotateX(22deg) rotateY(${rotation}deg)`
            }}
          >
            {faces.map((face, i) => (
              <div
                key={face.name}
                onClick={() => setSelectedFace(face.name)}
                style={{
                  position: 'absolute',
                  width: '240px',
                  height: '240px',
                  border: '6px solid #111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: '900',
                  color: '#fff',
                  cursor: 'pointer',
                  background: face.color,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                  transform: i === 0 ? 'rotateY(0deg) translateZ(120px)' :
                             i === 1 ? 'rotateY(180deg) translateZ(120px)' :
                             i === 2 ? 'rotateY(90deg) translateZ(120px)' :
                             i === 3 ? 'rotateY(-90deg) translateZ(120px)' :
                             i === 4 ? 'rotateX(90deg) translateZ(120px)' :
                             'rotateX(-90deg) translateZ(120px)'
                }}
              >
                {face.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-8">
        <Link 
          href="/dashboard/leadership-lab/assessment" 
          className="bg-emerald-500 hover:bg-emerald-600 text-black px-14 py-6 rounded-2xl text-2xl font-bold transition"
        >
          Take Quick Assessment
        </Link>
      </div>

      {selectedFace && (
        <div className="mt-12 p-10 bg-zinc-900 rounded-3xl max-w-2xl mx-auto text-center">
          <h3 className="text-4xl font-bold mb-6">You clicked: {selectedFace}</h3>
          <p className="text-xl">Full interactive module for {selectedFace} coming in the next update.</p>
        </div>
      )}
    </div>
  )
}