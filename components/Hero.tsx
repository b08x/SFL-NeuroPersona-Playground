/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon, SparklesIcon, CircleStackIcon, BoltIcon, FingerPrintIcon } from '@heroicons/react/24/outline';
import { LightBulbIcon, EyeIcon, UserCircleIcon } from '@heroicons/react/24/solid';

// Component that simulates drawing a wireframe then filling it with life
const DrawingTransformation = ({ 
  initialIcon: InitialIcon, 
  finalIcon: FinalIcon, 
  label,
  delay, 
  x, 
  y,
  rotation = 0,
  color = "text-blue-500"
}: { 
  initialIcon: React.ElementType, 
  finalIcon: React.ElementType, 
  label: string,
  delay: number,
  x: string,
  y: string,
  rotation?: number,
  color?: string
}) => {
  const [stage, setStage] = useState(0); // 0: Hidden, 1: Drawing, 2: Alive

  useEffect(() => {
    const cycle = () => {
      setStage(0);
      setTimeout(() => setStage(1), 500); // Start drawing
      setTimeout(() => setStage(2), 3500); // Come alive
    };

    // Initial delay
    const startTimeout = setTimeout(() => {
      cycle();
      // Repeat cycle
      const interval = setInterval(cycle, 9000);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [delay]);

  return (
    <div 
      className="absolute transition-all duration-1000 ease-in-out z-0 pointer-events-none"
      style={{ top: y, left: x, transform: `rotate(${rotation}deg)` }}
    >
      <div className={`relative w-20 h-28 md:w-28 md:h-40 rounded-lg backdrop-blur-md transition-all duration-1000 ${stage === 2 ? 'bg-zinc-800/40 border-zinc-500/50 shadow-xl scale-110 -translate-y-4' : 'bg-zinc-900/10 border-zinc-800 scale-100 border border-dashed'}`}>
        
        {/* Label tag that appears in stage 2 */}
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-100 text-zinc-900 border border-zinc-200 text-[8px] md:text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm transition-all duration-500 ${stage === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            {label}
        </div>

        {/* Content Container */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          
          {/* Stage 1: Wireframe Drawing Effect */}
          <div className={`absolute transition-all duration-1000 ${stage === 1 ? 'opacity-100' : 'opacity-0'}`}>
             <InitialIcon className="w-8 h-8 md:w-12 md:h-12 text-zinc-600 stroke-1" />
          </div>

          {/* Stage 2: Alive/Interactive */}
          <div className={`absolute transition-all duration-700 flex flex-col items-center ${stage === 2 ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-75 blur-sm'}`}>
             <FinalIcon className={`w-10 h-10 md:w-14 md:h-14 ${color}`} />
             {stage === 2 && (
               <div className="mt-3 flex items-center gap-2 px-2 py-1 bg-zinc-900/80 rounded-full border border-zinc-700/50">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                 <div className="text-[9px] text-zinc-400 font-mono">ACTIVE</div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Hero: React.FC = () => {
  return (
    <>
      {/* Background Transformation Elements - Fixed to Viewport */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        
        {/* SFL / Linguist */}
        <div className="hidden lg:block">
            <DrawingTransformation 
            initialIcon={ChatBubbleLeftRightIcon} 
            finalIcon={EyeIcon} 
            label="LINGUIST"
            delay={0} 
            x="5%" 
            y="15%"
            rotation={-5} 
            color="text-emerald-400"
            />
        </div>

        {/* ADHD / Spark */}
        <div className="hidden md:block">
            <DrawingTransformation 
            initialIcon={BoltIcon} 
            finalIcon={SparklesIcon} 
            label="SPARK"
            delay={2500} 
            x="85%" 
            y="20%"
            rotation={5}
            color="text-amber-400" 
            />
        </div>

        {/* INFJ / Mystic */}
        <div className="hidden lg:block">
            <DrawingTransformation 
            initialIcon={FingerPrintIcon} 
            finalIcon={UserCircleIcon} 
            label="MYSTIC"
            delay={5000} 
            x="80%" 
            y="75%"
            rotation={-3} 
            color="text-violet-400"
            />
        </div>

        {/* Memory / Database */}
        <div className="hidden md:block">
            <DrawingTransformation 
            initialIcon={CircleStackIcon} 
            finalIcon={CircleStackIcon} 
            label="MEMORY"
            delay={3500} 
            x="10%" 
            y="70%"
            rotation={2}
            color="text-indigo-400"
            />
        </div>
      </div>

      {/* Hero Text Content */}
      <div className="text-center relative z-10 max-w-5xl mx-auto px-4 pt-8">
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">
          SFL NeuroPersona <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Playground</span>
        </h1>
        <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
          A multi-agent cognitive simulation. Explore your thoughts through the lens of <span className="text-emerald-400 font-medium">Linguistics</span>, <span className="text-amber-400 font-medium">ADHD</span>, and <span className="text-violet-400 font-medium">INFJ</span> intuition.
        </p>
      </div>
    </>
  );
};