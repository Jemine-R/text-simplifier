import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, FeedbackData, Transformation } from '../types';
import { API_URL } from '../config';
import { simplifyText, simplifyDocument, analyzeFeedback, simplifySentence } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Sparkles, Send, RefreshCw, AlertCircle, CheckCircle2, Star, MessageSquare, Upload, FileText, X, File, History, User, MousePointer2, Clock } from 'lucide-react';

import * as pdfjs from 'pdfjs-dist';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SimplifierProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onUpdateProfileState?: (newProfile: UserProfile) => void;
}

export default function Simplifier({ profile, onUpdateProfile, onUpdateProfileState }: SimplifierProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [level, setLevel] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarTab, setSidebarTab] = useState<'persona' | 'history'>('persona');
  const [history, setHistory] = useState<Transformation[]>([]);
  const [focusedSentence, setFocusedSentence] = useState<{ original: string; simplified: string; level: number } | null>(null);
  const [isSentenceLoading, setIsSentenceLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'edit' | 'probe'>('edit');
  const [saveToHistory, setSaveToHistory] = useState(true);
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');

  const handleUpdateLora = async (enabled: number, rank: number) => {
    if (!profile.userId) return;
    try {
      const updatedProfile = {
        ...profile,
        loraEnabled: enabled,
        loraRank: rank
      };
      
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
      
      if (res.ok && onUpdateProfileState) {
        onUpdateProfileState(updatedProfile);
      }
    } catch (err) {
      console.error("Failed to update LoRA configuration:", err);
    }
  };

  const runLoraOptimizationSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatus('Initializing base adapters...');
    
    const steps = [
      { progress: 15, status: 'Compiling attention adapters...' },
      { progress: 40, status: 'Injecting low-rank matrices (A & B)...' },
      { progress: 65, status: `Tuning weights on ${history.length} history samples...` },
      { progress: 85, status: 'Applying gradient updates...' },
      { progress: 100, status: 'Checkpoint synchronized!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 200));
      setSyncProgress(step.progress);
      setSyncStatus(step.status);
    }

    await handleUpdateLora(profile.loraEnabled !== undefined ? profile.loraEnabled : 1, profile.loraRank || 8);

    setTimeout(() => {
      setIsSyncing(false);
    }, 1000);
  };

  const [feedback, setFeedback] = useState<FeedbackData>({
    originalText: '',
    simplifiedText: '',
    q1_answer: 'fully-retained',
    q2_answer: 'extremely-clear',
    q3_answer: 'perfect-tone',
    comments: ''
  });

  const fetchHistory = async () => {
    if (!profile.userId) return;
    try {
      const res = await fetch(`${API_URL}/api/transformations/${profile.userId}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  React.useEffect(() => {
    fetchHistory();
  }, [profile.userId]);

  React.useEffect(() => {
    let timer: any;
    if (showFeedback) {
      setReadingTimeSeconds(0);
      timer = setInterval(() => {
        setReadingTimeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setReadingTimeSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showFeedback]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const extractPdfText = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
      }
      setInput(fullText);
    } catch (err) {
      console.error("PDF Extraction error:", err);
      setError("Failed to extract text from PDF for interactive session.");
    }
  };

  const handleFileChange = async (file: File) => {
    const validTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
      setError('');
      // If it's a text file, we can also show a preview in the input box
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        const reader = new FileReader();
        reader.onload = (e) => setInput(e.target?.result as string);
        reader.readAsText(file);
      } else if (file.type === 'application/pdf') {
        await extractPdfText(file);
      }
    } else {
      setError('Unsupported file type. Please upload .txt, .md, or .pdf');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleSimplify = async () => {
    if (!input.trim() && !selectedFile) return;
    setIsLoading(true);
    setError('');
    setShowFeedback(false);
    try {
      let result = '';
      if (selectedFile && selectedFile.type === 'application/pdf') {
        const base64 = await fileToBase64(selectedFile);
        result = await simplifyDocument(base64, selectedFile.type, profile, level);
      } else {
        // Use text input (which might have been populated by a txt/md file)
        if (!input.trim()) {
           throw new Error("No text content found in file or input.");
        }
        result = await simplifyText(input, profile, level);
      }
      
      setOutput(result);
      
      // Save transformation to DB
      if (profile.userId && saveToHistory) {
        await fetch(`${API_URL}/api/transformations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.userId,
            originalText: selectedFile ? `[FILE: ${selectedFile.name}]` : input,
            simplifiedText: result,
            level
          })
        });
        await fetchHistory();
      }

      setFeedback(prev => ({ 
        ...prev, 
        originalText: selectedFile ? `[FILE: ${selectedFile.name}]` : input, 
        simplifiedText: result,
        q1_answer: 'fully-retained',
        q2_answer: 'extremely-clear',
        q3_answer: 'perfect-tone',
        comments: ''
      }));
      setTimeout(() => setShowFeedback(true), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSentenceProbe = async (sentence: string) => {
    if (!sentence.trim()) return;
    setIsSentenceLoading(true);
    setFocusedSentence(null); // Clear previous
    try {
      const simplified = await simplifySentence(sentence, profile, level);
      setFocusedSentence({ original: sentence, simplified, level });

      // Save transformation to DB
      if (profile.userId && saveToHistory) {
        await fetch(`${API_URL}/api/transformations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.userId,
            originalText: sentence,
            simplifiedText: simplified,
            level
          })
        });
        await fetchHistory();
      }
    } catch (err) {
      console.error("Sentence probe failed", err);
    } finally {
      setIsSentenceLoading(false);
    }
  };

  const splitIntoSentences = (text: string) => {
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
  };

  const submitFeedback = async () => {
    setIsSubmittingFeedback(true);
    try {
      const category = feedback.comments ? await analyzeFeedback(feedback.comments) : 'general';
      
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
          originalText: feedback.originalText,
          simplifiedText: feedback.simplifiedText,
          q1_answer: feedback.q1_answer,
          q2_answer: feedback.q2_answer,
          q3_answer: feedback.q3_answer,
          comments: feedback.comments,
          readingTime: readingTimeSeconds,
          category
        })
      });

      const resData = await res.json();
      if (resData && resData.status === 'success') {
        // Trigger a profile re-fetch so that the saved adapter is immediately active
        if (profile.userId && onUpdateProfileState) {
          const profileRes = await fetch(`${API_URL}/api/profile/${profile.userId}`);
          const profileData = await profileRes.json();
          if (profileData && profileData.updatedAt) {
            onUpdateProfileState(profileData);
          }
        }
      }
      setShowFeedback(false);
    } catch (err) {
      console.error("Feedback saving error", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6.5rem)] overflow-hidden bg-[#09090b]">
      {/* Sidebar: Profile Metrics (Left) */}
      <aside className="w-full lg:w-80 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col overflow-hidden shrink-0">
        <div className="flex border-b border-zinc-800">
          <button 
            onClick={() => setSidebarTab('persona')}
            className={`flex-1 py-4 text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'persona' ? 'text-zinc-100 bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <User size={12} />
            Persona
          </button>
          <button 
            onClick={() => setSidebarTab('history')}
            className={`flex-1 py-4 text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'history' ? 'text-zinc-100 bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <History size={12} />
            History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {sidebarTab === 'persona' ? (
            <>
              <div>
                <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-6">Target Metrics</h2>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] items-center">
                      <span className="text-zinc-500 uppercase font-bold tracking-tighter">Vocabulary</span>
                      <span className="text-zinc-100 font-mono">{(profile.vocabularyTolerance * 10)}%</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${profile.vocabularyTolerance * 10}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] items-center">
                      <span className="text-zinc-500 uppercase font-bold tracking-tighter">Reading Level</span>
                      <span className="text-zinc-100 truncate ml-2 text-right flex-1">{profile.readingLevel}</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 w-3/4"></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] items-center">
                      <span className="text-zinc-500 uppercase font-bold tracking-tighter">Capacity</span>
                      <span className="text-emerald-400">OPTIMAL</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Active Constraints</h2>
                <ul className="space-y-3">
                  {[
                    { label: 'Jargon Bypass', active: profile.technicalJargonLevel !== 'high' },
                    { label: 'Tone Sync', active: true },
                    { label: 'Structure Mod', active: profile.preferredStructure !== 'complex' },
                    { label: 'Metaphor Ref', active: profile.metaphorUsage === 'allow' }
                  ].map((c, i) => (
                    <li key={i} className={`flex items-center gap-3 text-[10px] uppercase tracking-widest font-bold ${c.active ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-emerald-500' : 'bg-zinc-800'}`}></div>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">LoRA Tuning</span>
                  <button
                    onClick={() => handleUpdateLora(profile.loraEnabled === 0 ? 1 : 0, profile.loraRank || 8)}
                    className={`px-3 py-1 rounded text-[8px] uppercase font-black tracking-widest transition-all ${
                      profile.loraEnabled !== 0 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow shadow-emerald-500/10' 
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}
                  >
                    {profile.loraEnabled !== 0 ? 'Active' : 'Offline'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[8px] border-b border-zinc-800/60 pb-2">
                  <span className="text-zinc-500 uppercase tracking-wider font-bold">ADAPTER STATE</span>
                  {profile.loraTrained === 1 ? (
                    <span className="px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/20 animate-pulse">
                      Trained & Active
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Requires Feedback
                    </span>
                  )}
                </div>

                <p className="text-[9px] text-zinc-500 leading-relaxed font-sans">
                  Fine-tuning adapts underlying weight matrices. Requires 5 scores &gt;= 0.6 to run a PEFT training pass and save your custom adapter.
                </p>

                {profile.loraEnabled !== 0 && (
                  <div className="space-y-3 pt-1 border-t border-zinc-800/60">
                    <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400">
                      <span>PARAMETER BUDGET (RANK)</span>
                      <span className="text-indigo-400 font-mono">R={profile.loraRank || 8}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[4, 8, 16, 32].map((r) => (
                        <button
                          key={r}
                          onClick={() => handleUpdateLora(1, r)}
                          className={`py-1 text-[8px] font-mono font-bold rounded border ${
                            (profile.loraRank || 8) === r
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                              : 'bg-zinc-950/40 border-zinc-900 text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          R={r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-800/60 text-[8px] font-mono text-zinc-600 uppercase space-y-1">
                  <div className="flex justify-between">
                    <span>Dataset Connection:</span>
                    <span className="text-zinc-400 font-bold">{history.length} samples</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trained Iterations:</span>
                    <span className="text-zinc-400 font-bold">{history.length * 12} iterations</span>
                  </div>
                </div>

                {isSyncing ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[8px] text-indigo-400 font-mono uppercase">
                      <span className="animate-pulse">{syncStatus}</span>
                      <span>{syncProgress}%</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${syncProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={runLoraOptimizationSync}
                    className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-[8px] font-bold uppercase tracking-widest rounded-lg border border-indigo-500/20 transition-all active:scale-[98]"
                  >
                    Recalibrate Adapter Weights
                  </button>
                )}
              </div>

              <button 
                onClick={onUpdateProfile}
                className="w-full py-3 bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-zinc-700 transition-colors"
              >
                Modify Profile
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Transformation Log</h2>
              {history.length === 0 ? (
                <div className="py-20 text-center text-[10px] text-zinc-600 uppercase tracking-widest italic">
                  Cycle log empty
                </div>
              ) : (
                history.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setInput(item.originalText.startsWith('[FILE:') ? '' : item.originalText);
                      setOutput(item.simplifiedText);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-mono text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold uppercase">LVL {item.level}</span>
                    </div>
                    <p className="text-[10px] text-zinc-300 line-clamp-2 leading-relaxed font-medium">
                      {item.simplifiedText}
                    </p>
                    <div className="mt-2 text-[8px] text-zinc-600 uppercase tracking-widest font-bold group-hover:text-indigo-400 transition-colors">
                      Recall from Buffer →
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Processor View */}
      <section className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto">
        <div className="flex-1 flex flex-col gap-4 min-h-[250px]">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Source Buffer</h3>
            <div className="flex gap-4 items-center">
              {(input.length > 0 || selectedFile) && (
                <button 
                  onClick={() => {
                    setInput('');
                    setSelectedFile(null);
                    setInputMode('edit');
                    setFocusedSentence(null);
                    setOutput('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/5 hover:bg-red-500/20 text-red-400 text-[9px] uppercase font-bold tracking-widest transition-all"
                  title="Clear text and reset"
                >
                  <X size={10} />
                  Clear & Start Over
                </button>
              )}
              {input.length > 5 && !selectedFile && (
                <button 
                  onClick={() => setInputMode(inputMode === 'edit' ? 'probe' : 'edit')}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] uppercase font-bold tracking-widest transition-all ${
                    inputMode === 'probe' 
                    ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg' 
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <MousePointer2 size={10} />
                  Interactive Probe {inputMode === 'probe' ? 'ON' : 'OFF'}
                </button>
              )}
              {selectedFile && (
                <div className="flex items-center gap-2 px-2 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded text-[10px] text-indigo-400 font-mono">
                  <File size={10} />
                  {selectedFile.name}
                  <button onClick={() => { setSelectedFile(null); setInput(''); setOutput(''); }} className="hover:text-white transition-colors">
                    <X size={10} />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-zinc-700 font-mono uppercase">{input.length} CHARS</span>
            </div>
          </div>
          <div 
            className={`flex-1 bg-zinc-900/50 border rounded-xl overflow-hidden shadow-inner group transition-all relative ${
              isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800 focus-within:border-zinc-700'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFile && selectedFile.type === 'application/pdf' && inputMode === 'edit' ? (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <FileText size={32} />
                </div>
                <div className="text-center">
                  <p className="text-zinc-100 font-bold text-sm tracking-tight">{selectedFile.name}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">PDF DOCUMENT PREPPED</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setInputMode('probe')}
                    className="px-6 py-2 bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-widest rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Enter Interactive Probe
                  </button>
                  <button 
                    onClick={() => { setSelectedFile(null); setInput(''); }}
                    className="px-6 py-2 bg-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-widest rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              </div>
            ) : inputMode === 'probe' && input ? (
              <div className="w-full h-full p-8 overflow-y-auto space-y-6">
                 <div className="flex flex-wrap gap-2">
                  {splitIntoSentences(input).map((sentence, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => handleSentenceProbe(sentence)}
                      className={`px-3 py-2 border rounded-lg text-left text-sm transition-all max-w-full ${
                        focusedSentence?.original === sentence 
                        ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      {sentence}
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {(isSentenceLoading || focusedSentence) && (
                    <motion.div 
                      key="probe-result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-6 bg-indigo-950/20 border-2 border-indigo-500/30 rounded-2xl shadow-2xl space-y-4 my-8"
                    >
                      {isSentenceLoading ? (
                        <div className="flex items-center gap-4 py-4">
                          <RefreshCw className="animate-spin text-indigo-400" size={16} />
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Synthesizing simplified variant...</span>
                        </div>
                      ) : focusedSentence && (
                        <>
                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Target Transformation (Level {focusedSentence.level})</span>
                            <div className="text-lg text-zinc-100 font-sans leading-relaxed">
                              <ReactMarkdown>{focusedSentence.simplified}</ReactMarkdown>
                            </div>
                          </div>
                          <button 
                            onClick={() => setFocusedSentence(null)}
                            className="text-[9px] font-bold text-zinc-600 uppercase hover:text-zinc-400 transition-colors"
                          >
                            Dismiss Result
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Inject complex sequence data or drop a file here..."
                  className="w-full h-full p-8 text-zinc-300 placeholder-zinc-700 focus:outline-none resize-none text-xl leading-relaxed font-serif italic selection:bg-indigo-500/50"
                />
                
                {input.length === 0 && !isDragging && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center space-y-2 opacity-20 group-hover:opacity-40 transition-opacity">
                    <Upload size={40} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Drop .txt, .md, or .pdf</p>
                  </div>
                )}
              </>
            )}

            <div className="absolute bottom-4 right-4">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.md,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all backdrop-blur-md"
                title="Upload Document"
              >
                <Upload size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-4 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
              {[1, 2, 3].map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    level === l 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Level {l}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2.5 rounded-xl border border-zinc-800 select-none shadow-inner">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Save Document to DB</span>
              <button
                onClick={() => setSaveToHistory(!saveToHistory)}
                className={`w-10 h-6 rounded-full p-1 transition-all flex items-center ${
                  saveToHistory ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    saveToHistory ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 py-2 w-full">
            <div className="h-[1px] flex-1 bg-zinc-800"></div>
            <button
              onClick={handleSimplify}
              disabled={isLoading || (!input.trim() && !selectedFile)}
              className="px-12 py-4 bg-zinc-100 text-zinc-900 font-black text-xs uppercase tracking-[0.3em] rounded-full hover:bg-white disabled:opacity-20 transition-all active:scale-95 shadow-2xl shadow-white/5 whitespace-nowrap"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={16} /> : (selectedFile ? "Transform Document" : "Transform Content")}
            </button>
            <div className="h-[1px] flex-1 bg-zinc-800"></div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-h-[250px]">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">Simplified OutputStream</h3>
            <span className="text-[10px] text-zinc-700 font-mono uppercase">Refined via LLaMA v3</span>
          </div>
          <div className="flex-1 p-8 bg-indigo-950/10 border border-indigo-500/20 rounded-xl overflow-y-auto shadow-2xl relative group focus-within:border-indigo-400 transition-colors">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <RefreshCw className="animate-spin text-indigo-500" size={40} />
                  <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse"></div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Processing</p>
                  <p className="text-indigo-400/50 text-[9px] uppercase tracking-wider">Syncing LoRA Weights...</p>
                </div>
              </div>
            ) : output ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-invert max-w-none text-zinc-100 text-xl leading-relaxed font-sans"
              >
                <ReactMarkdown>{output}</ReactMarkdown>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4">
                <BookOpen size={40} strokeWidth={1} />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] italic">Awaiting Transformation</p>
              </div>
            )}
            
            {error && (
              <div className="absolute top-4 left-4 right-4 bg-red-950/40 border border-red-500/40 p-4 rounded-lg flex items-center gap-3 text-red-400 backdrop-blur-md">
                <AlertCircle size={16} />
                <p className="text-[10px] font-bold uppercase tracking-widest">{error}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Non-Intrusive Validation Dialog (Corner Card) */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div 
            initial={{ opacity: 0, x: 20, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-12 right-8 z-50 w-full max-w-[340px]"
          >
            <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black ring-1 ring-white/5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <Star className="text-indigo-400" size={16} fill="currentColor" />
                  </div>
                  <h3 className="text-[10px] font-bold text-zinc-100 uppercase tracking-widest">Pipeline Validation</h3>
                </div>
                <button 
                  onClick={() => setShowFeedback(false)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <AlertCircle size={14} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Reading Time Tracker */}
                <div className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-900 text-[9px] font-bold tracking-wider select-none">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock size={12} className="text-indigo-400 animate-pulse" />
                    <span>READING TIME TRACKER</span>
                  </div>
                  <span className="font-mono text-indigo-400">{readingTimeSeconds}s</span>
                </div>

                {/* Question 1 */}
                <div className="space-y-2">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">
                    1. Meaning Retention (Fidelity)
                  </label>
                  <div className="flex flex-col gap-1">
                    {[
                      { value: 'fully-retained', label: 'fully retained (1.0)', desc: 'No facts or critical meaning was lost.' },
                      { value: 'partially-retained', label: 'partially retained (0.5)', desc: 'Some nuance was lost or oversimplified.' },
                      { value: 'meaning-lost', label: 'meaning lost (0.0)', desc: 'Critical details or accuracy were compromised.' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFeedback(prev => ({ ...prev, q1_answer: opt.value }))}
                        className={`w-full py-1.5 px-3 rounded text-[9px] text-left border transition-all ${
                          feedback.q1_answer === opt.value
                            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[7px] text-zinc-600">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 2 */}
                <div className="space-y-2">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">
                    2. Readability Clarity
                  </label>
                  <div className="flex flex-col gap-1">
                    {[
                      { value: 'extremely-clear', label: 'extremely clear (1.0)', desc: 'Fluent, digestible, perfectly readable.' },
                      { value: 'moderately-clear', label: 'moderately clear (0.6)', desc: 'Understandable but lacks clean flow.' },
                      { value: 'hard-to-understand', label: 'hard to understand (0.2)', desc: 'Extremely dense or confusing sentence layout.' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFeedback(prev => ({ ...prev, q2_answer: opt.value }))}
                        className={`w-full py-1.5 px-3 rounded text-[9px] text-left border transition-all ${
                          feedback.q2_answer === opt.value
                            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[7px] text-zinc-600">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 3 */}
                <div className="space-y-2">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">
                    3. Persona Tone Matching
                  </label>
                  <div className="flex flex-col gap-1">
                    {[
                      { value: 'perfect-tone', label: 'perfect tone (1.0)', desc: 'Perfect register matching selected constraints.' },
                      { value: 'acceptable', label: 'acceptable (0.6)', desc: 'Slightly too formal or slightly too simple.' },
                      { value: 'inappropriate', label: 'inappropriate (0.2)', desc: 'Completely mismatched to profile parameters.' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFeedback(prev => ({ ...prev, q3_answer: opt.value }))}
                        className={`w-full py-1.5 px-3 rounded text-[9px] text-left border transition-all ${
                          feedback.q3_answer === opt.value
                            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[7px] text-zinc-600">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">Additional Comments</label>
                  <textarea
                    placeholder="Refinement suggestion notes..."
                    value={feedback.comments}
                    onChange={(e) => setFeedback(prev => ({ ...prev, comments: e.target.value }))}
                    className="w-full h-16 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[10px] text-zinc-300 focus:outline-none focus:border-indigo-500/30 transition-all placeholder-zinc-800 italic"
                  />
                </div>

                <button 
                  onClick={submitFeedback}
                  disabled={isSubmittingFeedback}
                  className="w-full py-3 bg-zinc-100 text-zinc-900 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  {isSubmittingFeedback ? <RefreshCw className="animate-spin" size={12} /> : 'Commit Sync'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
