'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function HeartModule() {
  const [completed, setCompleted] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center gap-4 text-emerald-400">
        <Link href="/dashboard" className="hover:text-white">← Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/leadership-lab" className="hover:text-white">Leadership Lab</Link>
        <span>/ Heart</span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-5xl">💚</div>
          <div>
            <h1 className="text-7xl font-black tracking-tighter text-emerald-500">Heart</h1>
            <p className="text-3xl text-zinc-400">The empathy engine of leadership</p>
          </div>
        </div>

        <div className="bg-zinc-950 border-l-8 border-emerald-500 pl-12 py-12 rounded-3xl mb-16">
          <p className="text-4xl italic leading-tight">"People don’t follow titles. They follow hearts."</p>
          <p className="mt-6 text-emerald-400 text-xl">— Dr. Craig Muller</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-emerald-400">Theory</h3>
            <p className="text-xl leading-relaxed text-zinc-300">Heart is the ability to show genuine empathy, build trust, and inspire through compassion.</p>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-emerald-400">Self-Reflection</h3>
            <ul className="space-y-6 text-lg text-zinc-300">
              <li>• Do I truly listen when others speak?</li>
              <li>• Can I celebrate others’ success as my own?</li>
              <li>• Do people feel safe sharing with me?</li>
            </ul>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-emerald-400">Practical Exercise</h3>
            <p className="text-xl text-zinc-300">Have a 1-on-1 conversation this week where you only ask questions and listen for 80% of the time.</p>
          </div>
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-emerald-400">This Week’s Challenge</h3>
            <p className="text-xl text-zinc-300">Perform one random act of kindness for a team member and note their reaction.</p>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <button onClick={() => setCompleted(!completed)} className={`px-20 py-8 text-3xl font-bold rounded-3xl transition-all ${completed ? 'bg-emerald-500 text-black' : 'bg-zinc-900 hover:bg-emerald-500 text-white'}`}>
            {completed ? '✅ Module Completed' : 'Mark Heart as Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}