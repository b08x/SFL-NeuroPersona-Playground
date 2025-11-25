/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { XMarkIcon, CpuChipIcon, BoltIcon, ChatBubbleBottomCenterTextIcon, CubeIcon, UserCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  isFocused: boolean;
  onReset: () => void;
}

// Agent Avatar Component
const AgentAvatar = ({ agent }: { agent: string }) => {
    const styles: Record<string, string> = {
        Linguist: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        Spark: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        Mystic: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        Synthesizer: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    };

    const icons: Record<string, any> = {
        Linguist: ChatBubbleBottomCenterTextIcon,
        Spark: BoltIcon,
        Mystic: UserCircleIcon,
        Synthesizer: CubeIcon
    };

    // Fallback for old history data
    const normalizedAgent = agent === "Feeler" ? "Mystic" : agent;

    const Icon = icons[normalizedAgent] || CubeIcon;
    const style = styles[normalizedAgent] || styles.Synthesizer;

    return (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${style} shrink-0 mt-1`}>
            <Icon className="w-5 h-5" />
        </div>
    );
};

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, isLoading, isFocused, onReset }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [parsedData, setParsedData] = useState<any>(null);

    useEffect(() => {
        if (creation?.data) {
            setParsedData(creation.data);
        } else {
            setParsedData(null);
        }
    }, [creation]);

    // Format for JSON display
    const formatJSON = (obj: any) => JSON.stringify(obj, null, 2);

    return (
    <div
      className={`
        fixed z-40 flex flex-col
        rounded-xl overflow-hidden border border-zinc-800 bg-[#0E0E10] shadow-2xl
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isFocused
          ? 'inset-2 md:inset-8 opacity-100 scale-100'
          : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      {/* Header */}
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-3">
            <button 
                onClick={onReset}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            >
                <XMarkIcon className="w-4 h-4 text-zinc-400" />
            </button>
            <div className="flex flex-col">
                <h3 className="text-sm font-bold text-zinc-100">Mindscape Console</h3>
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    {isLoading ? 'Processing Neural Weave...' : parsedData ? 'Session Active' : 'Idle'}
                </span>
            </div>
        </div>
        
        {parsedData && (
             <div className="flex space-x-1 text-[10px] font-mono text-zinc-600">
                <span>MEM_USAGE: {(formatJSON(parsedData.semantic_memory).length / 1024).toFixed(2)}KB</span>
             </div>
        )}
      </div>

      {/* Main Content: Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Dialogue Stream */}
        <div className="w-full md:w-3/5 lg:w-2/3 bg-black/20 flex flex-col border-r border-zinc-800">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6" ref={scrollRef}>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                        <CpuChipIcon className="w-12 h-12 text-indigo-500 animate-pulse" />
                        <div className="font-mono text-xs text-indigo-400">SIMULATING AGENT INTERACTION...</div>
                    </div>
                ) : parsedData?.dialogue ? (
                    parsedData.dialogue.map((turn: any, idx: number) => {
                        const normalizedAgent = turn.agent === 'Feeler' ? 'Mystic' : turn.agent;
                        return (
                            <div key={idx} className="flex space-x-4 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{animationDelay: `${idx * 100}ms`}}>
                                <AgentAvatar agent={turn.agent} />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-baseline justify-between">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${
                                            normalizedAgent === 'Linguist' ? 'text-emerald-500' :
                                            normalizedAgent === 'Spark' ? 'text-amber-500' :
                                            normalizedAgent === 'Mystic' ? 'text-violet-500' : 'text-indigo-500'
                                        }`}>{normalizedAgent}</span>
                                        {turn.emotion && <span className="text-[10px] text-zinc-600 font-mono italic">[{turn.emotion}]</span>}
                                    </div>
                                    <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-light">{turn.content}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                        Waiting for input...
                    </div>
                )}
            </div>
        </div>

        {/* Right: Memory & Sense-Making (Dashboard) */}
        <div className="hidden md:flex md:w-2/5 lg:w-1/3 bg-[#0c0c0e] flex-col overflow-y-auto">
            {parsedData ? (
                <div className="p-4 space-y-6">
                    
                    {/* Input Analysis (New) */}
                    {parsedData.context_description && (
                        <div className="space-y-2">
                             <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center">
                                 <EyeIcon className="w-3 h-3 mr-1" /> Input Analysis
                             </h4>
                             <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 text-xs text-zinc-300 leading-relaxed border-l-2 border-l-indigo-500">
                                 {parsedData.context_description}
                             </div>
                        </div>
                    )}

                    {/* Episodic Memory (Narrative) */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center">
                            <CubeIcon className="w-3 h-3 mr-1" /> Episodic Summary
                        </h4>
                        <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800 text-xs text-zinc-400 italic">
                            "{parsedData.episodic_memory?.event_summary || "..."}"
                        </div>
                    </div>

                    {/* Semantic Memory (Tags) */}
                    <div className="space-y-2">
                         <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Semantic Concepts</h4>
                         <div className="flex flex-wrap gap-2">
                             {parsedData.semantic_memory?.map((mem: any, i: number) => (
                                 <div key={i} className="group relative px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded hover:bg-indigo-500/20 cursor-help transition-colors">
                                     <span className="text-xs text-indigo-300 font-medium">{mem.concept}</span>
                                     {/* Tooltip for definition */}
                                     <div className="absolute bottom-full left-0 w-48 p-2 bg-zinc-800 text-zinc-300 text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 mb-2">
                                         {mem.definition}
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>

                    {/* Structured Sense Making */}
                    <div className="space-y-2">
                         <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Synthesized Insights</h4>
                         <ul className="space-y-2">
                             {parsedData.structured_sense_making?.map((insight: string, i: number) => (
                                 <li key={i} className="flex space-x-2 text-xs text-zinc-400">
                                     <span className="text-zinc-700">•</span>
                                     <span>{insight}</span>
                                 </li>
                             ))}
                         </ul>
                    </div>

                </div>
            ) : (
                <div className="p-8 flex flex-col items-center justify-center text-zinc-700 h-full">
                    <CubeIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-xs font-mono text-center">Memory Banks Offline</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};