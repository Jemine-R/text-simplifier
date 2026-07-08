import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { ChevronRight, ChevronLeft, Save, BookOpen } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const steps = [
  {
    id: 'core',
    title: 'Core Complexity',
    metrics: [
      { key: 'readingLevel', label: 'Reading Level', type: 'select', options: ['Grade 5', 'Middle School', 'High School', 'College', 'Post-Graduate', 'Professional Executive'] },
      { key: 'complexityCeiling', label: 'Complexity Ceiling', type: 'select', options: ['basic', 'intermediate', 'advanced'] },
      { key: 'vocabularyTolerance', label: 'Vocabulary Tolerance (1-10)', type: 'range', min: 1, max: 10 },
    ]
  },
  {
    id: 'structure',
    title: 'Style & Structure',
    metrics: [
      { key: 'sentenceLengthPreference', label: 'Sentence Length', type: 'select', options: ['short', 'medium', 'long'] },
      { key: 'preferredStructure', label: 'Sentence Structure', type: 'select', options: ['simple', 'complex', 'balanced'] },
      { key: 'outputStyle', label: 'Output Style', type: 'select', options: ['concise', 'descriptive', 'balanced'] },
    ]
  },
  {
    id: 'specialized',
    title: 'Nuance & Jargon',
    metrics: [
      { key: 'technicalJargonLevel', label: 'Technical Jargon', type: 'select', options: ['none', 'low', 'medium', 'high'] },
      { key: 'tonePreference', label: 'Tone', type: 'select', options: ['formal', 'casual', 'balanced'] },
      { key: 'abstractContentHandling', label: 'Abstraction', type: 'select', options: ['concrete', 'theoretical', 'balanced'] },
    ]
  },
  {
    id: 'adaptation',
    title: 'Adaptation & Layout',
    metrics: [
      { key: 'metaphorUsage', label: 'Metaphor Usage', type: 'select', options: ['avoid', 'allow'] },
      { key: 'explanationDepth', label: 'Explanation Context Depth', type: 'select', options: ['shallow', 'standard', 'thorough'] },
      { key: 'visualLayout', label: 'Visual Presentation Layout', type: 'select', options: ['text-only', 'structured-lists', 'side-by-side'] },
    ]
  }
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 for user setup
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    vocabularyTolerance: 5,
    sentenceLengthPreference: 'medium',
    complexityCeiling: 'intermediate',
    technicalJargonLevel: 'low',
    tonePreference: 'balanced',
    abstractContentHandling: 'balanced',
    metaphorUsage: 'allow',
    preferredStructure: 'balanced',
    readingLevel: 'High School',
    outputStyle: 'balanced',
    explanationDepth: 'standard',
    visualLayout: 'side-by-side',
    loraTrained: 0,
  });

  const handleChange = (key: string, value: any) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleUserSetup = async () => {
    if (!username.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      // Check if user exists
      const res = await fetch(`/api/users/${username}`);
      const user = await res.json();

      if (user) {
        // User exists, fetch profile
        const profRes = await fetch(`/api/profile/${user.id}`);
        const existingProfile = await profRes.json();
        if (existingProfile) {
          onComplete({ ...existingProfile, username: user.username, userId: user.id });
          return;
        }
        setProfile(prev => ({ ...prev, userId: user.id, username: user.username }));
        setCurrentStep(0);
      } else {
        // Create new user
        const createRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const newUser = await createRes.json();
        if (newUser.error) {
          setError(newUser.error);
        } else {
          setProfile(prev => ({ ...prev, userId: newUser.id, username: newUser.username }));
          setCurrentStep(0);
        }
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const next = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save profile
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        onComplete(profile as UserProfile);
      }
    }
  };

  const back = () => {
    if (currentStep > -1) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="max-w-xl mx-auto py-20 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0c0c0e] rounded-2xl shadow-2xl p-10 border border-zinc-800"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookOpen className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
              {currentStep === -1 ? 'Welcome to Granular Text Simplifier' : 'Persona Initialization'}
            </h2>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
              {currentStep === -1 
                ? 'Network Authentication Required' 
                : `Step ${currentStep + 1} of ${steps.length} — ${steps[currentStep].title}`}
            </p>
          </div>
        </div>

        <div className="space-y-8 min-h-[340px]">
          <AnimatePresence mode="wait">
            {currentStep === -1 ? (
              <motion.div
                key="user-setup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6 pt-4"
              >
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest italic">Identity Identifier (Username)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter unique ID..."
                    className="w-full px-4 py-4 rounded-xl border border-zinc-800 focus:border-indigo-500 transition-all outline-none bg-zinc-900/50 text-zinc-100 placeholder:zinc-700 italic text-lg"
                  />
                  {error && <p className="text-red-400 text-[10px] font-bold uppercase">{error}</p>}
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Enter your alias to initialize your LoRA-based simplification pipeline. Existing profiles will be loaded automatically.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                {steps[currentStep].metrics.map((metric) => (
                  <div key={metric.key} className="space-y-3">
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{metric.label}</label>
                    {metric.type === 'select' ? (
                      <select
                        value={profile[metric.key as keyof UserProfile] as string}
                        onChange={(e) => handleChange(metric.key, e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-zinc-800 focus:border-zinc-600 transition-all outline-none bg-zinc-900 text-zinc-200 capitalize text-sm"
                      >
                        {metric.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <input
                          type="range"
                          min={metric.min}
                          max={metric.max}
                          value={profile[metric.key as keyof UserProfile] as number}
                          onChange={(e) => handleChange(metric.key, parseInt(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-zinc-600 px-1 uppercase tracking-tighter">
                          <span>Min</span>
                          <span className="text-indigo-400 font-mono">{profile[metric.key as keyof UserProfile]}</span>
                          <span>Max</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-12 flex justify-between gap-4">
          <button
            onClick={back}
            disabled={currentStep === -1}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${
              currentStep === -1 ? 'text-zinc-800 opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            <ChevronLeft size={14} />
            Back
          </button>
          
          {currentStep === -1 ? (
            <button
              onClick={handleUserSetup}
              disabled={isLoading || !username.trim()}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-500/10 disabled:opacity-20"
            >
              {isLoading ? 'Decrypting...' : 'Initialize Pipeline'}
              {!isLoading && <ChevronRight size={14} />}
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-2 px-8 py-3 bg-zinc-100 text-zinc-900 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all active:scale-95 shadow-xl shadow-white/5"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Save size={14} />
                  Finalize Persona
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
