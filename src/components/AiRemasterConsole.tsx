import React, { useState } from 'react';
import { Sparkles, Cpu, MessageSquare, CheckCircle2, RotateCcw, AlertCircle, Volume2, HelpCircle } from 'lucide-react';
import { Track, EqBand } from '../types';

interface AiRemasterConsoleProps {
  currentTrack: Track | null;
  bands: EqBand[];
  onApplyRemaster: (gains: number[], preamp: number, surround: number, compressor: boolean) => void;
}

type RemasterStyle = 'car_hifi' | 'studio' | 'vinyl' | 'loudness' | 'clear_vocal';

interface StyleItem {
  id: RemasterStyle;
  name: string;
  desc: string;
  emoji: string;
  color: string;
}

const STYLES: StyleItem[] = [
  {
    id: 'car_hifi',
    name: 'Ottimizzazione Auto',
    desc: 'Spinta sui bassi profondi e presenza delle voci, calibrato per contrastare il rumore stradale.',
    emoji: '🚗',
    color: 'border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/10'
  },
  {
    id: 'loudness',
    name: 'Loudness Maximizer',
    desc: 'Curva a sorriso enfatizzata ed elevato preamp per il massimo impatto sonoro d\'impatto.',
    emoji: '🔥',
    color: 'border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/10'
  },
  {
    id: 'vinyl',
    name: 'Warm Vinyl Analog',
    desc: 'Bassi caldi e morbidi con alte frequenze addolcite, per ricreare la firma acustica del vinile.',
    emoji: '📻',
    color: 'border-amber-500/30 hover:border-amber-400 bg-amber-950/10'
  },
  {
    id: 'clear_vocal',
    name: 'Presenza Vocale / Podcast',
    desc: 'Attenua i sub-bassi rumorosi e aumenta chirurgicamente la chiarezza vocale (1kHz - 4kHz).',
    emoji: '🎙️',
    color: 'border-rose-500/30 hover:border-rose-400 bg-rose-950/10'
  },
  {
    id: 'studio',
    name: 'Studio Reference',
    desc: 'Risposta purissima, piatta e fedele, progettata per l\'ascolto analitico e professionale.',
    emoji: '🎧',
    color: 'border-indigo-500/30 hover:border-indigo-400 bg-indigo-950/10'
  }
];

export default function AiRemasterConsole({
  currentTrack,
  bands,
  onApplyRemaster,
}: AiRemasterConsoleProps) {
  const [selectedStyle, setSelectedStyle] = useState<RemasterStyle>('car_hifi');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [appliedInfo, setAppliedInfo] = useState<{ preamp: number; surround: number; compressor: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemaster = async () => {
    if (!currentTrack) return;
    setIsProcessing(true);
    setError(null);
    setExplanation(null);

    try {
      const response = await fetch('/api/ai/remaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackName: currentTrack.name,
          artist: currentTrack.artist,
          genre: currentTrack.format,
          style: selectedStyle,
          prompt: customPrompt,
          currentBands: bands.map(b => ({ freq: b.frequency, gain: b.gain }))
        })
      });

      if (!response.ok) {
        throw new Error('La richiesta al server di remasterizzazione AI è fallita.');
      }

      const data = await response.json();
      
      // Apply the generated DSP curves to our audio engine
      onApplyRemaster(data.gains, data.preamp, data.surround, data.compressor);

      setExplanation(data.explanation);
      setAppliedInfo({
        preamp: data.preamp,
        surround: data.surround,
        compressor: data.compressor
      });

    } catch (e: any) {
      console.error(e);
      setError('Impossibile connettersi all\'assistente AI. Riprova più tardi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    onApplyRemaster([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1.0, 0, false);
    setExplanation(null);
    setAppliedInfo(null);
    setCustomPrompt('');
  };

  return (
    <div id="ai_remaster_panel" className="bg-brand-card rounded border border-brand-border p-5 md:p-6 flex flex-col gap-4 relative overflow-hidden">
      
      {/* Absolute background cyber glow */}
      <div className="absolute -top-12 -left-12 w-44 h-44 bg-brand-accent/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Header title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-brand-accent/10 border border-brand-accent/20 text-brand-accent">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Remasterizzazione Personale AI</h3>
            <p className="text-xs text-brand-muted mt-0.5">La tua intelligenza artificiale per l'acustica eccellente</p>
          </div>
        </div>
      </div>

      {!currentTrack ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-brand-bg/40 border border-dashed border-brand-border rounded text-center">
          <Sparkles className="w-8 h-8 text-neutral-600 mb-2" />
          <span className="text-xs font-mono text-brand-muted uppercase font-bold">In attesa di una traccia...</span>
          <p className="text-[11px] text-neutral-500 mt-1 max-w-[240px]">
            Seleziona una canzone per sbloccare l'ingegnere acustico personale basato su intelligenza artificiale.
          </p>
        </div>
      ) : (
        /* AI Master Controls Interface */
        <div className="flex flex-col gap-4">
          
          {/* Style Selector Section */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-brand-muted uppercase">1. Scegli lo Stile Sonoro</span>
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`flex items-start gap-3 p-2.5 rounded border text-left transition-all duration-200 cursor-pointer ${
                    selectedStyle === style.id
                      ? 'border-brand-accent bg-brand-accent/5 text-white ring-1 ring-brand-accent/30'
                      : 'border-brand-border bg-brand-bg/40 text-brand-muted hover:border-brand-border/80'
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{style.emoji}</span>
                  <div>
                    <span className="text-xs font-bold block text-white">{style.name}</span>
                    <span className="text-[10px] text-brand-muted block mt-0.5 leading-snug">{style.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instruction Prompt section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold tracking-widest text-brand-muted uppercase flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                2. Richieste Personalizzate (Opzionale)
              </span>
              <span className="text-[9px] font-mono text-neutral-500 uppercase">Input in Italiano</span>
            </div>
            <textarea
              id="ai_custom_prompt"
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Es. 'Voglio dei bassi più pesanti adatti alla mia macchina' oppure 'Rendi le voci incredibilmente limpide ed elimina il rimbombo'..."
              className="w-full text-xs bg-brand-bg border border-brand-border hover:border-brand-border/80 focus:border-brand-accent focus:outline-none rounded p-2.5 text-white placeholder:text-neutral-600 font-mono resize-none leading-relaxed"
            />
          </div>

          {/* Master Action Button */}
          <div>
            {isProcessing ? (
              <div className="w-full py-3 bg-brand-bg border border-brand-accent/20 rounded flex items-center justify-center gap-3.5 text-xs font-mono text-brand-accent animate-pulse">
                <Cpu className="w-4 h-4 animate-spin" />
                <span>L'INGEGNERE AI STA CALIBRANDO L'AUDIO...</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  id="btn_trigger_ai_remaster"
                  onClick={handleRemaster}
                  className="flex-1 py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-black text-xs uppercase tracking-widest rounded transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-accent/15"
                >
                  <Sparkles className="w-4 h-4" />
                  Elabora con AI Personale
                </button>

                {(explanation || appliedInfo) && (
                  <button
                    onClick={handleReset}
                    className="p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="Azzera Remasterizzazione AI"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* AI Result Explanation Box */}
          {explanation && appliedInfo && (
            <div className="bg-brand-bg border-l-2 border-brand-accent/70 p-3 rounded-r flex flex-col gap-2.5 animate-fade-in relative overflow-hidden">
              <div className="absolute top-1 right-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-accent" />
                <span className="text-[9px] font-mono text-brand-accent font-bold tracking-widest uppercase">Mastering Attivo</span>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="text-xs text-white leading-relaxed mt-1 italic font-sans">
                  "{explanation}"
                </span>
              </div>

              {/* Specs Badge Strip */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-brand-border/40 font-mono text-[9px]">
                <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
                  PREAMP: <strong className="text-brand-accent font-bold">{appliedInfo.preamp.toFixed(2)}x</strong>
                </span>
                <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
                  SURROUND 3D: <strong className="text-brand-accent font-bold">{appliedInfo.surround}%</strong>
                </span>
                <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-neutral-400">
                  COMPRESSOR: <strong className="text-brand-accent font-bold">{appliedInfo.compressor ? 'ON' : 'OFF'}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-950/20 border border-rose-800/40 p-2.5 rounded flex items-center gap-2 text-rose-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom subtle note */}
          <div className="text-[10px] text-neutral-500 text-center leading-normal">
            L'AI analizza la struttura acustica in base allo stile e rimodella in tempo reale la risposta in frequenza dell'equalizzatore.
          </div>

        </div>
      )}

    </div>
  );
}
