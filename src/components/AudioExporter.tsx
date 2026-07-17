import React, { useState } from 'react';
import { Download, Sparkles, AlertTriangle, ShieldCheck, HelpCircle, HardDrive, Cpu } from 'lucide-react';
import { Track } from '../types';

interface AudioExporterProps {
  currentTrack: Track | null;
  isExporting: boolean;
  exportProgress: number;
  onExport: (track: Track, format: 'wav16' | 'wav32' | 'flac' | 'mp3') => Promise<void>;
}

export default function AudioExporter({
  currentTrack,
  isExporting,
  exportProgress,
  onExport,
}: AudioExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<'wav16' | 'wav32' | 'flac' | 'mp3'>('wav16');
  const [showInfo, setShowInfo] = useState(false);

  const handleExportClick = async () => {
    if (!currentTrack || isExporting) return;
    await onExport(currentTrack, selectedFormat);
  };

  // Get active phase string based on progress percentage
  const getPhaseString = () => {
    if (exportProgress <= 15) return 'Inizializzazione esportatore...';
    if (exportProgress <= 35) return 'Lettura file audio locale...';
    if (exportProgress <= 55) return 'Decodifica tracce ed estrazione PCM...';
    if (exportProgress <= 75) return 'Rendering Offline DSP (Filtri + Preamp)...';
    if (exportProgress <= 92) return 'Ricompilazione canali stereo & Limiter...';
    return 'Scrittura intestazione RIFF/WAV e salvataggio...';
  };

  return (
    <div id="audio_exporter_panel" className="bg-brand-card rounded border border-brand-border p-5 md:p-6 flex flex-col gap-4 relative overflow-hidden">
      
      {/* Decorative cybernetic glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full filter blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-brand-accent/10 border border-brand-accent/20 text-brand-accent">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Esporta Audio Elaborato</h3>
            <p className="text-xs text-brand-muted mt-0.5">Bake dei filtri DSP direttamente sul file sorgente</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-brand-muted hover:text-brand-accent p-1 rounded transition-colors cursor-pointer"
          title="Maggiori informazioni sui formati e l'ascolto in macchina"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Info Panel Expander */}
      {showInfo && (
        <div className="text-xs text-brand-muted bg-brand-bg/60 border border-brand-border/40 rounded p-3 leading-relaxed flex flex-col gap-2 animate-fade-in">
          <div className="flex items-start gap-2 text-brand-accent font-bold">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Guida all'ascolto su Autoradio e Dispositivi Esterni</span>
          </div>
          <p>
            Quando regoli l'equalizzatore parametrico, questi cambiamenti avvengono in tempo reale nel browser. Per ascoltare la canzone modificata <strong>nella tua auto</strong> o su lettori digitali, devi <strong>salvare / esportare</strong> il file.
          </p>
          <p>
            Il nostro motore esegue un <strong>Baking offline ultra-rapido</strong>: prende l'audio originale, ci applica la tua curva EQ, il pre-amp e la spazializzazione 3D, ed esporta un file ad altissima fedeltà.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px]">
            <div className="bg-brand-bg p-1.5 rounded">
              <span className="text-white block font-bold">WAV 16-bit (CD)</span>
              Massima compatibilità. Ideale per chiavette USB di vecchie e nuove autoradio.
            </div>
            <div className="bg-brand-bg p-1.5 rounded">
              <span className="text-white block font-bold">WAV 32-bit (Hi-Res)</span>
              Risoluzione studio. Per cuffie di fascia alta o impianti hi-fi moderni.
            </div>
          </div>
        </div>
      )}

      {!currentTrack ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-brand-bg/40 border border-dashed border-brand-border rounded text-center">
          <AlertTriangle className="w-8 h-8 text-neutral-600 mb-2" />
          <span className="text-xs font-mono text-brand-muted uppercase font-bold">Nessun Brano Selezionato</span>
          <p className="text-[11px] text-neutral-500 mt-1 max-w-[240px]">
            Seleziona una canzone dalla libreria o carica un tuo file per abilitare l'esportazione con equalizzatore applicato.
          </p>
        </div>
      ) : (
        /* Active Exporter Interface */
        <div className="flex flex-col gap-4">
          
          {/* Target Track Badge */}
          <div className="bg-brand-bg border border-brand-border/80 rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div 
                className="w-8 h-8 rounded shrink-0 flex items-center justify-center font-mono text-xs font-extrabold text-brand-bg"
                style={{ background: currentTrack.coverColor || 'var(--color-brand-accent)' }}
              >
                {currentTrack.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-white block truncate">{currentTrack.name}</span>
                <span className="text-[10px] text-brand-muted block truncate mt-0.5">{currentTrack.artist}</span>
              </div>
            </div>
            
            <div className="text-right shrink-0">
              <span className="text-[10px] font-mono font-bold bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-brand-accent">
                SORGENTE: {currentTrack.format.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Format Selector Grid */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-brand-muted uppercase">Seleziona Formato Digitale</span>
            <div className="grid grid-cols-2 gap-3">
              
              {/* WAV 16-bit CD Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('wav16')}
                disabled={isExporting}
                className={`flex flex-col items-start p-2.5 rounded border text-left cursor-pointer transition-all ${
                  selectedFormat === 'wav16'
                    ? 'bg-brand-accent/5 border-brand-accent text-white'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-border/80'
                } ${isExporting ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <HardDrive className={`w-3.5 h-3.5 ${selectedFormat === 'wav16' ? 'text-brand-accent' : 'text-neutral-500'}`} />
                  WAV CD 16-bit
                </div>
                <span className="text-[9px] text-brand-muted mt-0.5 leading-tight">
                  Compatibilità universale. Perfetto per chiavette USB di vecchie autoradio.
                </span>
              </button>

              {/* FLAC Lossless Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('flac')}
                disabled={isExporting}
                className={`flex flex-col items-start p-2.5 rounded border text-left cursor-pointer transition-all ${
                  selectedFormat === 'flac'
                    ? 'bg-brand-accent/5 border-brand-accent text-white'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-border/80'
                } ${isExporting ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <Cpu className={`w-3.5 h-3.5 ${selectedFormat === 'flac' ? 'text-brand-accent' : 'text-neutral-500'}`} />
                  FLAC HD Lossless
                </div>
                <span className="text-[9px] text-brand-muted mt-0.5 leading-tight">
                  Alta Definizione Lossless per audiofili, impianti premium e cuffie Hi-Fi.
                </span>
              </button>

              {/* MP3 High Quality Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('mp3')}
                disabled={isExporting}
                className={`flex flex-col items-start p-2.5 rounded border text-left cursor-pointer transition-all ${
                  selectedFormat === 'mp3'
                    ? 'bg-brand-accent/5 border-brand-accent text-white'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-border/80'
                } ${isExporting ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <HardDrive className={`w-3.5 h-3.5 ${selectedFormat === 'mp3' ? 'text-brand-accent' : 'text-neutral-500'}`} />
                  MP3 HQ 320kbps
                </div>
                <span className="text-[9px] text-brand-muted mt-0.5 leading-tight">
                  Leggero, ideale per smartphone, riproduttori portatili e autoradio MP3.
                </span>
              </button>

              {/* WAV 32-bit Hi-Res Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('wav32')}
                disabled={isExporting}
                className={`flex flex-col items-start p-2.5 rounded border text-left cursor-pointer transition-all ${
                  selectedFormat === 'wav32'
                    ? 'bg-brand-accent/5 border-brand-accent text-white'
                    : 'bg-brand-bg border-brand-border text-brand-muted hover:border-brand-border/80'
                } ${isExporting ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <Cpu className={`w-3.5 h-3.5 ${selectedFormat === 'wav32' ? 'text-brand-accent' : 'text-neutral-500'}`} />
                  WAV Studio 32-bit
                </div>
                <span className="text-[9px] text-brand-muted mt-0.5 leading-tight">
                  Massima risoluzione float per ulteriore post-produzione e precisione pura.
                </span>
              </button>

            </div>
          </div>

          {/* Export Action / Progress bar wrapper */}
          <div className="mt-2">
            {isExporting ? (
              /* Export Active Progress state */
              <div className="bg-brand-bg border border-brand-border p-3.5 rounded flex flex-col gap-2.5 animate-pulse">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-brand-accent font-bold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    Baking in Corso...
                  </span>
                  <span className="text-white font-black">{exportProgress}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-accent rounded-full transition-all duration-300 ease-out shadow-sm shadow-brand-accent/40"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>

                {/* Subtext message */}
                <span className="text-[10px] font-mono text-neutral-400">
                  {getPhaseString()}
                </span>
              </div>
            ) : (
              /* Normal State Button */
              <button
                id="btn_export_track"
                onClick={handleExportClick}
                className="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-extrabold text-xs uppercase tracking-widest rounded transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-accent/15 hover:shadow-brand-accent/30 active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                Elabora ed Esporta Canzone ({
                  selectedFormat === 'wav16' ? '.WAV CD' :
                  selectedFormat === 'wav32' ? '.WAV STUDIO' :
                  selectedFormat === 'flac' ? '.FLAC HD' : '.MP3 HQ'
                })
              </button>
            )}
          </div>

          {/* Technical Note */}
          <div className="text-[10px] text-neutral-500 text-center leading-normal">
            L'elaborazione avviene offline in background alla velocità massima della CPU. <br />
            Il lettore audio non si interromperà: puoi continuare ad ascoltare musica durante il processo.
          </div>

        </div>
      )}

    </div>
  );
}
