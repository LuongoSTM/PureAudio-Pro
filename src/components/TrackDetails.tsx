import React from 'react';
import { Music, Disc, Info, AudioLines, Flame, Sparkles } from 'lucide-react';
import { Track, AudioStats } from '../types';

interface TrackDetailsProps {
  track: Track | null;
  isPlaying: boolean;
  stats: AudioStats;
  preamp: number;
}

export default function TrackDetails({ track, isPlaying, stats, preamp }: TrackDetailsProps) {
  // Calculate dynamic Fidelity score based on format, sample rate, and active enhancements
  const calculateFidelityScore = () => {
    if (!track) return null;
    let baseScore = track.format === 'flac' ? 9.8 : 8.2;
    if (stats.sampleRate > 44100) baseScore += 0.5;
    if (preamp > 1.2 && preamp < 2.5) baseScore += 0.4; // Sweet amplification spot boosts scoring
    
    // Cap score at 10.0
    return Math.min(10.0, baseScore).toFixed(1);
  };

  const fidelityScore = calculateFidelityScore();

  return (
    <div id="track_details_panel" className="bg-brand-card rounded border border-brand-border p-5 md:p-6 flex flex-col md:flex-row gap-6 items-center">
      
      {/* Dynamic Cover Artwork Display (Vinyl disc / Gradient card) */}
      <div className="relative shrink-0 select-none group">
        {track ? (
          <div className="relative">
            {/* Spinning Vinyl Disc behind the cover */}
            <div
              className={`absolute top-0 left-0 w-32 h-32 rounded-full bg-[#050505] border border-brand-border flex items-center justify-center shadow-xl transition-all duration-500 ${
                isPlaying ? 'animate-[spin_4s_linear_infinite] translate-x-4' : 'translate-x-0'
              }`}
              style={{
                backgroundImage: 'radial-gradient(circle, #0a0a0a 12%, #050505 15%, #0d0d0d 20%, #050505 35%, #0a0a0a 45%, #000 65%, #1a1a1a 100%)',
              }}
            >
              {/* Vinyl center pinhole hole */}
              <div className="w-10 h-10 rounded-full bg-[#050505] border-4 border-brand-border flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-accent/55" />
              </div>
            </div>

            {/* Main Cover Album Square */}
            <div
              className={`relative w-32 h-32 rounded flex flex-col justify-between p-3 text-white font-semibold shadow-2xl transition-all duration-300 ${
                isPlaying ? 'scale-105' : ''
              }`}
              style={{ background: track.coverColor }}
            >
              <Music className="w-4 h-4 opacity-70" />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase tracking-widest font-mono opacity-60">STEREO OUTPUT</span>
                <span className="text-[10px] truncate opacity-90 font-medium">{track.album}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Idle State Artwork placeholder */
          <div className="w-32 h-32 rounded bg-[#050505] border border-brand-border flex flex-col items-center justify-center text-brand-muted shadow-inner">
            <Disc className="w-10 h-10 stroke-[1.2] mb-1.5 text-brand-accent animate-pulse" />
            <span className="text-[9px] font-mono tracking-widest uppercase text-brand-muted">STBY AUDIO</span>
          </div>
        )}
      </div>

      {/* Meta Information, Technical Specs & Realtime Meters */}
      <div className="flex-1 w-full flex flex-col justify-between self-stretch gap-4">
        
        {/* Track Title / Artist */}
        <div className="flex flex-col text-center md:text-left min-w-0">
          {track ? (
            <>
              <h2 className="text-base md:text-lg font-bold text-white truncate tracking-wider">
                {track.name}
              </h2>
              <p className="text-xs text-brand-accent mt-0.5 font-medium truncate font-mono">
                {track.artist.toUpperCase()}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base md:text-lg font-bold text-brand-muted tracking-wider">
                Nessun brano in riproduzione
              </h2>
              <p className="text-xs text-brand-dark-muted mt-0.5">
                Seleziona o trascina un file audio per avviare il motore DSP
              </p>
            </>
          )}
        </div>

        {/* Technical Specification Badges & Realtime Audio Analytics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#050505] rounded p-3 border border-brand-border font-mono text-[10px]">
          
          {/* Format Detail */}
          <div className="flex flex-col gap-0.5">
            <span className="text-brand-dark-muted uppercase text-[8px] tracking-wider font-semibold">Formato</span>
            <span className="text-white font-bold uppercase truncate">{track?.format || '---'}</span>
          </div>

          {/* Sample Rate */}
          <div className="flex flex-col gap-0.5">
            <span className="text-brand-dark-muted uppercase text-[8px] tracking-wider font-semibold">Campionamento</span>
            <span className="text-white font-bold">
              {track ? `${(stats.sampleRate / 1000).toFixed(1)} kHz` : '---'}
            </span>
          </div>

          {/* Processing Resolution */}
          <div className="flex flex-col gap-0.5">
            <span className="text-brand-dark-muted uppercase text-[8px] tracking-wider font-semibold">Precisione</span>
            <span className="text-white font-bold truncate">32-bit Float</span>
          </div>

          {/* Fidelity Score */}
          <div className="flex flex-col gap-0.5">
            <span className="text-brand-dark-muted uppercase text-[8px] tracking-wider font-semibold">Fidelity Index</span>
            <span className="text-brand-accent font-bold flex items-center gap-0.5">
              {fidelityScore ? (
                <>
                  <Flame className="w-3 h-3 text-brand-accent fill-brand-accent/20" />
                  {fidelityScore}/10
                </>
              ) : (
                '---'
              )}
            </span>
          </div>

        </div>

        {/* AI mastering advice box */}
        {track?.aiAnalysis && (
          <div className={`p-2.5 rounded border text-[10px] flex gap-2.5 items-start transition-all ${
            track.aiAnalysis.status === 'needs_remaster'
              ? 'bg-rose-500/5 border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
          }`}>
            <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${track.aiAnalysis.status === 'needs_remaster' ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-bold uppercase tracking-wider text-[8px] font-mono">
                Consulente di Mastering AI PureAudio™
              </span>
              <p className="leading-relaxed">
                {track.aiAnalysis.reason}
              </p>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono text-brand-muted mt-0.5 bg-black/30 p-1.5 rounded border border-white/5">
                <span>RMS: <strong className="text-white font-bold">{track.aiAnalysis.metrics.rms.toFixed(1)} dB</strong></span>
                <span>PICCO: <strong className="text-white font-bold">{track.aiAnalysis.metrics.peak.toFixed(1)} dB</strong></span>
                <span>CREST FACTOR: <strong className="text-white font-bold">{track.aiAnalysis.metrics.crestFactor.toFixed(1)} dB</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Loudness VU-Meter (Adds massive pro aesthetic) */}
        <div className="flex flex-col gap-1.5 bg-[#050505] border border-brand-border rounded p-3">
          <div className="flex items-center justify-between text-[9px] font-mono text-brand-muted">
            <span className="flex items-center gap-1">
              <AudioLines className="w-3 h-3 text-brand-accent" />
              RIVELATORE DI ENERGIA RMS (VU-METER)
            </span>
            <div className="flex items-center gap-1">
              <span className={stats.clippingDetected ? 'text-rose-500 animate-pulse font-bold' : 'text-brand-dark-muted font-bold'}>
                SATURAZIONE {stats.clippingDetected ? 'ATTIVA' : 'SICURA'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${stats.clippingDetected ? 'bg-rose-500 animate-pulse' : 'bg-[#00f5d4]'}`} />
            </div>
          </div>

          {/* VU Meter Visual Bar */}
          <div className="h-1.5 w-full bg-[#111] rounded-[2px] overflow-hidden flex gap-[1px]">
            {/* Draw 30 divisions of the VU-meter */}
            {Array.from({ length: 30 }).map((_, idx) => {
              // Convert rms db (-60 to 0) to index (0 to 30)
              const mappedIndex = Math.floor(((stats.rmsLevel + 60) / 60) * 30);
              const isActive = isPlaying && idx <= mappedIndex;
              
              // Color spectrum for VU: green -> amber -> red
              let colorClass = 'bg-[#1a1a1a]';
              if (isActive) {
                if (idx < 20) {
                  colorClass = 'bg-[#00f5d4]'; // Mint Accent
                } else if (idx < 26) {
                  colorClass = 'bg-[#006b5d]'; // Darker Mint transition
                } else {
                  colorClass = 'bg-rose-500'; // Peak signal saturation warning
                }
              }

              return (
                <div
                  key={idx}
                  className={`flex-1 h-full rounded-[1px] transition-colors duration-150 ${colorClass}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-brand-dark-muted px-0.5">
            <span>-60 dB</span>
            <span>-30 dB</span>
            <span>-12 dB</span>
            <span>-3 dB</span>
            <span>0 dB</span>
          </div>
        </div>

      </div>

    </div>
  );
}
