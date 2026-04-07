'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ChevronRight, ChevronDown } from 'lucide-react';
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

      {/* ==================== INTRO STEP ==================== */}
      {step === 'intro' && (
        <div>
          {/* Logo + Title */}
          <div className="flex flex-col items-center text-center mb-16">
            <img 
              src="/images/supercube-logo-for-home-page.png" 
              alt="Super-Cube®" 
              className="h-24 mb-8" 
            />
            <h1 className="text-7xl font-black tracking-[-4px] text-[#00b4d8] leading-none mb-6">
              Super-Cube®
            </h1>
            <p className="text-3xl font-medium text-neutral-700 max-w-2xl">
              The multidimensional leadership development model that places <span className="text-[#00b4d8]">YOU</span> at the centre
            </p>
          </div>

          {/* WHAT IS IT */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-neutral-100 p-12 mb-12">
            <h2 className="text-4xl font-bold mb-6">What is Super-Cube®?</h2>
            <p className="text-xl text-neutral-600 leading-relaxed">
              Developed in 2020 as part of my Doctorate of Business Administration thesis at the University of KwaZulu-Natal, 
              the Super-Cube® Leadership Model is a human-centric, multidimensional framework for leadership development.
            </p>
            <p className="text-xl text-neutral-600 leading-relaxed mt-6">
              It visualises leadership as a three-dimensional cube with six interconnected faces surrounding the individual ("You") at the centre. 
              The six dimensions — Choices, Principles, Mental, Emotional, Physical and Spiritual — work together to build authentic, effective leadership capacity.
            </p>
          </div>

          {/* WHY IT MATTERS */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-neutral-100 p-12 mb-12">
            <h2 className="text-4xl font-bold mb-6">Why Super-Cube® exists</h2>
            <p className="text-xl text-neutral-600 leading-relaxed">
              Africa faces unique leadership challenges: rapid population growth, skills shortages, institutional complexity and the need for ethical, sustainable growth. 
              Super-Cube® was created to address these realities by providing a practical, empirically validated model that helps leaders develop themselves so they can better serve their organisations, communities and ultimately progress humanity.
            </p>
            <p className="text-xl text-neutral-600 leading-relaxed mt-6 font-medium">
              Leadership is approximately 70–76% developable. Super-Cube® gives you the structured path to unlock that potential.
            </p>
          </div>

          {/* HOW IT WORKS */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-neutral-100 p-12 mb-16">
            <h2 className="text-4xl font-bold mb-6">How Super-Cube® works</h2>
            <p className="text-xl text-neutral-600 leading-relaxed">
              At the centre of the cube is <strong>YOU</strong>. The six dimensions radiate outward, forming a balanced, interconnected system. 
              Development follows Illeris’s three-dimensional learning theory (content, incentive and interaction) and progresses through five levels — from personal growth to industry-wide impact.
            </p>
          </div>

          {/* THE 6 DIMENSIONS */}
          <h2 className="text-4xl font-bold text-center mb-12">The Six Dimensions of Super-Cube® Leadership</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {dimensions.map((dim) => (
              <div key={dim.key} className="bg-white rounded-3xl p-8 border border-neutral-100 hover:shadow-xl transition-all">
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-5xl mb-6" style={{ backgroundColor: dim.color + '15', color: dim.color }}>
                  ⬡
                </div>
                <h3 className="text-3xl font-bold mb-3" style={{ color: dim.color }}>{dim.name}</h3>
                <p className="text-neutral-600 leading-relaxed">{dim.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <button
              onClick={() => setStep('assessment')}
              className="btn-primary px-16 py-7 text-2xl flex items-center gap-4 mx-auto"
            >
              Begin Your Super-Cube® Self-Assessment
              <ChevronRight size={32} />
            </button>
            <p className="text-neutral-500 mt-6">Takes 10–15 minutes • Immediate results + personalised recommendations</p>
          </div>
        </div>
      )}

      {/* ==================== ASSESSMENT STEP ==================== */}
      {step === 'assessment' && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-10 text-center">Super-Cube® Self-Assessment</h2>
          <p className="text-center text-neutral-600 mb-12">Rate yourself 1–10 on each construct (10 = world-class)</p>

          <div className="space-y-10">
            {dimensions.map((dim) => {
              const isOpen = openSections[dim.key] || false;
              const avg = scores[dim.key] ? Math.round(scores[dim.key].reduce((a, b) => a + b, 0) / scores[dim.key].length) : 0;

              return (
                <div key={dim.key} className="bg-white rounded-3xl border border-neutral-100 overflow-hidden">
                  <button
                    onClick={() => setOpenSections(prev => ({ ...prev, [dim.key]: !prev[dim.key] }))}
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
                            onChange={(e) => {
                              const newScores = [...scores[dim.key]];
                              newScores[i] = Number(e.target.value);
                              setScores(prev => ({ ...prev, [dim.key]: newScores }));
                            }}
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
          </div>

          <div className="flex justify-center gap-6 mt-12">
            <button onClick={() => setStep('intro')} className="border px-12 py-5 rounded-3xl text-lg">Back</button>
            <button onClick={() => setStep('results')} className="btn-primary px-16 py-5 text-lg">View My Results &amp; Spider Diagram</button>
          </div>
        </div>
      )}

      {/* ==================== RESULTS STEP ==================== */}
      {step === 'results' && (
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Your Super-Cube® Profile</h2>
          <p className="text-center text-5xl font-black text-[#00b4d8] mb-12">Total Score: {Object.keys(scores).reduce((sum, key) => sum + calculateDimensionScore(key), 0)}/60</p>

          {/* Spider Diagram */}
          <div className="bg-white rounded-3xl p-12 flex justify-center mb-12">
            <svg width="600" height="600" viewBox="0 0 600 600" className="max-w-[500px]">
              <polygon points="300,100 500,200 500,400 300,500 100,400 100,200" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="40" />
              {dimensions.map((dim, i) => {
                const angle = (i * 60) * Math.PI / 180;
                const x = 300 + 200 * Math.cos(angle);
                const y = 300 + 200 * Math.sin(angle);
                return <line key={i} x1="300" y1="300" x2={x} y2={y} stroke="#cbd5e1" strokeWidth="2" />;
              })}
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