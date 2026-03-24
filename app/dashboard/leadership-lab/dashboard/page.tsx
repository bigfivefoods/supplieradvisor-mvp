'use client'

import Link from 'next/link'
import { Radar } from 'react-chartjs-2'
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function ProgressDashboard() {
  // Mock completed modules (you can later connect to real state)
  const completedModules = ['Choices', 'Principles']
  const overallScore = 4.2

  const chartData = {
    labels: ['Choices', 'Principles', 'Mind', 'Heart', 'Body', 'Spirit'],
    datasets: [{
      label: 'Your Score',
      data: [4.8, 4.6, 4.2, 3.9, 4.1, 4.4],
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: '#10b981',
      borderWidth: 4,
      pointBackgroundColor: '#10b981'
    }]
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center gap-4 text-emerald-400">
        <Link href="/dashboard" className="hover:text-white">← Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/leadership-lab" className="hover:text-white">Leadership Lab</Link>
        <span>/ Progress</span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="text-7xl font-black tracking-tighter mb-4">Your Super-Cube® Progress</h1>
        <p className="text-3xl text-emerald-400">Overall Score: <span className="text-white font-bold">{overallScore}</span>/5</p>

        <div className="mt-16 bg-zinc-950 border border-emerald-500/30 rounded-3xl p-12">
          <Radar data={chartData} options={{ scales: { r: { min: 0, max: 5 } }, plugins: { legend: { display: false } } }} />
        </div>

        <div className="mt-16 grid grid-cols-2 gap-8">
          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-8">Completed Modules</h3>
            <div className="space-y-4">
              {completedModules.map(m => (
                <div key={m} className="flex items-center gap-4 bg-emerald-500/10 text-emerald-400 px-8 py-6 rounded-2xl text-2xl">✅ {m}</div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-8">Next Recommended</h3>
            <div className="bg-zinc-900 rounded-2xl p-8 text-2xl">Mind → Start here next</div>
          </div>
        </div>
      </div>
    </div>
  )
}