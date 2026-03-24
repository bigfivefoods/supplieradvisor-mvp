'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ChoicesModule() {
  const [completed, setCompleted] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center gap-4 text-emerald-400">
        <Link href="/dashboard" className="hover:text-white">← Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/leadership-lab" className="hover:text-white">Leadership Lab</Link>
        <span>/ Choices</span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-red-500 flex items-center justify-center text-5xl">🔴</div>
          <div>
            <h1 className="text-7xl font-black tracking-tighter text-red-500">Choices</h1>
            <p className="text-3xl text-zinc-400">The foundation of leadership</p>
          </div>
        </div>

        {/* Big Quote */}
        <div className="bg-zinc-950 border-l-8 border-red-500 pl-12 py-12 rounded-3xl mb-16">
          <p className="text-4xl italic leading-tight">"Every leader is defined by the quality of their choices, not the volume of their words."</p>
          <p className="mt-6 text-red-400 text-xl">— Dr. Craig Muller</p>
        </div>

        {/* Content Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Theory */}
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-red-400">Theory</h3>
            <p className="text-xl leading-relaxed text-zinc-300">
              Choices is the ability to systematically break down complex problems, evaluate long-term consequences, and take full responsibility for outcomes. 
              Leaders who master Choices see +28.6% higher team performance.
            </p>
          </div>

          {/* Self-Reflection */}
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-red-400">Self-Reflection</h3>
            <ul className="space-y-6 text-lg text-zinc-300">
              <li>• When was the last time you made a difficult ethical choice?</li>
              <li>• Do you consistently evaluate long-term impact?</li>
              <li>• How often do you take full ownership of poor decisions?</li>
            </ul>
          </div>

          {/* Practical Exercise */}
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-red-400">Practical Exercise</h3>
            <p className="text-xl text-zinc-300">
              Take one decision you face this week. Write down 3 options, evaluate consequences for people, planet, and profit, then choose.
            </p>
          </div>

          {/* Weekly Challenge */}
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-6 text-red-400">This Week’s Challenge</h3>
            <p className="text-xl text-zinc-300">
              Make one “courageous choice” every day (something you’ve been avoiding) and journal the outcome.
            </p>
          </div>
        </div>

        {/* Mark Complete Button */}
        <div className="mt-16 flex justify-center">
          <button
            onClick={() => setCompleted(!completed)}
            className={`px-20 py-8 text-3xl font-bold rounded-3xl transition-all ${
              completed 
                ? 'bg-emerald-500 text-black' 
                : 'bg-zinc-900 hover:bg-red-500 text-white'
            }`}
          >
            {completed ? '✅ Module Completed' : 'Mark Choices as Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}