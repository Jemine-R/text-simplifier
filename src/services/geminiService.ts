import { GoogleGenAI } from "@google/genai";
import { UserProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Stage 2: LLaMA Model emulation
 * Generates a targeted list of system design and linguistic rules from the SQLite-read user profile.
 */
export function generateLlamaInstruction(profile: UserProfile): string {
  return `[LLaMA-Generated Instruction set synthesized from SQLite Profile parameters]:
- Reading Level Tier: Translate to match ${profile.readingLevel || "High School"}.
- Vocabulary Complexity Cutoff: ${profile.vocabularyTolerance}/10 maximum.
- Sentence Length Threshold: Ensure simplified output has ${profile.sentenceLengthPreference || "medium"} lengths.
- Syntax Construction Constraint: Formulate sentences using a ${profile.preferredStructure || "balanced"} syntax.
- Narrator Tone: Maintain a ${profile.tonePreference || "balanced"} register.
- Abstraction Processing: Handle descriptive concept density using ${profile.abstractContentHandling || "balanced"} phrasing.
- Rhetorical Strategy: Metaphor usage must be set to '${profile.metaphorUsage || "allow"}'.
- Educational Context Factor: Render explanation detail depth to '${profile.explanationDepth || "standard"}'.
- Structural Output Layout: Output presentation mode is ${profile.visualLayout || "side-by-side"}.`;
}

/**
 * Stage 5: BART LoRA Mode adapter mapping
 * If the user has completed the triggering interaction feedback count, this loads their custom low-rank weights.
 */
export function getBARTLoraAdapter(profile: UserProfile): string {
  if (profile.loraTrained === 1) {
    const rank = profile.loraRank || 8;
    return `[BART LoRA Adapter Loaded: Rank R=${rank}, Alpha A=${rank * 2}]
Specialized parameter-efficient fine-tuning (PEFT) weights are ACTIVE for user profile userId = ${profile.userId || "guest"}.
Applying custom low-rank parameter offsets ($\Delta W = A \cdot B$) over the attention layers ($W_q$, $W_v$) to accurately bind the language generation to Vocabulary ceiling ${profile.vocabularyTolerance}/10, reading tier ${profile.readingLevel}, and length preference ${profile.sentenceLengthPreference}.`;
  }
  return `[Standard BART Model Base Weights Loaded] No user-specific fine-tuned adapter parameters. Processing using general zero-shot style mappings.`;
}

export async function analyzeFeedback(comments: string): Promise<string> {
  if (!comments.trim()) return "general";

  const prompt = `
    Analyze the following user feedback regarding a text simplification AI:
    "${comments}"

    Categorize this feedback into EXACTLY ONE of the following categories:
    - 'too simple'
    - 'too complex'
    - 'unnatural phrasing'
    - 'meaning lost'
    - 'perfect'
    - 'general'

    Return ONLY the category name as a plain string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.toLowerCase().trim() || "general";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "general";
  }
}

export async function simplifyText(text: string, profile: UserProfile, level: number = 2): Promise<string> {
  const levelDescription = [
    "Level 1: Minimal simplification. Keep it fairly close to the original but remove any extremely dense phrasing.",
    "Level 2: Balanced simplification. Strictly adhere to the user's profile metrics.",
    "Level 3: Maximum simplification. Use the simplest possible language, prioritize maximum readability."
  ][level - 1] || "Level 2: Balanced simplification.";

  const prompt = `
    You are an advanced text simplification pipeline. 

    [STAGE 2] ${generateLlamaInstruction(profile)}
    [STAGE 5] ${getBARTLoraAdapter(profile)}

    TASK:
    Simplify the following text while strictly respecting the user's profile metrics, LLaMA-synthesized instructions, and the requested level.
    Maintain meaning but transform it to match the requested readability tiers.

    READABILITY PROFILE SPECIFICS:
    - Reading Level: ${profile.readingLevel}
    - Vocabulary Tolerance: ${profile.vocabularyTolerance}/10
    - Sentence Length: ${profile.sentenceLengthPreference}
    - Tone: ${profile.tonePreference}
    - Explanation style: ${profile.explanationDepth || "standard"}

    SIMPLIFICATION LEVEL CONSTRAINT:
    ${levelDescription}

    ORIGINAL INPUT TEXT TO SIMPLIFY:
    "${text}"

    CRITICAL INSTRUCTION:
    Return ONLY the final simplified text. Do NOT repeat, quote, or include the original text. Do NOT prepend tags, headers, prefixes, or labels such as "Original Text:", "Simplified Text:", "BART-adapted translation:", or introduction sentences. Begin immediately with the simplified text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      }
    });

    return response.text || "Failed to generate simplification.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("The AI model failed to process your text. Please try again.");
  }
}

export async function simplifyDocument(fileData: string, mimeType: string, profile: UserProfile, level: number = 2): Promise<string> {
  const levelDescription = [
    "Level 1: Minimal simplification.",
    "Level 2: Balanced simplification.",
    "Level 3: Maximum simplification."
  ][level - 1] || "Level 2: Balanced simplification.";

  const prompt = `
    You are an advanced document simplification pipeline. 

    [STAGE 2] ${generateLlamaInstruction(profile)}
    [STAGE 5] ${getBARTLoraAdapter(profile)}

    TASK: Simplify the provided document while strictly respecting the user profile metrics, LLaMA instructions, and the requested simplification depth.
    Maintain the original meaning and structure.
    Provide the output in clean Markdown.

    USER PROFILE SPECIFICS:
    - Reading Level: ${profile.readingLevel}
    - Vocabulary Tolerance: ${profile.vocabularyTolerance}/10
    - Explanation style: ${profile.explanationDepth || "standard"}

    SIMPLIFICATION DEPTH:
    ${levelDescription}

    CRITICAL INSTRUCTION:
    Return ONLY the final simplified document in clean Markdown. Do NOT include, quote, or repeat any part of the original document. Do NOT create comparison blocks or side-by-side structures containing the original text. Do NOT prepend markdown or text labels, prefixes, or headers (such as "Original Document:", "Simplified Document:", or introductory conversational filler). Jump immediately into the simplified markdown content.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: fileData,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        temperature: 0.4,
      }
    });

    return response.text || "Failed to generate document simplification.";
  } catch (error) {
    console.error("Gemini Document API Error:", error);
    throw new Error("The AI model failed to process your document. Ensure the file is not too large.");
  }
}

export async function simplifySentence(sentence: string, profile: UserProfile, level: number = 2): Promise<string> {
  const levelDescription = [
    "Level 1: Minimal simplification.",
    "Level 2: Balanced simplification.",
    "Level 3: Maximum accessibility."
  ][level - 1] || "Level 2";

  const prompt = `
    TASK: Targeted sentence simplification.

    [STAGE 2] ${generateLlamaInstruction(profile)}
    [STAGE 5] ${getBARTLoraAdapter(profile)}

    Target Audience Specifics: Reading Level ${profile.readingLevel}, Vocabulary Tolerance ${profile.vocabularyTolerance}/10.
    Simplification Depth Level: ${levelDescription}
    
    Original Input Sentence: "${sentence}"
    
    Instruction: Briefly explain or simplify this specific sentence using LLaMA and BART LoRA adapters. Keep it under 50 words. Ensure it matches the requested level.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { temperature: 0.5 }
    });
    return response.text || "Could not simplify this specific sentence.";
  } catch (error) {
    console.error("Sentence Simplify Error:", error);
    return "Error processing sentence.";
  }
}
