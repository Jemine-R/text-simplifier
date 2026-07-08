import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FeedbackAnalysis } from '../types';
import { BarChart3, TrendingUp, Users, PieChart, Activity } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<FeedbackAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/feedback-analysis')
      .then(res => res.json())
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <Activity className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">System Performance <span className="text-zinc-500 font-normal text-sm ml-2">// LoRA Analytics</span></h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-3 text-zinc-500 mb-2">
            <Users size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Samples</span>
          </div>
          <p className="text-4xl font-black text-zinc-100">{data?.totalEntries}</p>
        </div>

        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-3 text-indigo-400 mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Clarity Accuracy</span>
          </div>
          <p className="text-4xl font-black text-indigo-400">{(data?.averageClarity || 0).toFixed(1)}<span className="text-sm font-normal text-zinc-600 ml-1">/ 5.0</span></p>
        </div>

        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-3 text-purple-400 mb-2">
            <PieChart size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">User Sentiment</span>
          </div>
          <p className="text-4xl font-black text-purple-400">Stable</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#0c0c0e] border border-zinc-800 p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-zinc-400" size={20} />
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Feedback Categories</h3>
          </div>
          
          <div className="space-y-4">
            {data?.categories.map((cat, i) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                  <span className="text-zinc-400">{cat.name}</span>
                  <span className="text-zinc-100">{cat.count} hits</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.count / (data.totalEntries || 1)) * 100}%` }}
                    className={`h-full ${i % 2 === 0 ? 'bg-indigo-500' : 'bg-purple-500'}`}
                  />
                </div>
              </div>
            ))}
            {data?.categories.length === 0 && <p className="text-zinc-600 text-xs italic">Awaiting more telemetry data...</p>}
          </div>
        </div>

        <div className="bg-indigo-900/10 border border-indigo-500/20 p-8 rounded-3xl flex flex-col justify-center gap-4">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">NLP Diagnostic</h3>
          <p className="text-zinc-300 leading-relaxed italic border-l-2 border-indigo-500/30 pl-6 py-4">
            "The system is currently using Gemini-3-Flash for feedback categorization. Early indicators show high correlation between 'unnatural phrasing' and 'post-graduate' reading level settings."
          </p>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20">AGENT_ACTIVE</div>
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20">SYNC_OK</div>
          </div>
        </div>
      </div>
    </div>
  );
}
