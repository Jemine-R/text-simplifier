/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, Transformation } from './types';
import { API_URL } from './config';
import Onboarding from './components/Onboarding';
import Simplifier from './components/Simplifier';
import Dashboard from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Activity, FileText, Settings, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<'processor' | 'dashboard'>('processor');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const savedUserId = localStorage.getItem('simplai_user_id');
    if (!savedUserId) {
      setIsInitializing(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/profile/${savedUserId}`);
      const data = await res.json();
      if (data && data.updatedAt) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleProfileComplete = async (newProfile: UserProfile) => {
    try {
      await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      if (newProfile.userId) {
        localStorage.setItem('simplai_user_id', newProfile.userId);
      }
      setProfile(newProfile);
    } catch (err) {
      console.error("Failed to save profile", err);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('simplai_user_id');
    setProfile(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Activity size={40} className="text-zinc-100" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-400 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navigation */}
      <nav className="h-16 border-b border-zinc-800 bg-[#09090b] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BookOpen className="text-white" size={16} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">
              Granular Text Simplifier <span className="text-zinc-500 font-normal hidden sm:inline">// Processor v2.4</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden lg:flex gap-6 text-[10px] font-bold uppercase tracking-widest">
              <button 
                onClick={() => setCurrentView('processor')}
                className={`flex items-center gap-2 transition-colors ${currentView === 'processor' ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <FileText size={14} />
                Pipeline
              </button>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={`flex items-center gap-2 transition-colors ${currentView === 'dashboard' ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutDashboard size={14} />
                Analytics
              </button>
            </div>
            <div className="h-8 w-[1px] bg-zinc-800 hidden md:block"></div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleReset}
                className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                Reset Persona
              </button>
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-100">
                JD
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!profile ? (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Onboarding onComplete={handleProfileComplete} />
            </motion.div>
          ) : currentView === 'processor' ? (
            <motion.div
              key="simplifier"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Simplifier 
                profile={profile} 
                onUpdateProfile={() => setProfile(null)} 
                onUpdateProfileState={(newProfile) => setProfile(newProfile)} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Dashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-[#09090b] border-t border-zinc-800 flex items-center px-8 justify-between text-[10px] text-zinc-600 uppercase tracking-widest mt-auto">
        <div className="flex gap-4">
          <span>SYSTEM STATUS: <span className="text-emerald-500 font-bold">OPTIMAL</span></span>
          <span className="hidden sm:inline">LATENCY: 42ms</span>
        </div>
        <div className="flex gap-4">
          <span>PROFILE_ID: USR_77X_ALPHA</span>
          <span className="hidden sm:inline">SQLITE_SYNC: COMPLETED</span>
        </div>
      </footer>
    </div>
  );
}

