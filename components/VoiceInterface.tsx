/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { LiveServerMessage, Blob } from '@google/genai';
import { connectLiveSession } from '../services/gemini';
import { MicrophoneIcon, XMarkIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { CollaborationMode } from './InputArea';

interface VoiceInterfaceProps {
  active: boolean;
  mode: CollaborationMode;
  onClose: () => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ active, mode, onClose }) => {
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [voiceState, setVoiceState] = useState<"listening" | "speaking" | "idle">("idle");
  
  // Transcription State
  const [transcript, setTranscript] = useState<{ text: string; source: 'user' | 'ai' } | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Timeout for clearing transcript
  const transcriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      startSession();
    } else {
      stopSession();
    }
    return () => stopSession();
  }, [active, mode]); // Re-connect if mode changes while active

  // Fade out transcript after inactivity
  useEffect(() => {
    if (transcript) {
        if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
        transcriptTimeoutRef.current = setTimeout(() => {
            setTranscript(null);
        }, 4000); // Clear after 4 seconds
    }
  }, [transcript]);

  const startSession = async () => {
    setStatus("connecting");
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // --- Output Setup ---
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      
      const outAnalyser = ctx.createAnalyser();
      outAnalyser.fftSize = 512;
      outAnalyser.smoothingTimeConstant = 0.7; // Smooth falloff
      outAnalyser.connect(ctx.destination);
      outputAnalyserRef.current = outAnalyser;

      // --- Input Setup ---
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const source = inputCtx.createMediaStreamSource(stream);
      
      const inAnalyser = inputCtx.createAnalyser();
      inAnalyser.fftSize = 512;
      inAnalyser.smoothingTimeConstant = 0.5;
      inputAnalyserRef.current = inAnalyser;

      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        if (isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        sessionRef.current?.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      // Chain: Source -> Analyser -> ScriptProcessor -> Destination
      source.connect(inAnalyser);
      inAnalyser.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination); // Needed for processing to happen
      inputNodeRef.current = scriptProcessor;

      // --- Start Visualization Loop ---
      renderVisualizer();

      // --- Connect to Gemini Live ---
      sessionRef.current = connectLiveSession({
        onopen: () => {
          setStatus("connected");
          console.log("Live Session Connected");
        },
        onmessage: async (msg: LiveServerMessage) => {
          handleServerMessage(msg, ctx, outAnalyser);
        },
        onclose: () => {
          console.log("Live Session Closed");
        },
        onerror: (err: any) => {
          console.error("Live Session Error", err);
          setStatus("error");
        }
      }, mode);

    } catch (e) {
      console.error("Failed to start voice session", e);
      setStatus("error");
    }
  };

  const stopSession = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (inputNodeRef.current) {
        inputNodeRef.current.disconnect();
        inputNodeRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    sessionRef.current = null;
    setStatus("connecting");
    setVoiceState("idle");
    setTranscript(null);
  };

  const handleServerMessage = async (message: LiveServerMessage, ctx: AudioContext, outAnalyser: AnalyserNode) => {
    const { serverContent } = message;
    
    // 1. Handle Audio
    const modelTurn = serverContent?.modelTurn;
    if (modelTurn?.parts?.[0]?.inlineData?.data) {
        const base64Audio = modelTurn.parts[0].inlineData.data;
        const audioData = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, ctx);
        playAudio(audioBuffer, ctx, outAnalyser);
    }

    // 2. Handle Text Transcription
    const outputText = serverContent?.outputTranscription?.text;
    const inputText = serverContent?.inputTranscription?.text;

    if (outputText) {
        setTranscript(prev => ({
            source: 'ai',
            text: (prev?.source === 'ai' ? prev.text : '') + outputText
        }));
    } else if (inputText) {
        setTranscript(prev => ({
            source: 'user',
            text: (prev?.source === 'user' ? prev.text : '') + inputText
        }));
    }
  };

  const playAudio = (buffer: AudioBuffer, ctx: AudioContext, analyser: AnalyserNode) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Connect through the analyser to destination
    source.connect(analyser);
    // analyser is already connected to destination in setup

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    
    sourcesRef.current.add(source);
    source.onended = () => sourcesRef.current.delete(source);
  };

  // --- Visualization Logic ---
  const renderVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3.5; // Base radius

    // Data arrays
    const inData = new Uint8Array(inputAnalyserRef.current?.frequencyBinCount || 0);
    const outData = new Uint8Array(outputAnalyserRef.current?.frequencyBinCount || 0);

    inputAnalyserRef.current?.getByteFrequencyData(inData);
    outputAnalyserRef.current?.getByteFrequencyData(outData);

    // Calculate Average Energy to determine state
    const inEnergy = inData.reduce((a, b) => a + b, 0) / inData.length;
    const outEnergy = outData.reduce((a, b) => a + b, 0) / outData.length;

    // Determine Logic State for UI
    if (outEnergy > 10) setVoiceState("speaking");
    else if (inEnergy > 10) setVoiceState("listening");
    else setVoiceState("idle");

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Use the dominant data source for visualization
    const isOutputDominant = outEnergy > 5;
    const data = isOutputDominant ? outData : inData;
    const primaryColor = isOutputDominant ? [139, 92, 246] : [16, 185, 129]; // Violet vs Emerald
    const secondaryColor = isOutputDominant ? [236, 72, 153] : [245, 158, 11]; // Pink vs Amber

    // Draw Circular Bars
    const barCount = 64; 
    const step = Math.floor(data.length / barCount);
    
    ctx.save();
    ctx.translate(centerX, centerY);

    for (let i = 0; i < barCount; i++) {
        const value = data[i * step];
        const percent = value / 255;
        const barHeight = radius * 0.5 * percent * (isOutputDominant ? 1.5 : 1.0); 
        
        const angle = (Math.PI * 2 * i) / barCount;
        
        ctx.rotate(angle);
        
        // Dynamic Color
        const r = primaryColor[0] + (secondaryColor[0] - primaryColor[0]) * percent;
        const g = primaryColor[1] + (secondaryColor[1] - primaryColor[1]) * percent;
        const b = primaryColor[2] + (secondaryColor[2] - primaryColor[2]) * percent;
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        
        drawRoundedRect(ctx, -2, radius + 5, 4, barHeight + 5, 2);
        
        ctx.rotate(-angle);
    }
    
    // Draw Center Glow
    const glowSize = radius * 0.8 + (isOutputDominant ? outEnergy : inEnergy) * 0.5;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, glowSize);
    gradient.addColorStop(0, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0.8)`);
    gradient.addColorStop(1, `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw Center Icon Placeholder
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "#18181b"; // zinc-900
    ctx.fill();
    ctx.strokeStyle = `rgba(${primaryColor[0]}, ${primaryColor[1]}, ${primaryColor[2]}, 0.5)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(renderVisualizer);
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // --- Utilities ---
  function createPcmBlob(data: Float32Array): Blob {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return {
        data: uint8ArrayToBase64(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToUint8Array(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const sampleRate = 24000;
    const numChannels = 1;
    const data16 = new Int16Array(data.buffer);
    const float32 = new Float32Array(data16.length);
    for(let i=0; i<data16.length; i++) float32[i] = data16[i] / 32768.0;
    const buffer = ctx.createBuffer(numChannels, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    return buffer;
  }

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
        
        {/* Status Indicator */}
        <div className="absolute top-12 flex flex-col items-center space-y-3 z-10">
            <h2 className="text-zinc-500 font-medium tracking-[0.2em] uppercase text-xs">Neural Interface</h2>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${
                status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 
                voiceState === 'speaking' ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' :
                voiceState === 'listening' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                'bg-zinc-800/50 border-zinc-700 text-zinc-400'
            }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                    status === 'error' ? 'bg-red-500' : 
                    voiceState === 'speaking' ? 'bg-violet-500 animate-pulse' :
                    voiceState === 'listening' ? 'bg-emerald-500 animate-pulse' :
                    'bg-zinc-500'
                }`}></div>
                <span className="text-xs font-mono">
                    {status === 'connecting' ? 'ESTABLISHING LINK...' :
                     status === 'error' ? 'CONNECTION LOST' :
                     voiceState === 'speaking' ? 'TRANSMITTING' :
                     voiceState === 'listening' ? 'RECEIVING INPUT' :
                     'OPEN CHANNEL'}
                </span>
            </div>
        </div>

        {/* Canvas Visualizer */}
        <div className="relative flex items-center justify-center w-[400px] h-[400px]">
            <canvas 
                ref={canvasRef} 
                width={800} 
                height={800} 
                className="w-full h-full"
            />
            {/* Center Icon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <MicrophoneIcon className={`w-8 h-8 transition-colors duration-300 ${
                    voiceState === 'speaking' ? 'text-violet-400' :
                    voiceState === 'listening' ? 'text-emerald-400' :
                    'text-zinc-600'
                }`} />
            </div>
        </div>

        {/* Dynamic Subtitles / Transcription */}
        <div className="h-32 flex flex-col items-center justify-start px-8 max-w-3xl w-full relative z-20">
             <div className={`transition-all duration-500 ease-out transform ${transcript ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {transcript && (
                    <div className="text-center">
                        <span className={`inline-block px-4 py-2 rounded-xl text-xl md:text-2xl font-medium tracking-tight bg-black/40 backdrop-blur-sm border border-white/5 ${
                            transcript.source === 'ai' 
                                ? 'text-violet-200 shadow-[0_0_30px_rgba(139,92,246,0.1)]' 
                                : 'text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                        }`}>
                            {transcript.text}
                        </span>
                    </div>
                )}
             </div>
             
             {/* Fallback Idle Text when no transcript */}
             {!transcript && (
                 <div className="absolute top-0 w-full text-center transition-opacity duration-700 delay-300">
                    <p className={`text-lg font-light transition-opacity duration-500 ${voiceState === 'speaking' ? 'opacity-40 text-violet-200' : 'opacity-0'}`}>
                        "I am listening through the weave..."
                    </p>
                    <p className={`text-lg font-light transition-opacity duration-500 ${voiceState === 'listening' ? 'opacity-40 text-emerald-200' : 'opacity-0'} -mt-7`}>
                        Listening...
                    </p>
                 </div>
             )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-12 flex items-center space-x-8 z-30">
            <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-full border transition-all duration-300 ${isMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'}`}
                title="Mute Microphone"
            >
                {isMuted ? <SpeakerXMarkIcon className="w-6 h-6" /> : <SpeakerWaveIcon className="w-6 h-6" />}
            </button>

            <button 
                onClick={onClose}
                className="group p-4 rounded-full bg-zinc-100 hover:bg-white text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 transition-all duration-300"
                title="End Session"
            >
                <XMarkIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
            </button>
        </div>

    </div>
  );
};