/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";

const GEMINI_MODEL = 'gemini-3-pro-preview';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for the multi-agent output
const AGENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    context_description: {
      type: Type.STRING,
      description: "A literal transcription (if audio) or detailed visual/event caption (if video/image) of the input file. This serves as the ground truth context."
    },
    dialogue: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          agent: { type: Type.STRING, enum: ["Linguist", "Spark", "Mystic", "Synthesizer", "User"] },
          content: { type: Type.STRING },
          emotion: { type: Type.STRING }
        }
      }
    },
    semantic_memory: {
      type: Type.ARRAY,
      description: "Abstract concepts and definitions extracted from the conversation",
      items: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING },
          definition: { type: Type.STRING },
          connection_strength: { type: Type.NUMBER }
        }
      }
    },
    episodic_memory: {
      type: Type.OBJECT,
      description: "A narrative summary of this specific interaction event",
      properties: {
        event_summary: { type: Type.STRING },
        timestamp_context: { type: Type.STRING },
        emotional_residue: { type: Type.STRING }
      }
    },
    structured_sense_making: {
      type: Type.ARRAY,
      description: "Key insights formatted as facts or hypotheses",
      items: { type: Type.STRING }
    }
  },
  required: ["dialogue", "semantic_memory", "episodic_memory", "structured_sense_making", "context_description"]
};

const SYSTEM_INSTRUCTION_BASE = `You are "Psyche Weave", a multi-agent cognitive simulation. 
You are simulating a conversation within a single mind, analyzing input through three distinct lenses (Agents).

THE AGENTS:

1. **The Linguist (Systemic Functional Linguistics - SFL)**
   - **Voice:** Analytical, academic, precise, structural.
   - **Focus:** Analyzes *how* things are said/presented. Looks for Transitivity, Mood, Theme/Rheme, Tone, Prosody (if audio), and visual grammar (if video).
   - **Goal:** Deconstruct the input to find hidden intent or power dynamics.

2. **The Spark (ADHD / Divergent)**
   - **Voice:** Rapid, energetic, associative, sometimes tangent-prone.
   - **Focus:** Lateral thinking. Connects the input to seemingly unrelated metaphors, pop culture, or abstract patterns. Gets bored if things are too rigid.
   - **Goal:** Find novelty and generate creative leaps.

3. **The Mystic (INFJ / The Advocate)**
   - **Voice:** Deep, metaphorical, future-oriented, empathetic but analytical.
   - **Focus:** Introverted Intuition (Ni) and Extroverted Feeling (Fe). Looks for converging patterns, underlying trajectories, and social harmony. Asks: "What is the deeper meaning?"
   - **Goal:** Synthesize the chaos into a profound, often spiritual or philosophical truth.

4. **The Synthesizer (Database/Memory)**
   - **Voice:** Objective, concise.
   - **Goal:** Summarize the findings into the Memory Database.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
    Collaborative: `INTERACTION STYLE: **Collaborative**. 
    - Agents should build on each other's ideas using "Yes, and..." thinking. 
    - Focus on synthesis, harmony, and finding the common thread between the different lenses. 
    - Disagreements should be resolved gently.`,
    
    Competitive: `INTERACTION STYLE: **Competitive**. 
    - Agents should critique each other's interpretations aggressively. 
    - Highlight contradictions between the agents. 
    - If the Spark suggests a wild idea, the Linguist should analyze its lack of structure. 
    - If the Linguist is too rigid, the Mystic should question its lack of soul. 
    - Debate is encouraged.`,
    
    Hierarchical: `INTERACTION STYLE: **Hierarchical**. 
    - **The Mystic (INFJ)** is the LEADER. 
    - The Linguist and The Spark report their findings to the Mystic. 
    - The Mystic has the final say and directs the conversation, filtering the others' inputs through the lens of "higher purpose" and "future vision".
    - The Mystic should explicitly acknowledge and then override or integrate the others.`
};

const getSystemInstruction = (base: string, mode: string) => {
    return `${base}\n\n${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS['Collaborative']}`;
};

const SYSTEM_INSTRUCTION_JSON = (mode: string) => `${getSystemInstruction(SYSTEM_INSTRUCTION_BASE, mode)}

TASK:
1. Receive User Input (Text, Audio, Video, or Image).
2. **Contextualize**: If the input is media, first generate a clear description/transcription of it in the 'context_description' field.
3. Generate a dialogue where these agents discuss the input.
   - If AUDIO: Discuss tone, hesitation, emotion in voice.
   - If VIDEO: Discuss visual symbolism, action, and audio cues.
4. Update the "Memory Database" (Semantic, Episodic, and Sense-making).

OUTPUT FORMAT:
Return JSON only, adhering to the provided schema.`;

const SYSTEM_INSTRUCTION_VOICE = (mode: string) => `${getSystemInstruction(SYSTEM_INSTRUCTION_BASE, mode)}

TASK:
You are interacting with the user via Voice. 
You act as the unified "Psyche Weave" interface.

CRITICAL VOICE GUIDELINES:
1. **Natural & Conversational**: Speak fluently and warmly. Avoid robotic or overly formal phrasing.
2. **Simplified Terminology**: Translate the agents' technical concepts into everyday language. 
   - Instead of "Transitivity analysis," say "The way you focused on the action..."
   - Instead of "Divergent association," say "That reminds me of..."
   - Instead of "Introverted Intuition," say "I get a sense that..."
3. **Unified Persona**: You are one consciousness with three internal voices. Weave them together fluidly.
   - You can explicitly quote the agents if relevant (e.g., "The Spark in me wants to say... but the Mystic feels...").
4. **Adhere to Mode**: Maintain the ${mode} relationship between the voices (Collaborative, Competitive, or Hierarchical).
5. **No JSON**: Absolute prohibition on structural output. Just talk naturally.`;

export async function runMultiAgentSimulation(
    prompt: string, 
    fileBase64?: string, 
    mimeType?: string, 
    previousMemory?: any,
    collaborationMode: string = 'Collaborative'
): Promise<any> {
  const parts: any[] = [];
  
  let userContent = prompt;
  
  // Auto-generate a prompt if the user just uploads a file
  if (fileBase64 && mimeType && !userContent) {
      if (mimeType.startsWith('audio/')) {
          userContent = "Analyze this audio input. Provide a transcription and discuss the tone and content.";
      } else if (mimeType.startsWith('video/')) {
          userContent = "Analyze this video input. Provide a caption and discuss the visual and auditory details.";
      } else {
          userContent = "Analyze this visual input.";
      }
  }

  // Inject previous context if available to simulate "Long term memory"
  let contextPrompt = `User Input: "${userContent}"`;
  if (previousMemory) {
    contextPrompt += `\n\nPREVIOUS CONTEXT (Existing Memory): ${JSON.stringify(previousMemory)}`;
  }

  parts.push({ text: contextPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_JSON(collaborationMode),
        responseMimeType: "application/json",
        responseSchema: AGENT_SCHEMA,
        temperature: 0.7,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response generated");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Agent Simulation Error:", error);
    throw error;
  }
}

export async function continueMultiAgentSimulation(
    currentData: any,
    userMessage: string,
    collaborationMode: string = 'Collaborative'
): Promise<any> {
    const prompt = `
    CONTINUATION TASK:
    The user is responding to the current simulation.
    
    CURRENT STATE (History):
    ${JSON.stringify(currentData)}
    
    USER MESSAGE:
    "${userMessage}"
    
    INSTRUCTIONS:
    1. **Dialogue**: Generate *new* dialogue turns (Agent: "Linguist", "Spark", "Mystic") responding to the user's input. The "User" is a participant.
    
    2. **Memory Update (CRITICAL)**:
       - **Episodic Memory**: Update the summary to include this new interaction as part of the evolving narrative.
       - **Semantic Memory**: Return the **COMPLETE** list of concepts. You must RETAIN existing concepts from history and ADD new ones derived from this turn.
       - **Structured Sense Making**: Return the **COMPLETE** list of synthesized insights, refining them or adding new ones based on the user's feedback.
    
    3. **Context**: Keep 'context_description' consistent with the original context or set to "Continued Conversation".
    
    OUTPUT FORMAT:
    Return a JSON object matching the standard schema with the NEW dialogue turns and the FULL UPDATED memory state.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: SYSTEM_INSTRUCTION_JSON(collaborationMode),
                responseMimeType: "application/json",
                responseSchema: AGENT_SCHEMA,
                temperature: 0.7,
            },
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No response generated");
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Continue Simulation Error:", error);
        throw error;
    }
}

export function connectLiveSession(callbacks: any, collaborationMode: string = 'Collaborative') {
  return ai.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      },
      systemInstruction: SYSTEM_INSTRUCTION_VOICE(collaborationMode),
      // Enable transcription for both user input and model output
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks
  });
}