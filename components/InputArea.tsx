/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useCallback, useState } from 'react';
import { PaperAirplaneIcon, PaperClipIcon, SparklesIcon, MicrophoneIcon, UserGroupIcon, ScaleIcon, TrophyIcon, MusicalNoteIcon, VideoCameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

export type CollaborationMode = 'Collaborative' | 'Competitive' | 'Hierarchical';

interface InputAreaProps {
  onGenerate: (prompt: string, mode: CollaborationMode, file?: File) => void;
  onVoiceStart: (mode: CollaborationMode) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, onVoiceStart, isGenerating, disabled = false }) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CollaborationMode>('Collaborative');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !file) return;
    onGenerate(text, mode, file || undefined);
    setText("");
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  };

  const getFileIcon = () => {
    if (!file) return PaperClipIcon;
    if (file.type.startsWith('audio/')) return MusicalNoteIcon;
    if (file.type.startsWith('video/')) return VideoCameraIcon;
    if (file.type.startsWith('image/')) return PhotoIcon;
    return PaperClipIcon;
  };

  const FileIcon = getFileIcon();

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div className="relative group">
        <div className={`
            relative flex flex-col
            bg-zinc-900/80 backdrop-blur-xl
            rounded-2xl border border-zinc-800
            transition-all duration-300
            shadow-2xl shadow-black/50
            ${isGenerating ? 'opacity-80 pointer-events-none' : 'hover:border-zinc-700 hover:shadow-indigo-500/10'}
        `}>
            
            {/* Text Area */}
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Share a thought, a worry, a dream, or a chaotic idea..."
                className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-lg p-6 min-h-[120px] resize-none focus:outline-none rounded-t-2xl"
                disabled={isGenerating || disabled}
            />

            {/* Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-zinc-800/50 bg-black/20 rounded-b-2xl gap-4 sm:gap-0">
                
                {/* Left Controls: Attach + Voice */}
                <div className="flex items-center space-x-2 self-start sm:self-auto">
                    {/* File Attachment */}
                    <div className="flex items-center">
                        <label className={`flex items-center justify-center cursor-pointer transition-colors p-2 rounded-lg hover:bg-zinc-800/50 ${file ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            <PaperClipIcon className="w-5 h-5" />
                            <input
                                type="file"
                                accept="image/*,application/pdf,audio/*,video/*"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={isGenerating || disabled}
                            />
                        </label>
                        {file && (
                            <div className="flex items-center bg-zinc-800/50 rounded px-2 py-1 ml-1 animate-in fade-in zoom-in duration-200">
                                <FileIcon className="w-3 h-3 text-indigo-400 mr-2" />
                                <span className="text-[10px] text-zinc-300 truncate max-w-[80px]">{file.name}</span>
                                <button onClick={() => setFile(null)} className="ml-2 text-zinc-500 hover:text-red-400">x</button>
                            </div>
                        )}
                    </div>

                    {/* Voice Trigger */}
                    <button 
                        onClick={() => onVoiceStart(mode)}
                        disabled={isGenerating || disabled}
                        className="flex items-center justify-center text-zinc-500 hover:text-indigo-400 transition-colors p-2 rounded-lg hover:bg-zinc-800/50"
                        title="Start Voice Session"
                    >
                        <MicrophoneIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Center: Mode Selection */}
                <div className="flex items-center bg-zinc-950/50 p-1 rounded-lg border border-zinc-800/50">
                    <button
                        onClick={() => setMode('Collaborative')}
                        className={`p-1.5 rounded-md transition-all duration-200 ${mode === 'Collaborative' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Collaborative Mode"
                    >
                        <UserGroupIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode('Competitive')}
                        className={`p-1.5 rounded-md transition-all duration-200 ${mode === 'Competitive' ? 'bg-red-500/20 text-red-300 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Competitive Mode"
                    >
                        <ScaleIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode('Hierarchical')}
                        className={`p-1.5 rounded-md transition-all duration-200 ${mode === 'Hierarchical' ? 'bg-amber-500/20 text-amber-300 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        title="Hierarchical Mode"
                    >
                        <TrophyIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1 min-w-[80px] text-center">
                        {mode}
                    </span>
                </div>

                {/* Right: Submit */}
                <button
                    onClick={() => handleSubmit()}
                    disabled={(!text.trim() && !file) || isGenerating || disabled}
                    className={`
                        flex items-center space-x-2 px-6 py-2 rounded-xl font-medium transition-all duration-300 self-end sm:self-auto
                        ${(!text.trim() && !file) || isGenerating 
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <SparklesIcon className="w-5 h-5 animate-spin-slow" />
                            <span>Weaving...</span>
                        </>
                    ) : (
                        <>
                            <span>Weave</span>
                            <PaperAirplaneIcon className="w-5 h-5 -rotate-45 translate-y-[-2px]" />
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
      
      {/* Footer Hints */}
      <div className="flex justify-center mt-6 space-x-6 text-xs text-zinc-600 font-mono uppercase tracking-widest">
        <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500/50 mr-2"></span>Linguist</span>
        <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500/50 mr-2"></span>Spark</span>
        <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-violet-500/50 mr-2"></span>Mystic</span>
      </div>
    </div>
  );
};