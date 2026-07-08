export interface UserProfile {
  id?: number;
  userId?: string;
  username?: string;
  vocabularyTolerance: number; // 1-10
  sentenceLengthPreference: 'short' | 'medium' | 'long';
  complexityCeiling: 'basic' | 'intermediate' | 'advanced';
  technicalJargonLevel: 'none' | 'low' | 'medium' | 'high';
  tonePreference: 'formal' | 'casual' | 'balanced';
  abstractContentHandling: 'concrete' | 'theoretical' | 'balanced';
  metaphorUsage: 'avoid' | 'allow';
  preferredStructure: 'simple' | 'complex' | 'balanced';
  readingLevel: string; // e.g., "Grade 5", "College", "Executive"
  outputStyle: 'concise' | 'descriptive' | 'balanced';
  explanationDepth: 'shallow' | 'standard' | 'thorough';
  visualLayout: 'text-only' | 'structured-lists' | 'side-by-side';
  loraEnabled?: number; // 1 for active, 0 for inactive
  loraRank?: number;    // 4, 8, 16, or 32
  loraTrained?: number;  // 1 if LoRA adapter is built and active, 0 otherwise
  updatedAt: string;
}

export interface SimplificationRequest {
  text: string;
  profile: UserProfile;
}

export interface Transformation {
  id: number;
  userId: string;
  originalText: string;
  simplifiedText: string;
  level: number;
  createdAt: string;
}

export interface FeedbackData {
  id?: number;
  userId?: string;
  originalText: string;
  simplifiedText: string;
  q1_answer: string; // Fidelity: e.g. "fully-retained" | "partially-retained" | "meaning-lost"
  q2_answer: string; // Clarity: e.g. "extremely-clear" | "moderately-clear" | "hard-to-understand"
  q3_answer: string; // Tone: e.g. "perfect-tone" | "acceptable" | "inappropriate"
  compositeScore?: number;
  comments: string;
  readingTime?: number;
  createdAt?: string;
}

export interface FeedbackAnalysis {
  categories: { name: string; count: number }[];
  averageClarity: number;
  totalEntries: number;
}
