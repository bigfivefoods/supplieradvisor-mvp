'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { supabase } from '@/lib/supabase'
import { usePrivy } from '@privy-io/react-auth'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const faces = [
  { id: 'Choices', color: '#ef4444', name: 'Choices' },
  { id: 'Principles', color: '#f59e0b', name: 'Principles' },
  { id: 'Mind', color: '#14b8a6', name: 'Mind' },
  { id: 'Heart', color: '#10b981', name: 'Heart' },
  { id: 'Body', color: '#3b82f6', name: 'Body' },
  { id: 'Spirit', color: '#8b5cf6', name: 'Spirit' }
] as const

const questions = [
  { id: 'c1', face: 'Choices', text: 'I systematically break down complex or moral problems before deciding.' },
  { id: 'c2', face: 'Choices', text: 'I apply structured strategies when facing ethical dilemmas.' },
  { id: 'c3', face: 'Choices', text: 'I evaluate long-term consequences of decisions on people and planet.' },
  { id: 'c4', face: 'Choices', text: 'I adapt my decision-making approach when circumstances change.' },
  { id: 'c5', face: 'Choices', text: 'I take full responsibility for the outcomes of my choices.' },
  { id: 'p1', face: 'Principles', text: 'I consistently align my actions with my core personal values.' },
  { id: 'p2', face: 'Principles', text: 'I adhere to a clear personal code of ethics in professional settings.' },
  { id: 'p3', face: 'Principles', text: 'I promote ethical governance in teams and organizations.' },
  { id: 'p4', face: 'Principles', text: 'I challenge unethical behavior when I observe it.' },
  { id: 'p5', face: 'Principles', text: 'My decisions reflect integrity even when no one is watching.' },
  { id: 'm1', face: 'Mind', text: 'I seek out diverse perspectives before forming an opinion.' },
  { id: 'm2', face: 'Mind', text: 'I continuously update my knowledge and skills.' },
  { id: 'm3', face: 'Mind', text: 'I analyse problems using both logic and creativity.' },
  { id: 'm4', face: 'Mind', text: 'I remain calm and focused under pressure.' },
  { id: 'm5', face: 'Mind', text: 'I learn from mistakes and adapt quickly.' },
  { id: 'h1', face: 'Heart', text: 'I show genuine empathy towards others.' },
  { id: 'h2', face: 'Heart', text: 'I build strong, trust-based relationships.' },
  { id: 'h3', face: 'Heart', text: 'I inspire and motivate people around me.' },
  { id: 'h4', face: 'Heart', text: 'I resolve conflicts with compassion and fairness.' },
  { id: 'h5', face: 'Heart', text: 'I celebrate others’ successes as my own.' },
  { id: 'b1', face: 'Body', text: 'I maintain high energy and physical wellbeing.' },
  { id: 'b2', face: 'Body', text: 'I stay resilient when facing setbacks.' },
  { id: 'b3', face: 'Body', text: 'I manage stress effectively.' },
  { id: 'b4', face: 'Body', text: 'I present myself with confidence and poise.' },
  { id: 'b5', face: 'Body', text: 'I balance work demands with personal health.' },
  { id: 's1', face: 'Spirit', text: 'I have a clear sense of purpose in my leadership.' },
  { id: 's2', face: 'Spirit', text: 'I connect deeply with my inner values.' },
  { id: 's3', face: 'Spirit', text: 'I inspire others through my authenticity.' },
  { id: 's4', face: 'Spirit', text: 'I maintain a positive, hopeful outlook.' },
  { id: 's5', face: 'Spirit', text: 'I contribute to something bigger than myself.' }
]

export default function Assessment() {
  const { user } = usePrivy()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, string> | null>(null)
  const [saved, setSaved] = useState(false)

  const toggleCard = (faceId: string) => {
    setExpanded(prev => ({ ...prev, [faceId]: !prev[faceId] }))
  }

  const handleAnswer = (qId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const calculateAndSave = async () => {
    const faceScores: Record<string, number> = {}
    questions.forEach(q => {
      const score = answers[q.id] || 0
      faceScores[q.face] = (faceScores[q.face] || 0) + score
    })

    const finalScores = Object.keys(faceScores).reduce((acc, face) => {
      acc[face] = (faceScores[face] / 5).toFixed(1)
      return acc
    }, {} as Record<string, string>)

    setResults(finalScores)

    if (user?.id) {
      await supabase.from('profiles').update({ leadership_progress: finalScores }).eq('user_id', user.id)
      setSaved(true)
    }
  }

  const answeredCount = Object.keys(answers).length
  const progressPercent = Math.round((answeredCount / 30) * 100)

  const chartData = results ? {
    labels: Object.keys(results),
    datasets: [{
      label: 'Your Score',
      data: Object.values(results).map(v => parseFloat(v)),
      backgroundColor: 'rgba(0, 180, 216, 0.15)',
      borderColor: '#00b4d8',
      borderWidth: 3,
      pointBackgroundColor: '#00b4d8'
    }]
  } : null

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center gap-4 text-[#00b4d8]">
        <Link href="/dashboard" className="hover:text-[#0f172a]">← Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/leadership-lab" className="hover:text-[#0f172a]">Leadership Lab</Link>
        <span>/ Assessment</span>
      </div>

      <div className="max-w-7xl ml-[345px] pl-6 pr-8">
        <h1 className="text-7xl font-black tracking-tighter mb-2 text-[#0f172a]">Super-Cube® Baseline Assessment</h1>
        <div className="text-3xl text-[#00b4d8] mb-12">
          Assessment Complete: <span className="font-bold text-[#0f172a]">{progressPercent}%</span>
        </div>

        {/* MINIMAL EXPANDABLE HEADINGS — NAME ONLY */}
        <div className="space-y-8">
          {faces.map(face => {
            const faceQuestions = questions.filter(q => q.face === face.id)
            const isExpanded = expanded[face.id] || false

            return (
              <div key={face.id}>
                <button
                  onClick={() => toggleCard(face.id)}
                  className="w-full text-left py-6 hover:bg-transparent transition-none"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-5xl font-black tracking-tighter" style={{ color: face.color }}>
                      {face.name}
                    </h3>
                    <span className={`text-4xl transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: face.color }}>
                      ▼
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="pl-8 pb-8">
                    {faceQuestions.map((q, idx) => (
                      <div key={q.id} className="mb-10">
                        <p className="text-lg mb-5 text-slate-700">
                          {idx + 1}. {q.text}
                        </p>
                        <div className="grid grid-cols-5 gap-3">
                          {[1,2,3,4,5].map(num => {
                            const isSelected = answers[q.id] === num
                            return (
                              <button
                                key={num}
                                onClick={() => handleAnswer(q.id, num)}
                                className={`h-14 rounded-2xl font-bold text-2xl transition-all border-2 flex items-center justify-center hover:scale-110 ${isSelected ? 'shadow-xl' : ''}`}
                                style={{
                                  backgroundColor: isSelected ? face.color : 'transparent',
                                  color: isSelected ? '#fff' : '#64748b',
                                  borderColor: isSelected ? face.color : '#e2e8f0'
                                }}
                              >
                                {num}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-20 flex justify-center">
          <button
            onClick={calculateAndSave}
            disabled={answeredCount < 30}
            className="px-24 py-8 bg-[#00b4d8] hover:bg-[#00a0c0] disabled:bg-slate-300 text-white text-3xl font-bold rounded-3xl transition-all disabled:cursor-not-allowed"
          >
            {saved ? '✅ Scores Saved to Your Profile!' : 'Calculate & Save My Super-Cube® Scores'}
          </button>
        </div>

        {results && (
          <div className="mt-20 bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
            <h2 className="text-6xl font-black mb-12 text-slate-900">Your Super-Cube® Profile</h2>
            <div className="max-w-3xl mx-auto">
              <Radar data={chartData} options={{ scales: { r: { min: 0, max: 5 } }, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}