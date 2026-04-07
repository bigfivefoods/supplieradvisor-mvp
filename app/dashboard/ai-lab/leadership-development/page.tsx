'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Brain, Target, BookOpen, Award, ChevronRight, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LeadershipDevelopment() {
  const [step, setStep] = useState<'intro' | 'assessment' | 'results' | 'training' | 'recommendations'>('intro');
  const [scores, setScores] = useState({
    choices: 0,
    principles: 0,
    mental: 0,
    emotional: 0,
    physical: 0,
    spiritual: 0,
  });

  const constructs = [
    { key: 'choices', name: 'Choices', description: 'Decision-making intelligence, moral values, judgement, risk-taking', color: '#00b4d8' },
    { key: 'principles', name: 'Principles', description: 'Ethical foundations, contextual awareness, situational judgement, governance', color: '#00b4d8' },
    { key: 'mental', name: 'Mental', description: 'Cognitive intelligence, strategic thinking, problem-solving, vision', color: '#00b4d8' },
    { key: 'emotional', name: 'Emotional', description: 'Emotional intelligence, empathy, social relationships, motivation', color: '#00b4d8' },
    { key: 'physical', name: 'Physical', description: 'Physical health, energy management, fitness, nutrition, resilience', color: '#00b4d8' },
    { key: 'spiritual', name: 'Spiritual', description: 'Purpose, meaning, faith, transcendence, spiritual intelligence', color: '#00b4d8' },
  ];

  const handleAssessmentAnswer = (construct: string, score: number) => {
    setScores(prev => ({ ...prev, [construct]: score }));
  };

  const calculateTotalScore = () => Object.values(scores).reduce((a, b) => a + b, 0);

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Leadership Development</h1>
          <p className="text-xl text-neutral-600">Powered by the Super-Cube® Leadership Model — your doctoral framework</p>
        </div>
      </div>

      {/* Intro Card */}
      {step === 'intro' && (
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-12 text-center max-w-3xl mx-auto">
          <div className="mx-auto w-24 h-24 bg-[#00b4d8]/10 rounded-3xl flex items-center justify-center text-6xl mb-8">🧊</div>
          <h2 className="text-4xl font-bold mb-6">The Super-Cube® Leadership Model</h2>
          <p className="text-lg text-neutral-600 leading-relaxed mb-10">
            A multidimensional, human-centric leadership development framework developed in your 2020 DBA thesis. 
            Six interconnected constructs surround the individual ("You") at the center: 
            <strong>Choices, Principles, Mental, Emotional, Physical, Spiritual</strong>.
          </p>
          <div className="grid grid-cols-3 gap-6 text-left max-w-md mx-auto">
            {constructs.map(c => (
              <div key={c.key} className="text-center">
                <div className="text-3xl mb-2" style={{ color: c.color }}>⬡</div>
                <div className="font-medium">{c.name}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep('assessment')}
            className="btn-primary mt-12 px-16 py-5 text-lg flex items-center gap-3 mx-auto"
          >
            Start Self-Assessment <ChevronRight />
          </button>
        </div>
      )}

      {/* Assessment Step */}
      {step === 'assessment' && (
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Super-Cube® Self-Assessment</h2>
          <p className="text-center text-neutral-600 mb-10">Rate yourself 1–10 on each construct (10 = world-class)</p>

          <div className="space-y-10">
            {constructs.map((construct) => (
              <div key={construct.key} className="bg-white rounded-3xl p-8">
                <div className="flex justify-between items-baseline mb-4">
                  <div>
                    <div className="text-xl font-semibold">{construct.name}</div>
                    <div className="text-neutral-500 text-sm">{construct.description}</div>
                  </div>
                  <div className="text-4xl font-black text-[#00b4d8]">{scores[construct.key as keyof typeof scores]}</div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scores[construct.key as keyof typeof scores]}
                  onChange={(e) => handleAssessmentAnswer(construct.key, Number(e.target.value))}
                  className="w-full accent-[#00b4d8]"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-6 mt-12">
            <button onClick={() => setStep('intro')} className="border px-12 py-5 rounded-3xl text-lg">Back</button>
            <button
              onClick={() => setStep('results')}
              className="btn-primary px-16 py-5 text-lg flex items-center gap-3"
            >
              See My Results <ChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* Results Step */}
      {step === 'results' && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Your Super-Cube® Profile</h2>
          <p className="text-center text-neutral-600 mb-12">Total Leadership Score: <span className="text-5xl font-black text-[#00b4d8]">{calculateTotalScore()}/60</span></p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {constructs.map((c) => {
              const score = scores[c.key as keyof typeof scores];
              return (
                <div key={c.key} className="bg-white rounded-3xl p-8 text-center">
                  <div className="text-6xl mb-4" style={{ color: c.color }}>⬡</div>
                  <div className="font-semibold text-xl mb-1">{c.name}</div>
                  <div className="text-5xl font-black text-[#00b4d8] mb-6">{score}</div>
                  <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00b4d8]" style={{ width: `${(score / 10) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-6 mt-16">
            <button onClick={() => setStep('assessment')} className="border px-12 py-5 rounded-3xl text-lg">Retake Assessment</button>
            <button onClick={() => setStep('training')} className="btn-primary px-16 py-5 text-lg">View Training Modules</button>
          </div>
        </div>
      )}

      {/* Training Modules Step */}
      {step === 'training' && (
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center">Super-Cube® Training Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {constructs.map((c) => (
              <div key={c.key} className="bg-white rounded-3xl p-8 hover:shadow-xl transition-all">
                <div className="text-6xl mb-6" style={{ color: c.color }}>⬡</div>
                <h3 className="text-2xl font-bold mb-3">{c.name}</h3>
                <p className="text-neutral-600 mb-8">{c.description}</p>
                <button className="btn-primary w-full py-4">Start Training Module</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Step */}
      {step === 'recommendations' && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold mb-8">Personalised Recommendations</h2>
          <p className="text-xl text-neutral-600 mb-12">Based on your Super-Cube® assessment, here are your top development priorities:</p>
          <div className="space-y-8 text-left">
            <div className="border-l-4 border-[#00b4d8] pl-6">
              <strong>Focus on Emotional Intelligence</strong> – Your lowest score. Recommended: 8-week empathy &amp; relationship training.
            </div>
            <div className="border-l-4 border-[#00b4d8] pl-6">
              <strong>Strengthen Spiritual Intelligence</strong> – Purpose alignment workshop recommended.
            </div>
          </div>
          <button onClick={() => setStep('intro')} className="btn-primary mt-12 px-16 py-5">Restart Journey</button>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-16">
        <button onClick={() => setStep('intro')} className="border px-8 py-4 rounded-3xl">Back to Start</button>
      </div>
    </div>
  );
}