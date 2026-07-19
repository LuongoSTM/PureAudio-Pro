import React, { useRef, useEffect, useState } from 'react';
import { BarChart, Activity, Radio, Waves, ShieldAlert, Sparkles, Layers } from 'lucide-react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  originalAnalyser: AnalyserNode | null;
  isPlaying: boolean;
  auditionMode?: 'original' | 'remastered';
  onAuditionModeChange?: (mode: 'original' | 'remastered') => void;
}

type VisualizerMode = 'bars' | 'wave' | 'radial' | 'waterfall';

// Thermodynamic Heat-Map Coloring logic for Waterfall display
const getOriginalWaterfallColor = (intensity: number) => {
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    const r = Math.floor(6 + t * 100);
    const g = Math.floor(6 + t * 10);
    const b = Math.floor(9 + t * 15);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else if (intensity < 0.65) {
    const t = (intensity - 0.25) / 0.4;
    const r = Math.floor(106 + t * 138);
    const g = Math.floor(16 + t * 65);
    const b = Math.floor(24 + t * 6);
    return `rgba(${r}, ${g}, ${b}, 0.9)`;
  } else {
    const t = (intensity - 0.65) / 0.35;
    const r = Math.floor(244 + t * 11);
    const g = Math.floor(81 + t * 174);
    const b = Math.floor(30 + t * 225);
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }
};

const getRemasteredWaterfallColor = (intensity: number) => {
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    const r = Math.floor(6 - t * 6);
    const g = Math.floor(6 + t * 50);
    const b = Math.floor(9 + t * 100);
    return `rgba(${r}, ${g}, ${b}, 0.85)`;
  } else if (intensity < 0.65) {
    const t = (intensity - 0.25) / 0.4;
    const r = 0;
    const g = Math.floor(56 + t * 199);
    const b = Math.floor(109 + t * 103);
    return `rgba(${r}, ${g}, ${b}, 0.9)`;
  } else {
    const t = (intensity - 0.65) / 0.35;
    const r = Math.floor(t * 255);
    const g = Math.floor(255);
    const b = Math.floor(212 + t * 43);
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }
};

export default function Visualizer({ 
  analyser, 
  originalAnalyser, 
  isPlaying,
  auditionMode = 'remastered',
  onAuditionModeChange 
}: VisualizerProps) {
  const canvasOrigRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRemasterRef = useRef<HTMLCanvasElement | null>(null);
  
  const containerOrigRef = useRef<HTMLDivElement | null>(null);
  const containerRemasterRef = useRef<HTMLDivElement | null>(null);
  
  const [mode, setMode] = useState<VisualizerMode>('bars');

  // History buffers for the Waterfall spectrogram
  const historyOrigRef = useRef<Uint8Array[]>([]);
  const historyRemasterRef = useRef<Uint8Array[]>([]);

  // Clear waterfall history when isPlaying changes or when switching modes
  useEffect(() => {
    historyOrigRef.current = [];
    historyRemasterRef.current = [];
  }, [isPlaying, mode]);

  // Resize function for both canvases
  useEffect(() => {
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      
      if (canvasOrigRef.current && containerOrigRef.current) {
        canvasOrigRef.current.width = containerOrigRef.current.clientWidth * dpr;
        canvasOrigRef.current.height = containerOrigRef.current.clientHeight * dpr;
      }
      if (canvasRemasterRef.current && containerRemasterRef.current) {
        canvasRemasterRef.current.width = containerRemasterRef.current.clientWidth * dpr;
        canvasRemasterRef.current.height = containerRemasterRef.current.clientHeight * dpr;
      }
    };

    handleResize();
    const observer1 = new ResizeObserver(handleResize);
    const observer2 = new ResizeObserver(handleResize);
    
    if (containerOrigRef.current) observer1.observe(containerOrigRef.current);
    if (containerRemasterRef.current) observer2.observe(containerRemasterRef.current);

    return () => {
      observer1.disconnect();
      observer2.disconnect();
    };
  }, []);

  // Visualizer Animation Loop for both canvases
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      // --- 1. RENDER ORIGINAL (AMBER) ---
      if (canvasOrigRef.current && containerOrigRef.current) {
        const canvas = canvasOrigRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const dpr = window.devicePixelRatio || 1;

          // Motion blur clear
          ctx.fillStyle = 'rgba(6, 6, 9, 0.28)';
          ctx.fillRect(0, 0, width, height);

          // Subtle horizontal grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.lineWidth = 1;
          for (let y = height / 4; y < height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          if (!isPlaying || !originalAnalyser) {
            // Standby Wave Original (Amber, subtle)
            ctx.lineWidth = 1.5 * dpr;
            ctx.strokeStyle = 'rgba(244, 81, 30, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            const segments = 60;
            const segmentWidth = width / segments;
            for (let i = 0; i <= segments; i++) {
              const x = i * segmentWidth;
              const amplitude = Math.sin(i * 0.15 - Date.now() * 0.0015) * (height * 0.08);
              ctx.lineTo(x, height / 2 + amplitude);
            }
            ctx.stroke();
          } else {
            // Active Original Analysis
            const bufferLength = originalAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            if (mode === 'wave') {
              originalAnalyser.getByteTimeDomainData(dataArray);
              ctx.lineWidth = 2 * dpr;
              ctx.strokeStyle = '#f4511e';
              ctx.beginPath();
              const sliceWidth = width / bufferLength;
              let x = 0;
              for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
              }
              ctx.lineTo(width, height / 2);
              ctx.stroke();
            } else if (mode === 'radial') {
              originalAnalyser.getByteFrequencyData(dataArray);
              const centerX = width / 2;
              const centerY = height / 2;
              const baseRadius = Math.min(width, height) * 0.25;
              const numBars = 80;

              ctx.lineWidth = 1.5 * dpr;
              for (let i = 0; i < numBars; i++) {
                const angle = (i / numBars) * Math.PI * 2;
                const dataIndex = Math.floor((i / numBars) * (bufferLength * 0.65));
                const intensity = dataArray[dataIndex] || 0;
                const barHeight = (intensity / 255) * 45;
                const startX = centerX + Math.cos(angle) * baseRadius;
                const startY = centerY + Math.sin(angle) * baseRadius;
                const endX = centerX + Math.cos(angle) * (baseRadius + barHeight);
                const endY = centerY + Math.sin(angle) * (baseRadius + barHeight);

                ctx.strokeStyle = `rgba(244, 81, 30, ${0.2 + (intensity / 255) * 0.8})`;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
              }
            } else if (mode === 'waterfall') {
              originalAnalyser.getByteFrequencyData(dataArray);
              const maxFreqIndex = Math.floor(bufferLength * 0.65);
              const numSlices = 120;
              const snapshot = new Uint8Array(numSlices);
              for (let s = 0; s < numSlices; s++) {
                const dataIndex = Math.floor((s / numSlices) * maxFreqIndex);
                snapshot[s] = dataArray[dataIndex] || 0;
              }
              historyOrigRef.current.unshift(snapshot);
              if (historyOrigRef.current.length > 75) {
                historyOrigRef.current.pop();
              }
              const history = historyOrigRef.current;
              const rowHeight = height / 75;
              const sliceWidth = width / numSlices;
              for (let y = 0; y < history.length; y++) {
                const row = history[y];
                const yPos = y * rowHeight;
                for (let x = 0; x < numSlices; x++) {
                  const intensity = row[x] / 255;
                  if (intensity > 0.02) {
                    ctx.fillStyle = getOriginalWaterfallColor(intensity);
                    ctx.fillRect(x * sliceWidth, yPos, sliceWidth + 0.5, rowHeight + 0.5);
                  }
                }
              }
            } else {
              // BARS
              originalAnalyser.getByteFrequencyData(dataArray);
              const barWidth = (width / bufferLength) * 2.2;
              let x = 0;
              for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height * 0.82;
                const origGrad = ctx.createLinearGradient(0, height, 0, height - barHeight);
                origGrad.addColorStop(0, 'rgba(244, 81, 30, 0.15)');
                origGrad.addColorStop(1, '#f4511e');
                
                ctx.fillStyle = origGrad;
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, 1);
                ctx.fill();
                x += barWidth;
              }
            }
          }
        }
      }

      // --- 2. RENDER REMASTER (MINT/CYAN) ---
      if (canvasRemasterRef.current && containerRemasterRef.current) {
        const canvas = canvasRemasterRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const dpr = window.devicePixelRatio || 1;

          // Motion blur clear
          ctx.fillStyle = 'rgba(6, 6, 9, 0.28)';
          ctx.fillRect(0, 0, width, height);

          // Subtle horizontal grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.lineWidth = 1;
          for (let y = height / 4; y < height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          if (!isPlaying || !analyser) {
            // Standby Wave Remastered (Mint, subtle)
            ctx.lineWidth = 1.5 * dpr;
            ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            const segments = 60;
            const segmentWidth = width / segments;
            for (let i = 0; i <= segments; i++) {
              const x = i * segmentWidth;
              const amplitude = Math.sin(i * 0.18 + Date.now() * 0.002) * (height * 0.1);
              ctx.lineTo(x, height / 2 + amplitude);
            }
            ctx.stroke();
          } else {
            // Active Remastered Analysis
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            if (mode === 'wave') {
              analyser.getByteTimeDomainData(dataArray);
              ctx.lineWidth = 2.5 * dpr;
              ctx.strokeStyle = '#00f5d4';
              ctx.beginPath();
              const sliceWidth = width / bufferLength;
              let x = 0;
              for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
              }
              ctx.lineTo(width, height / 2);
              ctx.stroke();
            } else if (mode === 'radial') {
              analyser.getByteFrequencyData(dataArray);
              const centerX = width / 2;
              const centerY = height / 2;
              const baseRadius = Math.min(width, height) * 0.25;
              const numBars = 80;

              ctx.lineWidth = 1.5 * dpr;
              for (let i = 0; i < numBars; i++) {
                const angle = (i / numBars) * Math.PI * 2;
                const dataIndex = Math.floor((i / numBars) * (bufferLength * 0.65));
                const intensity = dataArray[dataIndex] || 0;
                const barHeight = (intensity / 255) * 45;
                const startX = centerX + Math.cos(angle) * baseRadius;
                const startY = centerY + Math.sin(angle) * baseRadius;
                const endX = centerX + Math.cos(angle) * (baseRadius + barHeight);
                const endY = centerY + Math.sin(angle) * (baseRadius + barHeight);

                ctx.strokeStyle = `rgba(0, 245, 212, ${0.3 + (intensity / 255) * 0.7})`;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
              }
            } else if (mode === 'waterfall') {
              analyser.getByteFrequencyData(dataArray);
              const maxFreqIndex = Math.floor(bufferLength * 0.65);
              const numSlices = 120;
              const snapshot = new Uint8Array(numSlices);
              for (let s = 0; s < numSlices; s++) {
                const dataIndex = Math.floor((s / numSlices) * maxFreqIndex);
                snapshot[s] = dataArray[dataIndex] || 0;
              }
              historyRemasterRef.current.unshift(snapshot);
              if (historyRemasterRef.current.length > 75) {
                historyRemasterRef.current.pop();
              }
              const history = historyRemasterRef.current;
              const rowHeight = height / 75;
              const sliceWidth = width / numSlices;
              for (let y = 0; y < history.length; y++) {
                const row = history[y];
                const yPos = y * rowHeight;
                for (let x = 0; x < numSlices; x++) {
                  const intensity = row[x] / 255;
                  if (intensity > 0.02) {
                    ctx.fillStyle = getRemasteredWaterfallColor(intensity);
                    ctx.fillRect(x * sliceWidth, yPos, sliceWidth + 0.5, rowHeight + 0.5);
                  }
                }
              }
            } else {
              // BARS
              analyser.getByteFrequencyData(dataArray);
              const barWidth = (width / bufferLength) * 2.2;
              let x = 0;
              for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height * 0.82;
                const remGrad = ctx.createLinearGradient(0, height, 0, height - barHeight);
                remGrad.addColorStop(0, 'rgba(0, 245, 212, 0.15)');
                remGrad.addColorStop(1, '#00f5d4');
                
                ctx.fillStyle = remGrad;
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, 1);
                ctx.fill();
                x += barWidth;
              }
            }
          }
        }
      }
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, originalAnalyser, isPlaying, mode]);

  return (
    <div id="visualizer_super_container" className="flex flex-col gap-3 w-full shrink-0">
      {/* Universal Mode Selector & Info */}
      <div className="flex items-center justify-between bg-brand-card border border-brand-border px-3 py-2 rounded">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-white uppercase">Analisi Spettrale in Tempo Reale</span>
        </div>
        
        {/* Toggle Mode Buttons */}
        <div className="flex items-center gap-1 bg-black/60 border border-[#1a1a24] p-0.5 rounded text-[#73737d]">
          <button
            id="v_mode_bars"
            onClick={() => setMode('bars')}
            className={`p-1 rounded transition-all duration-200 ${
              mode === 'bars' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20 font-bold' : 'hover:text-white border border-transparent'
            }`}
            title="Spettro a Barre"
          >
            <BarChart className="w-3 h-3" />
          </button>
          <button
            id="v_mode_wave"
            onClick={() => setMode('wave')}
            className={`p-1 rounded transition-all duration-200 ${
              mode === 'wave' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20 font-bold' : 'hover:text-white border border-transparent'
            }`}
            title="Forma d'Onda"
          >
            <Activity className="w-3 h-3" />
          </button>
          <button
            id="v_mode_radial"
            onClick={() => setMode('radial')}
            className={`p-1 rounded transition-all duration-200 ${
              mode === 'radial' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20 font-bold' : 'hover:text-white border border-transparent'
            }`}
            title="Spettro Orbitale"
          >
            <Radio className="w-3 h-3" />
          </button>
          <button
            id="v_mode_waterfall"
            onClick={() => setMode('waterfall')}
            className={`p-1 rounded transition-all duration-200 ${
              mode === 'waterfall' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20 font-bold' : 'hover:text-white border border-transparent'
            }`}
            title="Cascata Spettrale (Waterfall)"
          >
            <Layers className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Two Spectrogram Boxes (Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Box 1: Original Audio Source */}
        <button
          type="button"
          id="visualizer_box_original"
          onClick={() => onAuditionModeChange?.('original')}
          className={`relative bg-[#070709] rounded-lg text-left overflow-hidden flex flex-col shadow-lg transition-all duration-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#f4511e]/50 ${
            auditionMode === 'original'
              ? 'border-2 border-[#f4511e] shadow-[#f4511e]/15 shadow-xl scale-[1.01]'
              : 'border border-[#1a1a24]/80 opacity-60 hover:opacity-100 hover:border-[#f4511e]/40'
          }`}
        >
          <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 select-none pointer-events-none">
            <span className={`w-1.5 h-1.5 rounded-full bg-[#f4511e] ${auditionMode === 'original' ? 'animate-ping' : ''}`} />
            <span className="text-[9px] font-mono font-bold text-white tracking-wider uppercase">Segnale Originale (Bypass)</span>
            {auditionMode === 'original' && (
              <span className="text-[7px] font-mono font-bold bg-[#f4511e]/20 text-[#f4511e] px-1 py-0.5 rounded border border-[#f4511e]/30">ASCOLTO ATTIVO</span>
            )}
          </div>
          <div className="absolute top-2 right-3 z-10 text-[8px] font-mono text-brand-muted uppercase select-none pointer-events-none">
            Raw Input
          </div>

          {/* Canvas Container */}
          <div ref={containerOrigRef} className="w-full h-[105px] md:h-[120px] relative bg-black/40">
            <canvas ref={canvasOrigRef} className="absolute inset-0 w-full h-full block" />
            
            {/* Click to listen overlay hint on hover when inactive */}
            {auditionMode !== 'original' && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-[10px] font-mono font-bold bg-black/80 border border-[#f4511e]/30 px-2 py-1 rounded text-[#f4511e] tracking-wider uppercase">Clicca per Ascolto Originale</span>
              </div>
            )}
          </div>

          {/* Specs Bar */}
          <div className="bg-[#0b0b0e] border-t border-[#1a1a24] px-3 py-1.5 flex items-center justify-between text-[8px] font-mono text-neutral-400 select-none pointer-events-none">
            <span className="flex items-center gap-1 text-[#f4511e]/90"><ShieldAlert className="w-2.5 h-2.5" /> Non Ottimizzato</span>
            <span>Bypass Completo</span>
          </div>
        </button>

        {/* Box 2: Remastered High Quality */}
        <button
          type="button"
          id="visualizer_box_remaster"
          onClick={() => onAuditionModeChange?.('remastered')}
          className={`relative bg-[#070709] rounded-lg text-left overflow-hidden flex flex-col shadow-lg transition-all duration-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#00f5d4]/50 ${
            auditionMode === 'remastered'
              ? 'border-2 border-[#00f5d4] shadow-[#00f5d4]/15 shadow-xl scale-[1.01]'
              : 'border border-[#1a1a24]/80 opacity-60 hover:opacity-100 hover:border-[#00f5d4]/40'
          }`}
        >
          <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 select-none pointer-events-none">
            <span className={`w-1.5 h-1.5 rounded-full bg-[#00f5d4] ${auditionMode === 'remastered' ? 'animate-pulse' : ''}`} />
            <span className="text-[9px] font-mono font-bold text-[#00f5d4] tracking-wider uppercase">PureAudio™ Elaborato</span>
            {auditionMode === 'remastered' && (
              <span className="text-[7px] font-mono font-bold bg-[#00f5d4]/20 text-[#00f5d4] px-1 py-0.5 rounded border border-[#00f5d4]/30">ASCOLTO ATTIVO</span>
            )}
          </div>
          <div className="absolute top-2 right-3 z-10 text-[8px] font-mono text-[#00f5d4]/70 uppercase select-none pointer-events-none">
            Remaster Output
          </div>

          {/* Canvas Container */}
          <div ref={containerRemasterRef} className="w-full h-[105px] md:h-[120px] relative bg-black/40">
            <canvas ref={canvasRemasterRef} className="absolute inset-0 w-full h-full block" />
            
            {/* Click to listen overlay hint on hover when inactive */}
            {auditionMode !== 'remastered' && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-[10px] font-mono font-bold bg-black/80 border border-[#00f5d4]/30 px-2 py-1 rounded text-[#00f5d4] tracking-wider uppercase">Clicca per Ascolto Elaborato</span>
              </div>
            )}
          </div>

          {/* Specs Bar */}
          <div className="bg-[#0b0b0e] border-t border-[#1a1a24] px-3 py-1.5 flex items-center justify-between text-[8px] font-mono text-[#00f5d4]/90 select-none pointer-events-none">
            <span className="flex items-center gap-1 text-[#00f5d4]/90"><Sparkles className="w-2.5 h-2.5" /> Remaster Attivo</span>
            <span className="text-[#00f5d4]/80">DSP 10-Band + Limiter</span>
          </div>
        </button>

      </div>
    </div>
  );
}
