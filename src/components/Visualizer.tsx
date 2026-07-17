import React, { useRef, useEffect, useState } from 'react';
import { BarChart, Activity, Radio } from 'lucide-react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

type VisualizerMode = 'bars' | 'wave' | 'radial';

export default function Visualizer({ analyser, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('bars');

  // Resize canvas to match the parent container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth * (window.devicePixelRatio || 1);
        canvasRef.current.height = containerRef.current.clientHeight * (window.devicePixelRatio || 1);
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Visualizer Animation Loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 256;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      
      // Clear with very slight transparency to create a tail-fade effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (!analyser || !isPlaying) {
        // Draw standard idle waveform
        ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)'; // Mint Accent
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        const segments = 100;
        const segmentWidth = width / segments;

        for (let i = 0; i <= segments; i++) {
          const x = i * segmentWidth;
          const amplitude = isPlaying ? 0 : Math.sin(i * 0.15 + Date.now() * 0.003) * (height * 0.04);
          ctx.lineTo(x, height / 2 + amplitude);
        }
        ctx.stroke();
        return;
      }

      if (mode === 'bars') {
        // Neon Bars Frequency Visualizer
        analyser.getByteFrequencyData(dataArray);
        
        const barWidth = (width / bufferLength) * 2.2;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * height * 0.85;

          // Generate gradient color based on frequency index - mint to dark green
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, '#00f5d4'); // Elegant mint
          gradient.addColorStop(1, '#006b5d'); // Deep forest/mint green

          ctx.fillStyle = gradient;
          
          // Draw rounded bars
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, 1);
          ctx.fill();

          // Optional subtle glow for loud frequencies
          if (dataArray[i] > 200) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(x, height - barHeight, barWidth - 1, 2);
            ctx.shadowBlur = 0;
          }

          x += barWidth;
        }
      } else if (mode === 'wave') {
        // Sonic Wave Time Domain Oscilloscope
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1);
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
        
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#00f5d4'); // Mint
        gradient.addColorStop(1, '#006b5d'); // Dark green
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // range [0, 2]
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow
      } else if (mode === 'radial') {
        // Radial Vortex / Circle spectrum
        analyser.getByteFrequencyData(dataArray);

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        // Draw center core glowing sphere
        const averageFreq = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        const pulseRadius = baseRadius + (averageFreq / 255) * 20;

        const sphereGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulseRadius);
        sphereGrad.addColorStop(0, 'rgba(0, 245, 212, 0.15)'); // Mint glow
        sphereGrad.addColorStop(1, 'rgba(5, 5, 5, 0)');
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw circular frequency lines
        const numBars = 120;
        ctx.lineWidth = 2 * (window.devicePixelRatio || 1);

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2;
          const dataIndex = Math.floor((i / numBars) * (bufferLength * 0.7)); // Focus on bass/mids
          const intensity = dataArray[dataIndex] || 0;
          const barHeight = (intensity / 255) * 65;

          const startX = centerX + Math.cos(angle) * baseRadius;
          const startY = centerY + Math.sin(angle) * baseRadius;
          const endX = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const endY = centerY + Math.sin(angle) * (baseRadius + barHeight);

          // Spectrum bar coloring from mint to dark green
          ctx.strokeStyle = `rgba(0, 245, 212, ${0.25 + (intensity / 255) * 0.75})`;

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, isPlaying, mode]);

  return (
    <div id="visualizer_container" className="relative w-full h-full bg-[#0a0a0a] rounded border border-[#1a1a1a] overflow-hidden flex flex-col">
      {/* Title & Controls Overlay */}
      <div id="visualizer_header" className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between select-none pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse" />
          <span className="text-[10px] font-mono font-medium text-white tracking-widest uppercase">Spettrogramma Aura in Tempo Reale</span>
        </div>
        
        {/* Toggle Mode Buttons */}
        <div className="flex items-center gap-1 bg-[#050505] border border-[#1a1a1a] p-0.5 rounded text-[#737373]">
          <button
            id="v_mode_bars"
            onClick={() => setMode('bars')}
            className={`p-1.5 rounded-sm transition-all duration-200 ${
              mode === 'bars' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20' : 'hover:text-white border border-transparent'
            }`}
            title="Spettro a Barre"
          >
            <BarChart className="w-3.5 h-3.5" />
          </button>
          <button
            id="v_mode_wave"
            onClick={() => setMode('wave')}
            className={`p-1.5 rounded-sm transition-all duration-200 ${
              mode === 'wave' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20' : 'hover:text-white border border-transparent'
            }`}
            title="Forma d'Onda"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            id="v_mode_radial"
            onClick={() => setMode('radial')}
            className={`p-1.5 rounded-sm transition-all duration-200 ${
              mode === 'radial' ? 'bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/20' : 'hover:text-white border border-transparent'
            }`}
            title="Spettro Orbitale"
          >
            <Radio className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full relative min-h-[140px] md:min-h-[200px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </div>
    </div>
  );
}
