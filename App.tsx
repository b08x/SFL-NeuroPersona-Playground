/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { Hero } from './components/Hero';
import { InputArea, CollaborationMode } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { VoiceInterface } from './components/VoiceInterface';
import { runMultiAgentSimulation } from './services/gemini';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState<CollaborationMode>('Collaborative');
  const [history, setHistory] = useState<Creation[]>([]);

  // Load history from local storage
  useEffect(() => {
    const saved = localStorage.getItem('psyche_weave_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loadedHistory = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
        setHistory(loadedHistory);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history when it changes
  useEffect(() => {
    if (history.length > 0) {
        try {
            localStorage.setItem('psyche_weave_history', JSON.stringify(history));
        } catch (e) {
            console.warn("Local storage full or error saving history", e);
        }
    }
  }, [history]);

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async (promptText: string, mode: CollaborationMode, file?: File) => {
    setIsGenerating(true);
    setActiveCreation(null);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        imageBase64 = await fileToBase64(file);
        mimeType = file.type.toLowerCase();
      }

      // We pass the previous memory context (from the most recent history item)
      // to give the agents "long term memory"
      const previousMemory = history.length > 0 ? history[0].data : null;

      const agentData = await runMultiAgentSimulation(promptText, imageBase64, mimeType, previousMemory, mode);
      
      if (agentData) {
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: promptText.length > 30 ? promptText.substring(0, 30) + "..." : (promptText || "Visual Analysis"),
          data: agentData,
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : undefined,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
      }

    } catch (error) {
      console.error("Failed to generate:", error);
      alert("The agents are overwhelmed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVoiceStart = (mode: CollaborationMode) => {
    setVoiceMode(mode);
    setIsVoiceActive(true);
  };

  const handleReset = () => {
    setActiveCreation(null);
    setIsGenerating(false);
  };

  const handleSelectCreation = (creation: Creation) => {
    setActiveCreation(creation);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-zinc-950 bg-dot-grid text-zinc-50 selection:bg-indigo-500/30 overflow-y-auto overflow-x-hidden relative flex flex-col">
      
      {/* Voice Interface Overlay */}
      <VoiceInterface 
        active={isVoiceActive} 
        mode={voiceMode}
        onClose={() => setIsVoiceActive(false)} 
      />

      {/* Centered Content Container */}
      <div 
        className={`
          min-h-full flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isFocused 
            ? 'opacity-0 scale-95 blur-sm pointer-events-none h-[100dvh] overflow-hidden' 
            : 'opacity-100 scale-100 blur-0'
          }
        `}
      >
        {/* Main Vertical Centering Wrapper */}
        <div className="flex-1 flex flex-col justify-center items-center py-12 md:py-20 gap-12">
          
          <Hero />

          <InputArea 
            onGenerate={handleGenerate} 
            isGenerating={isGenerating}
            onVoiceStart={handleVoiceStart}
          />
          
        </div>

        {/* Footer Area / History */}
        <div className="pb-8">
           <CreationHistory history={history} onSelect={handleSelectCreation} />
        </div>
      </div>
      
      {/* Live Preview Modal/Overlay */}
      <LivePreview 
        creation={activeCreation} 
        isLoading={isGenerating} 
        isFocused={isFocused}
        onReset={handleReset}
      />

    </div>
  );
};

export default App;