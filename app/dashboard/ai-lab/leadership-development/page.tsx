'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeadershipDevelopment() {
  const [step, setStep] = useState<'intro' | 'assessment' | 'results'>('intro');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const dimensions = [
    { key: 'choices', name: 'Choices', color: '#e74c3c', description: 'Decision-making intelligence, moral values, judgement, risk-taking' },
    { key: 'principles', name: 'Principles', color: '#8e44ad', description: 'Ethical foundations, contextual awareness, situational judgement, governance' },
    { key: 'mental', name: 'Mental', color: '#f39c12', description: 'Cognitive intelligence, strategic thinking, problem-solving, vision' },
    { key: 'emotional', name: 'Emotional', color: '#27ae60', description: 'Emotional intelligence, empathy, social relationships, motivation' },
    { key: 'physical', name: 'Physical', color: '#3498db', description: 'Physical health, energy management, fitness, nutrition, resilience' },
    { key: 'spiritual', name: 'Spiritual', color: '#2c3e50', description: 'Purpose, meaning, faith, transcendence, spiritual intelligence' },
  ];

  const questions: Record<string, string[]> = {
    choices: [
      "I make decisions based on clear personal values and long-term impact.",
      "I am comfortable taking calculated risks when the reward aligns with my principles.",
      "I consistently choose integrity over convenience, even when no one is watching.",
      "I evaluate the ethical implications of my choices before acting.",
      "I take full ownership of the consequences of my decisions."
    ],
    principles: [
      "I live by a consistent set of ethical principles in all situations.",
      "I adapt my principles thoughtfully to different cultural and contextual realities.",
      "I can clearly articulate my core leadership principles to others.",
      "My principles guide me even when they conflict with short-term gains.",
      "I hold myself and others accountable to shared ethical standards."
    ],
    mental: [
      "I think strategically and see the bigger picture in complex situations.",
      "I solve problems creatively and find innovative solutions.",
      "I learn quickly and continuously update my knowledge and skills.",
      "I analyse situations objectively before forming conclusions.",
      "I create clear visions and communicate them effectively."
    ],
    emotional: [
      "I understand and manage my own emotions effectively.",
      "I show genuine empathy and emotional intelligence with others.",
      "I build strong, trusting relationships with my team.",
      "I remain calm and constructive under pressure.",
      "I inspire and motivate others through emotional connection."
    ],
    physical: [
      "I maintain high levels of energy and physical wellbeing.",
      "I manage my time and energy to avoid burnout.",
      "I prioritise sleep, nutrition, and regular exercise.",
      "I recover quickly from setbacks and stress.",
      "I model healthy work-life balance for my team."
    ],
    spiritual: [
      "I have a clear sense of purpose and meaning in my leadership.",
      "I connect my work to something greater than myself.",
      "I practise mindfulness or reflection regularly.",
      "I lead with authenticity and inner alignment.",
      "I help others discover their own sense of purpose."
    ]
  };

  const [scores, setScores] = useState<Record<string, number[]>>({
    choices: [7, 8, 6, 9, 7],
    principles: [8, 7, 9, 8, 6],
    mental: [9, 8, 7, 9, 8],
    emotional: [6, 7, 5, 8, 6],
    physical: [8, 9, 7, 8, 9],
    spiritual: [7, 6, 8, 7, 8],
  });

  const calculateDimensionScore = (key: string) => {
    const qScores = scores[key] || [];
    return qScores.length ? Math.round(qScores.reduce((a, b) => a + b, 0) / qScores.length) : 0;
  };

  const totalScore = Object.keys(scores).reduce((sum, key) => sum + calculateDimensionScore(key), 0);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateQuestionScore = (dimension: string, index: number, value: number) => {
    setScores(prev => {
      const newScores = [...(prev[dimension] || [])];
      newScores[index] = value;
      return { ...prev, [dimension]: newScores };
    });
  };

  const getRecommendations = () => {
    const sorted = Object.keys(scores)
      .map(key => ({ key, score: calculateDimensionScore(key) }))
      .sort((a, b) => a.score - b.score);
    return sorted.slice(0, 3);
  };

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <img src="/images/supercube-logo-for-home-page.png" alt="Super-Cube®" className="h-16 mb-4" />
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Leadership Development</h1>
          <p className="text-xl text-neutral-600">Super-Cube® Self-Assessment • Your Doctoral Leadership Model</p>
        </div>
      </div>

      {step === 'intro' && (
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-12 text-center max-w-4xl mx-auto">
          <div className="mx-auto w-32 h-32 mb-8">
            <img src="/images/supercube-logo-for-home-page.png" alt="Super-Cube®" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-5xl font-black mb-6">Super-Cube® Self-Assessment</h2>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Rate yourself across the six dimensions of the Super-Cube® Leadership Model.
          </p>
          <button
            onClick={() => setStep('assessment')}
            className="btn-primary mt-12 px-16 py-6 text-xl flex items-center gap-4 mx-auto"
          >
            Start Assessment <ChevronRight size={28} />
          </button>
        </div>
      )}

      {step === 'assessment' && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-10 text-center">Super-Cube® Self-Assessment</h2>

          {dimensions.map((dim) => {
            const isOpen = openSections[dim.key] || false;
            const avg = calculateDimensionScore(dim.key);

            return (
              <div key={dim.key} className="mb-6 bg-white rounded-3xl border border-neutral-100 overflow-hidden">
                <button
                  onClick={() => toggleSection(dim.key)}
                  className="w-full px-8 py-6 flex items-center justify-between hover:bg-neutral-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-4xl" style={{ backgroundColor: dim.color + '20', color: dim.color }}>
                      ⬡
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{dim.name}</div>
                      <div className="text-sm text-neutral-500">{dim.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-4xl font-black" style={{ color: dim.color }}>{avg}</div>
                      <div className="text-xs text-neutral-400">average</div>
                    </div>
                    {isOpen ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-8 pb-8 pt-2 space-y-8">
                    {questions[dim.key].map((q, i) => (
                      <div key={i} className="flex items-center gap-6">
                        <div className="flex-1 text-neutral-700">{q}</div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={scores[dim.key][i] || 5}
                          onChange={(e) => updateQuestionScore(dim.key, i, Number(e.target.value))}
                          className="w-48 accent-[#00b4d8]"
                        />
                        <div className="w-8 text-right font-bold" style={{ color: dim.color }}>
                          {scores[dim.key][i] || 5}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-center gap-6 mt-12">
            <button onClick={() => setStep('intro')} className="border px-12 py-5 rounded-3xl text-lg">Back</button>
            <button onClick={() => setStep('results')} className="btn-primary px-16 py-5 text-lg">View My Results &amp; Spider Diagram</button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Your Super-Cube® Profile</h2>
          <p className="text-center text-5xl font-black text-[#00b4d8] mb-12">Total Score: {Object.keys(scores).reduce((sum, key) => sum + calculateDimensionScore(key), 0)}/60</p>

          {/* Spider Diagram */}
          <div className="bg-white rounded-3xl p-12 flex justify-center mb-12">
            <svg width="600" height="600" viewBox="0 0 600 600" className="max-w-[500px]">
              {/* Background polygon */}
              <polygon points="300,100 500,200 500,400 300,500 100,400 100,200" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="40" />
              {/* Axes */}
              {dimensions.map((dim, i) => {
                const angle = (i * 60) * Math.PI / 180;
                const x = 300 + 200 * Math.cos(angle);
                const y = 300 + 200 * Math.sin(angle);
                return <line key={i} x1="300" y1="300" x2={x} y2={y} stroke="#cbd5e1" strokeWidth="2" />;
              })}
              {/* Radar shape */}
              <polygon
                points={dimensions.map((dim, i) => {
                  const angle = (i * 60) * Math.PI / 180;
                  const score = calculateDimensionScore(dim.key) / 10;
                  const x = 300 + 180 * score * Math.cos(angle);
                  const y = 300 + 180 * score * Math.sin(angle);
                  return `${x},${y}`;
                }).join(' ')}
                fill="#00b4d8"
                fillOpacity="0.2"
                stroke="#00b4d8"
                strokeWidth="8"
                strokeLinejoin="round"
              />
              {/* Labels */}
              {dimensions.map((dim, i) => {
                const angle = (i * 60) * Math.PI / 180;
                const x = 300 + 240 * Math.cos(angle);
                const y = 300 + 240 * Math.sin(angle);
                return (
                  <text key={i} x={x} y={y} textAnchor="middle" fill={dim.color} fontSize="18" fontWeight="700">
                    {dim.name}
                  </text>
                );
              })}
            </svg>
          </div>

          <h3 className="text-3xl font-bold text-center mb-8">Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {getRecommendations().map((rec) => (
              <div key={rec.key} className="bg-white rounded-3xl p-8 text-center">
                <div className="text-6xl mb-4" style={{ color: dimensions.find(d => d.key === rec.key)?.color }}>
                  ⬡
                </div>
                <h4 className="font-semibold text-xl mb-2">{dimensions.find(d => d.key === rec.key)?.name}</h4>
                <p className="text-neutral-600">Your lowest score. Focus here for the biggest leadership growth.</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-6 mt-16">
            <button onClick={() => setStep('assessment')} className="border px-12 py-5 rounded-3xl text-lg">Retake Assessment</button>
            <button onClick={() => setStep('intro')} className="btn-primary px-16 py-5 text-lg">Start New Journey</button>
          </div>
        </div>
      )}
    </div>
  );
}