import React from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Sparkles, ShieldCheck, Shuffle, Repeat, Maximize2 
} from 'lucide-react';

interface AudioControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  preamp: number;
  volume: number;
  isCompressorEnabled: boolean;
  isDenoiseEnabled: boolean;
  isVolumeBoostEnabled: boolean;
  surround: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onPreampChange: (gain: number) => void;
  onSurroundChange: (width: number) => void;
  onToggleCompressor: (enabled: boolean) => void;
  onToggleDenoise: (enabled: boolean) => void;
  onToggleVolumeBoost: (enabled: boolean) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  isShuffle: boolean;
  isRepeat: boolean;
}

// Helper to format duration in minutes:seconds
const formatTime = (time: number) => {
  if (isNaN(time) || time === Infinity) return '00:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioControls({
  isPlaying,
  currentTime,
  duration,
  preamp,
  volume,
  isCompressorEnabled,
  isDenoiseEnabled,
  isVolumeBoostEnabled,
  surround,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onPreampChange,
  onSurroundChange,
  onToggleCompressor,
  onToggleDenoise,
  onToggleVolumeBoost,
  onToggleShuffle,
  onToggleRepeat,
  isShuffle,
  isRepeat,
}: AudioControlsProps) {
  const [isMuted, setIsMuted] = React.useState(false);
  const [prevVolume, setPrevVolume] = React.useState(1.0);

  const toggleMute = () => {
    if (isMuted) {
      onVolumeChange(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      onVolumeChange(0);
      setIsMuted(true);
    }
  };

  const handlePreampChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPreampChange(parseFloat(e.target.value));
  };

  const preampDb = 20 * Math.log10(preamp);

  return (
    <div id="audio_controls_panel" className="bg-brand-card rounded border border-brand-border p-5 md:p-6 flex flex-col gap-5">
      
      {/* 1. Playback Progress Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono text-brand-muted">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          id="playback_timeline"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-brand-bg rounded appearance-none cursor-pointer accent-brand-accent"
        />
      </div>

      {/* 2. Main Playback Controls bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-5 border-b border-brand-border pb-5">
        
        {/* Shuffle / Repeat */}
        <div className="flex items-center gap-2 order-2 lg:order-1">
          <button
            id="btn_shuffle"
            onClick={onToggleShuffle}
            className={`p-2 rounded border transition-all cursor-pointer ${
              isShuffle 
                ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/30' 
                : 'bg-brand-bg text-brand-muted border-brand-border hover:text-white'
            }`}
            title="Casuale"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            id="btn_repeat"
            onClick={onToggleRepeat}
            className={`p-2 rounded border transition-all cursor-pointer ${
              isRepeat 
                ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/30' 
                : 'bg-brand-bg text-brand-muted border-brand-border hover:text-white'
            }`}
            title="Ripeti"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Play / Pause / Skip */}
        <div className="flex items-center gap-4 order-1 lg:order-2">
          <button
            id="btn_prev"
            onClick={onPrev}
            className="p-2.5 rounded-full bg-brand-bg hover:bg-brand-bg/80 text-brand-text hover:text-white transition-colors border border-brand-border cursor-pointer"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button
            id="btn_play_pause"
            onClick={onPlayPause}
            className="p-4 rounded-full bg-brand-accent text-brand-bg hover:opacity-90 shadow-lg shadow-brand-accent/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            id="btn_next"
            onClick={onNext}
            className="p-2.5 rounded-full bg-brand-bg hover:bg-brand-bg/80 text-brand-text hover:text-white transition-colors border border-brand-border cursor-pointer"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-3 order-3 w-full sm:w-48">
          <button onClick={toggleMute} className="text-brand-muted hover:text-white cursor-pointer" id="btn_toggle_mute">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            id="volume_slider"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-brand-bg rounded appearance-none cursor-pointer accent-brand-accent"
            title="Volume Master"
          />
          <span className="text-xs font-mono text-brand-muted w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

      </div>

      {/* 3. Pre-Amp Boost & Sound Enhancement Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
        
        {/* Pre-Amp Gain Boost Section (Specific request requirement) */}
        <div className="bg-brand-bg rounded p-4 border border-brand-border flex flex-col gap-3 relative overflow-hidden">
          {/* Subtle background glow when boosted */}
          {preamp > 1.05 && (
            <div className="absolute inset-0 bg-brand-accent/[0.02] pointer-events-none" />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">PRE-AMP BOOST (GUADAGNO)</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              preamp > 2.0 
                ? 'bg-rose-500/10 text-rose-400' 
                : preamp > 1.05 
                  ? 'bg-brand-accent/15 text-brand-accent' 
                  : 'bg-[#151515] text-brand-muted'
            }`}>
              {preamp.toFixed(1)}x ({preampDb > 0 ? `+${preampDb.toFixed(1)}dB` : '0.0dB'})
            </span>
          </div>

          <p className="text-[11px] text-brand-muted leading-relaxed">
            Se la traccia originale ha un volume inciso troppo basso, amplifica digitalmente il livello per ottenere un impatto acustico eccellente.
          </p>

          <input
            type="range"
            id="preamp_slider"
            min="1.0"
            max="4.0"
            step="0.1"
            value={preamp}
            onChange={handlePreampChangeLocal}
            className="w-full h-1.5 bg-brand-card rounded appearance-none cursor-pointer accent-brand-accent"
          />

          {/* Dynamic Warning for high preamp values without compressor */}
          {!isCompressorEnabled && preamp > 1.8 && (
            <span className="text-[9px] text-rose-400 font-mono">
              ⚠️ clipping imminente! Attiva l'Anti-Distorsione per stabilizzare l'audio.
            </span>
          )}
        </div>

        {/* High-Fidelity DSP Settings: Compressor, Denoise & Surround */}
        <div className="flex flex-col gap-3">
          
          {/* Anti-distortion Safeguard Compressor */}
          <div className="bg-brand-bg rounded p-3 border border-brand-border flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded ${isCompressorEnabled ? 'bg-brand-accent/10 text-brand-accent' : 'bg-[#151515] text-brand-dark-muted'}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Limitatore Limpido</span>
                <span className="text-[10px] text-brand-muted">Previene picchi e distorsione ad alti volumi</span>
              </div>
            </div>
            
            <button
              id="btn_toggle_compressor"
              onClick={() => onToggleCompressor(!isCompressorEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isCompressorEnabled ? 'bg-brand-accent' : 'bg-[#222]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-brand-bg shadow ring-0 transition duration-200 ease-in-out ${
                  isCompressorEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Denoise (Background Noise Removal) Filter */}
          <div className="bg-brand-bg rounded p-3 border border-brand-border flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded ${isDenoiseEnabled ? 'bg-[#f4511e]/10 text-[#f4511e]' : 'bg-[#151515] text-brand-dark-muted'}`}>
                <VolumeX className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Elimina Rumori</span>
                <span className="text-[10px] text-brand-muted">Filtra fruscii, disturbi e ronzii di fondo</span>
              </div>
            </div>
            
            <button
              id="btn_toggle_denoise"
              onClick={() => onToggleDenoise(!isDenoiseEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDenoiseEnabled ? 'bg-[#f4511e]' : 'bg-[#222]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-brand-bg shadow ring-0 transition duration-200 ease-in-out ${
                  isDenoiseEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Super Volume Boost (+6dB) Toggle */}
          <div className="bg-brand-bg rounded p-3 border border-brand-border flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded ${isVolumeBoostEnabled ? 'bg-amber-500/10 text-amber-400' : 'bg-[#151515] text-brand-dark-muted'}`}>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Volume Boost (+6dB)</span>
                <span className="text-[10px] text-brand-muted font-mono text-amber-400/90">Massimizza pressione sonora (x2.0)</span>
              </div>
            </div>
            
            <button
              id="btn_toggle_volume_boost"
              onClick={() => onToggleVolumeBoost(!isVolumeBoostEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isVolumeBoostEnabled ? 'bg-amber-500' : 'bg-[#222]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-brand-bg shadow ring-0 transition duration-200 ease-in-out ${
                  isVolumeBoostEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3D Stereo Spatializer Surround Delay */}
          <div className="bg-brand-bg rounded p-3 border border-brand-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded ${surround > 0 ? 'bg-brand-accent/10 text-brand-accent' : 'bg-[#151515] text-brand-dark-muted'}`}>
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white uppercase tracking-wide font-mono">Spazializzazione 3D Aura</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-brand-accent">
                {surround}%
              </span>
            </div>
            <input
              type="range"
              id="surround_slider"
              min="0"
              max="100"
              value={surround}
              onChange={(e) => onSurroundChange(parseInt(e.target.value))}
              className="w-full h-1 bg-brand-card rounded appearance-none cursor-pointer accent-brand-accent"
              title="Effetto Surround"
            />
          </div>

        </div>

      </div>

    </div>
  );
}
