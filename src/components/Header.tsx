import React from 'react';
import { Waves, Cpu, SlidersHorizontal, Info } from 'lucide-react';

export default function Header() {
  return (
    <header id="app_header" className="border-b border-brand-border bg-brand-card sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-accent rounded-sm flex items-center justify-center">
            <div className="w-4 h-4 bg-brand-bg rounded-full"></div>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-1.5">
              PureAudio <span className="text-[10px] text-brand-accent font-mono">PRO</span>
            </h1>
            <p className="text-[9px] font-mono text-brand-muted uppercase tracking-widest leading-none mt-0.5">Hi-Fi DSP Equalizer Engine</p>
          </div>
        </div>

        {/* Dynamic State Indicator & Help badge */}
        <div className="flex items-center gap-3">
          
          {/* Engine Status badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-brand-bg border border-brand-border text-[10px] font-mono font-semibold text-brand-accent">
            <Cpu className="w-3.5 h-3.5" />
            <span>HI-RES AUDIO OUTPUT</span>
          </div>

          {/* Equalizer Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-brand-bg border border-brand-border text-[10px] font-mono font-semibold text-brand-muted">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>192KHZ / 24-BIT</span>
          </div>

          {/* Help Tooltip Button */}
          <div className="relative group">
            <button
              id="btn_help_info"
              className="p-1.5 rounded text-brand-muted hover:text-white bg-brand-bg border border-brand-border transition-colors cursor-pointer"
              title="Guida all'Uso"
            >
              <Info className="w-4 h-4" />
            </button>
            {/* Elegant hover tooltip */}
            <div className="absolute right-0 mt-2 w-64 p-4 bg-brand-card border border-brand-border rounded shadow-2xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-50 text-[11px] text-brand-text leading-relaxed">
              <h5 className="font-bold text-white mb-2 flex items-center gap-1">
                <span>Guida Rapida PureAudio</span>
              </h5>
              <ul className="list-disc list-inside space-y-1.5 text-brand-muted">
                <li>Trascina i tuoi file <strong className="text-white">MP3</strong> o <strong className="text-white">FLAC</strong> locali nella libreria.</li>
                <li>Se non hai file musicali, clicca su <strong className="text-brand-accent">"Carica Brani Demo"</strong> per avviare subito un brano synth di prova.</li>
                <li>Regola i cursori dell'<strong>Equalizzatore</strong> o seleziona un Preset per modellare il suono.</li>
                <li>Usa <strong>Pre-Amp (Boost Volume)</strong> per amplificare canzoni con volume originariamente troppo basso.</li>
              </ul>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
