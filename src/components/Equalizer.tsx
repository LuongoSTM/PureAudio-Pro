import React from 'react';
import { Sliders, RotateCcw, Zap, Music, ChevronDown, Power, Sparkles, RefreshCw, Plus, Minus } from 'lucide-react';
import { EqBand, PresetName, EqPreset } from '../types';

interface EqualizerProps {
  bands: EqBand[];
  setBandGain: (index: number, gain: number) => void;
  applyPreset: (presetGains: number[]) => void;
  isEqBypassed: boolean;
  setIsEqBypassed: (bypassed: boolean) => void;
}

const PRESETS: EqPreset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [7, 6, 5, 2, 0, -1, -2, -2, 0, 1] },
  { name: 'Treble Boost', gains: [-3, -2, -2, -1, 1, 2, 4, 6, 7, 6] },
  { name: 'Vocal Clarifier', gains: [-4, -3, -1, 1, 3, 5, 4, 3, 1, -2] },
  { name: 'Electronic', gains: [6, 4, 2, 0, -2, 1, 3, 4, 5, 6] },
];

const GENRE_PRESETS: { name: PresetName; gains: number[] }[] = [
  { name: 'Jazz', gains: [4, 2, 0, 2, 1, -1, 0, 1.5, 3, 2] },
  { name: 'Rock', gains: [5, 3, 1, -1, -2, -1, 1, 2, 4, 5] },
  { name: 'Classical', gains: [4, 2.5, 1.5, 1, -1, -1, 0, 2, 3, 2] },
  { name: 'Pop', gains: [-2, -1, 1, 3, 4, 3, 1, -1, -1.5, -2] },
  { name: 'Hip-Hop', gains: [5.5, 4.5, 3, 1, -1, 0.5, 2, 1.5, 3, 4] },
  { name: 'Metal', gains: [4.5, 3.5, 2, -1, -2.5, -1, 1.5, 3, 4.5, 3] },
  { name: 'Electronic', gains: [6, 4.5, 2, 0, -2, 1.5, 3, 4, 5, 5.5] },
  { name: 'Reggae', gains: [0, 1.5, 3, 0, -1.5, 1.5, 3, 2, 1, 0] },
  { name: 'Country', gains: [1.5, 1, 0, 1.5, 2, 1.5, 3, 2.5, 1.5, 1] },
  { name: 'R&B', gains: [3.5, 5, 3.5, -1, -1.5, 1.5, 2.5, 2, 3, 3.5] },
];

export default function Equalizer({
  bands,
  setBandGain,
  applyPreset,
  isEqBypassed,
  setIsEqBypassed,
}: EqualizerProps) {
  const [activePreset, setActivePreset] = React.useState<PresetName>('Flat');

  const handlePresetSelect = (preset: EqPreset) => {
    if (isEqBypassed) return;
    setActivePreset(preset.name);
    applyPreset(preset.gains);
  };

  const handleGenreSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isEqBypassed) return;
    const genreName = e.target.value as PresetName;
    if (genreName) {
      const found = GENRE_PRESETS.find((gp) => gp.name === genreName);
      if (found) {
        setActivePreset(found.name);
        applyPreset(found.gains);
      }
    }
  };

  const handleSliderChange = (index: number, val: number) => {
    if (isEqBypassed) return;
    // Limit gain between -12 and +12
    const clampedVal = Math.max(-12, Math.min(12, Math.round(val * 2) / 2));
    setBandGain(index, clampedVal);
    setActivePreset('Custom');
  };

  const resetEqualizer = () => {
    if (isEqBypassed) return;
    setActivePreset('Flat');
    applyPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  };

  const smoothEqualizer = () => {
    if (isEqBypassed) return;
    const smoothedGains = bands.map((band, idx) => {
      const prev = bands[idx - 1]?.gain ?? band.gain;
      const next = bands[idx + 1]?.gain ?? band.gain;
      // Weighted sliding average to smooth transitions
      const avg = (prev + band.gain * 2 + next) / 4;
      return Math.round(avg * 2) / 2; // snap to nearest 0.5dB
    });
    applyPreset(smoothedGains);
    setActivePreset('Custom');
  };

  const invertEqualizer = () => {
    if (isEqBypassed) return;
    const invertedGains = bands.map((band) => -band.gain);
    applyPreset(invertedGains);
    setActivePreset('Custom');
  };

  // Find if activePreset matches a genre to set dropdown's value
  const isGenreActive = GENRE_PRESETS.some((gp) => gp.name === activePreset);
  const selectedGenreValue = isGenreActive ? activePreset : '';

  // Generate smooth SVG curve path from the 10 bands
  const generateCurvePath = () => {
    const width = 500;
    const height = 100;
    const paddingX = 25;
    const stepX = (width - paddingX * 2) / 9;

    const points = bands.map((band, idx) => {
      const x = paddingX + idx * stepX;
      // map gain (-12dB to +12dB) to y coordinate (height - 10 to 10)
      const gainVal = isEqBypassed ? 0 : band.gain;
      const normalizedGain = (gainVal + 12) / 24; // 0 to 1
      const y = height - (normalizedGain * (height - 20) + 10);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Connect points using cubic Bezier curve for organic feel
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + stepX / 2;
      const cpY1 = p0.y;
      const cpX2 = p1.x - stepX / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  return (
    <div id="equalizer_panel" className="bg-brand-card/40 backdrop-blur-md rounded-xl border border-brand-border/80 p-5 flex flex-col gap-5 relative shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-full">
      
      {/* Equalizer Title & Power / Bypass Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded border transition-all duration-300 ${
            isEqBypassed 
              ? 'bg-neutral-800 border-neutral-700 text-neutral-500' 
              : 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'
          }`}>
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Equalizzatore Parametrico</h3>
            <p className="text-xs text-brand-muted mt-0.5">Modella le frequenze con precisione millimetrica</p>
          </div>
        </div>

        {/* Master Bypass Module */}
        <button
          id="btn_eq_power"
          onClick={() => setIsEqBypassed(!isEqBypassed)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold tracking-wider uppercase rounded border transition-all duration-200 cursor-pointer ${
            !isEqBypassed
              ? 'bg-brand-accent text-brand-bg border-brand-accent shadow-sm shadow-brand-accent/20'
              : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-400'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {isEqBypassed ? 'EQ Bypassato' : 'EQ Attivo'}
        </button>
      </div>

      {/* DSP Controls Toolbelt */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-bg/50 border border-brand-border/60 rounded p-2.5">
        
        {/* Preset Chips and Genres dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Menu a Discesa Generi Musicali */}
          <div className="relative flex items-center">
            <div className={`flex items-center gap-1.5 bg-brand-bg border border-brand-border transition-all rounded px-2.5 py-1.5 text-brand-muted relative pr-7 ${
              isEqBypassed ? 'opacity-40 cursor-not-allowed' : 'hover:border-brand-accent/30 focus-within:border-brand-accent/50 focus-within:text-brand-accent'
            }`}>
              <Music className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <select
                id="genre_select"
                value={selectedGenreValue}
                onChange={handleGenreSelect}
                disabled={isEqBypassed}
                className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none cursor-pointer appearance-none uppercase"
              >
                <option value="" className="bg-[#0a0a0a] text-brand-muted font-bold font-mono">
                  GENERE
                </option>
                {GENRE_PRESETS.map((genre) => (
                  <option
                    key={genre.name}
                    value={genre.name}
                    className="bg-[#0a0a0a] text-white font-mono font-bold"
                  >
                    {genre.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-brand-muted absolute right-2 pointer-events-none" />
            </div>
          </div>

          {/* Quick Flat Reset */}
          <button
            id="btn_reset_eq"
            onClick={resetEqualizer}
            disabled={isEqBypassed}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono font-bold text-white bg-brand-bg border border-brand-border hover:border-brand-accent hover:text-brand-accent transition-colors rounded cursor-pointer ${
              isEqBypassed ? 'opacity-40 cursor-not-allowed' : ''
            }`}
            title="Azzera e rendi piatto l'equalizzatore"
          >
            <RotateCcw className="w-3 h-3" />
            RESET FLAT
          </button>
        </div>

        {/* DSP Special Functions */}
        <div className="flex items-center gap-2">
          {/* Smooth Curve */}
          <button
            id="btn_eq_smooth"
            onClick={smoothEqualizer}
            disabled={isEqBypassed}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono font-bold text-brand-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded border border-transparent hover:border-brand-accent/20 transition-all cursor-pointer ${
              isEqBypassed ? 'opacity-40 cursor-not-allowed' : ''
            }`}
            title="Smussa le frequenze per un suono più equilibrato"
          >
            <Sparkles className="w-3 h-3" />
            SMUSSA
          </button>

          {/* Invert Curve */}
          <button
            id="btn_eq_invert"
            onClick={invertEqualizer}
            disabled={isEqBypassed}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono font-bold text-brand-muted hover:text-brand-accent hover:bg-brand-accent/5 rounded border border-transparent hover:border-brand-accent/20 transition-all cursor-pointer ${
              isEqBypassed ? 'opacity-40 cursor-not-allowed' : ''
            }`}
            title="Inverti l'equalizzazione (es. per compensazione ambiente)"
          >
            <RefreshCw className="w-3 h-3" />
            INVERTI
          </button>
        </div>

      </div>

      {/* Preset Chip Buttons */}
      <div className={`flex flex-wrap gap-1.5 transition-opacity duration-300 ${isEqBypassed ? 'opacity-40 pointer-events-none' : ''}`}>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            id={`preset_${preset.name.toLowerCase().replace(/\s+/g, '_')}`}
            onClick={() => handlePresetSelect(preset)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-all duration-200 cursor-pointer ${
              activePreset === preset.name
                ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/30 font-bold'
                : 'bg-brand-bg text-brand-muted hover:text-white hover:bg-brand-bg/80 border-brand-border'
            }`}
          >
            {preset.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Dynamic EQ Curve Visualization */}
      <div className="w-full bg-brand-bg border border-brand-border rounded p-4 flex flex-col gap-1.5 relative overflow-hidden">
        <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[9px] font-mono text-brand-muted uppercase tracking-widest">
          <Zap className={`w-3 h-3 ${isEqBypassed ? 'text-neutral-500' : 'text-brand-accent animate-pulse'}`} />
          Curva di Risposta Frequenziale
        </div>
        
        {isEqBypassed && (
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-[1px] flex items-center justify-center z-10">
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 border border-neutral-800 bg-neutral-900/90 px-3 py-1.5 rounded">
              MODALITÀ BYPASS ATTIVA
            </span>
          </div>
        )}

        <div className="h-24 w-full mt-3">
          <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="w-full h-full">
            {/* Horizontal Grid lines */}
            <g stroke="rgba(255, 255, 255, 0.02)" strokeDasharray="3">
              <line x1="0" y1="10" x2="500" y2="10" />
              <line x1="0" y1="30" x2="500" y2="30" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="rgba(255, 255, 255, 0.02)" />
              <line x1="0" y1="90" x2="500" y2="90" />
            </g>
            {/* Main Center Line 0 dB */}
            <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(0, 245, 212, 0.15)" strokeWidth="1" />
            
            {/* Response Curve Gradient Fill */}
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0, 245, 212, 0.18)" />
                <stop offset="100%" stopColor="rgba(0, 245, 212, 0.00)" />
              </linearGradient>
            </defs>

            {/* Filled Area under Curve */}
            <path
              d={`${generateCurvePath()} L 475 100 L 25 100 Z`}
              fill="url(#curveGradient)"
              className="transition-all duration-300 ease-out"
            />

            {/* Glowing Response Curve Path */}
            <path
              d={generateCurvePath()}
              fill="none"
              stroke="url(#glowGradient)"
              strokeWidth="2.5"
              className="transition-all duration-300 ease-out"
            />
            
            <linearGradient id="glowGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#006b5d" />
              <stop offset="50%" stopColor="#00f5d4" />
              <stop offset="100%" stopColor="#006b5d" />
            </linearGradient>

            {/* Nodes indicating interactive slider points */}
            {bands.map((band, idx) => {
              const width = 500;
              const paddingX = 25;
              const stepX = (width - paddingX * 2) / 9;
              const x = paddingX + idx * stepX;
              const normalizedGain = ((isEqBypassed ? 0 : band.gain) + 12) / 24;
              const y = 100 - (normalizedGain * 80 + 10);
              
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-brand-bg stroke-brand-accent stroke-[2] transition-all duration-300 ease-out"
                />
              );
            })}
          </svg>
        </div>
        
        {/* dB Guidelines labels */}
        <div className="flex justify-between text-[8px] font-mono text-brand-muted px-1 mt-0.5">
          <span>+12 dB</span>
          <span>0 dB (FLAT)</span>
          <span>-12 dB</span>
        </div>
      </div>

      {/* Ten Sliders Layout - Rack Consolle Style */}
      <div className={`grid grid-cols-5 md:grid-cols-10 gap-x-2 gap-y-4 h-72 md:h-80 items-center px-0.5 transition-all duration-300 ${
        isEqBypassed ? 'opacity-30 pointer-events-none' : ''
      }`}>
        {bands.map((band, idx) => {
          return (
            <div key={idx} className="flex flex-col h-full items-center justify-between bg-brand-bg/20 rounded border border-brand-border/30 hover:border-brand-accent/20 py-2 transition-all">
              
              {/* Gain Indicator text */}
              <span className={`text-[10px] font-mono font-extrabold tracking-tighter ${
                band.gain > 0 
                  ? 'text-brand-accent' 
                  : band.gain < 0 
                    ? 'text-rose-400' 
                    : 'text-neutral-500'
              }`}>
                {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)}
              </span>

              {/* Increment Precise Button (+) */}
              <button
                type="button"
                onClick={() => handleSliderChange(idx, band.gain + 0.5)}
                disabled={isEqBypassed}
                className="p-1 text-brand-muted hover:text-brand-accent hover:bg-brand-bg rounded border border-transparent hover:border-brand-border transition-all cursor-pointer"
                title="Aumenta di 0.5 dB"
              >
                <Plus className="w-3 h-3" />
              </button>

              {/* Slider Track Container with hardware Tick line markers */}
              <div className="h-32 md:h-40 py-1 flex items-center justify-center relative w-full group">
                
                {/* Visual reference ticks behind slider */}
                <div className="absolute inset-y-2 left-1/2 w-4 -translate-x-1/2 flex flex-col justify-between pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                  <div className="w-full border-t border-white"></div>
                  <div className="w-full border-t border-white/50"></div>
                  <div className="w-full border-t border-brand-accent"></div>
                  <div className="w-full border-t border-white/50"></div>
                  <div className="w-full border-t border-white"></div>
                </div>

                {/* Vertical slider input */}
                <input
                  type="range"
                  id={`eq_slider_${idx}`}
                  min="-12"
                  max="12"
                  step="0.5"
                  value={band.gain}
                  disabled={isEqBypassed}
                  onDoubleClick={() => handleSliderChange(idx, 0)}
                  onChange={(e) => handleSliderChange(idx, parseFloat(e.target.value))}
                  className="h-full cursor-ns-resize accent-brand-accent relative z-10"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    WebkitAppearance: 'slider-vertical',
                    width: '12px'
                  }}
                  title="Fai doppio click per azzerare questo slider"
                />

                {/* Instant Zero Button */}
                {band.gain !== 0 && (
                  <button
                    onClick={() => handleSliderChange(idx, 0)}
                    className="absolute bottom-0 scale-75 w-2 h-2 rounded-full bg-brand-accent/40 border border-brand-accent hover:bg-brand-accent z-20 cursor-pointer"
                    title="Azzera banda"
                  />
                )}
              </div>

              {/* Decrement Precise Button (-) */}
              <button
                type="button"
                onClick={() => handleSliderChange(idx, band.gain - 0.5)}
                disabled={isEqBypassed}
                className="p-1 text-brand-muted hover:text-rose-400 hover:bg-brand-bg rounded border border-transparent hover:border-brand-border transition-all cursor-pointer"
                title="Riduci di 0.5 dB"
              >
                <Minus className="w-3 h-3" />
              </button>

              {/* Band Label Tag */}
              <div className="flex flex-col items-center mt-1">
                <span className="text-[10px] font-mono font-bold text-white text-center tracking-tight leading-none">
                  {band.label}
                </span>
                <span className="text-[8px] font-mono text-brand-muted mt-0.5 uppercase tracking-tighter scale-90">
                  {idx <= 1 ? 'Bassi' : idx <= 3 ? 'B-Med' : idx <= 6 ? 'Medi' : idx <= 8 ? 'Alti' : 'Brill'}
                </span>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
