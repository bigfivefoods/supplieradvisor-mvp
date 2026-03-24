'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function MindModule() {
  const [completed, setCompleted] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center gap-4 text-emerald-400">
        <Link href="/dashboard" className="hover:text-white">← Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/leadership-lab" className="hover:text-white">Leadership Lab</Link>
        <span>/ Mind</span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-teal-500 flex items-center justify-center text-5xl">🟢</div>
          <div>
            <h1 className="text-7xl font-black tracking-tighter text-teal-500">Mind</h1>
            <p className="text-3xl text-zinc-400">The thinking engine of leadership</p>
          </div>
        </div>

        <div className="bg-zinc-950 border-l-8 border-teal-500 pl-12 py-12 rounded-3xl mb-16">
          <p className="text-4xl italic leading-tight">"A sharp mind is the leader’s greatest weapon."</p>
          <p className="mt-6 text-teal-400 text-xl">— Dr. Craig Muller</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-teal-400">Theory</h3>
            <p className="text-xl leading-relaxed text-zinc-300">Mind is the ability to seek diverse perspectives, continuously learn, and remain calm under pressure.</p>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-teal-400">Self-Reflection</h3>
            <ul className="space-y-6 text-lg text-zinc-300">
              <li>• Do I actively seek opposing viewpoints?</li>
              <li>• How often do I update my knowledge?</li>
              <li>• Can I stay focused when under stress?</li>
            </ul>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-teal-400">Practical Exercise</h3>
            <p className="text-xl text-zinc-300">Read one article from a source you normally disagree with and summarise its strongest point.</p>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-teal-400">This Week’s Challenge</h3>
            <p className="text-xl text-zinc-300">Learn one new skill or concept every day and teach it to someone else.</p>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <button onClick={() => setCompleted(!completed)} className={`px-20 py-8 text-3xl font-bold rounded-3xl transition-all ${completed ? 'bg-emerald-500 text-black' : 'bg-zinc-900 hover:bg-teal-500 text-white'}`}>
            {completed ? '✅ Module Completed' : 'Mark Mind as Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}