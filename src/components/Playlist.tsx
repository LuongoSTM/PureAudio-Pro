import React, { useState, useRef } from 'react';
import { 
  Music, 
  UploadCloud, 
  Trash2, 
  Search, 
  Sparkles, 
  FolderSync, 
  CheckSquare, 
  Square, 
  X, 
  Loader2, 
  Check 
} from 'lucide-react';
import { Track } from '../types';

type RemasterStyle = 'car_hifi' | 'studio' | 'vinyl' | 'loudness' | 'clear_vocal';

interface PlaylistProps {
  playlist: Track[];
  currentTrack: Track | null;
  onTrackSelect: (track: Track) => void;
  onRemoveTrack: (id: string) => void;
  onAddFiles: (files: FileList) => void;
  onLoadDemoTracks: () => void;
  isLoadingDemo: boolean;
  renderTrackOffline: (
    track: Track,
    format: 'wav16' | 'wav32' | 'flac' | 'mp3',
    eqGains: number[],
    preampVal: number,
    surroundVal: number,
    compressorEnabled: boolean,
    onProgress: (progress: number) => void
  ) => Promise<{ blob: Blob; filename: string }>;
}

interface QueueItem {
  id: string;
  name: string;
  status: 'idle' | 'ai_tuning' | 'rendering' | 'done' | 'failed';
  progress: number;
}

const BATCH_STYLES = [
  { id: 'car_hifi', name: 'Ottimizzazione Auto', emoji: '🚗', desc: 'Rinforzo bassi profondi per sconfiggere il rumore stradale.' },
  { id: 'loudness', name: 'Loudness Maximizer', emoji: '🔥', desc: 'Curva a V accentuata per massimo impatto acustico.' },
  { id: 'vinyl', name: 'Warm Vinyl Analog', emoji: '📻', desc: 'Medie frequenze vintage e alte calde e morbide.' },
  { id: 'clear_vocal', name: 'Presenza Vocale', emoji: '🎙️', desc: 'Attenua rimbombi ed esalta la limpidezza delle voci.' },
  { id: 'studio', name: 'Studio Reference', emoji: '🎧', desc: 'Risposta lineare, piatta e purissima da fonico.' },
] as const;

const BATCH_FORMATS = [
  { id: 'wav16', name: 'WAV CD (16-bit)', desc: 'Compatibilità universale' },
  { id: 'flac', name: 'FLAC Lossless (HD)', desc: 'Audio ad alta definizione' },
  { id: 'mp3', name: 'MP3 HQ (320kbps)', desc: 'Leggero, ideale per smartphone' },
  { id: 'wav32', name: 'WAV Studio (32-bit)', desc: 'Precisione float illimitata' },
] as const;

export default function Playlist({
  playlist,
  currentTrack,
  onTrackSelect,
  onRemoveTrack,
  onAddFiles,
  onLoadDemoTracks,
  isLoadingDemo,
  renderTrackOffline,
}: PlaylistProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [batchStyle, setBatchStyle] = useState<RemasterStyle>('car_hifi');
  const [batchPrompt, setBatchPrompt] = useState('');
  const [batchFormat, setBatchFormat] = useState<'wav16' | 'wav32' | 'flac' | 'mp3'>('wav16');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchQueue, setBatchQueue] = useState<QueueItem[]>([]);
  
  const abortRef = useRef(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  const toggleTrackSelection = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllTracks = () => {
    setSelectedTrackIds(new Set(playlist.map(t => t.id)));
  };

  const deselectAllTracks = () => {
    setSelectedTrackIds(new Set());
  };

  const handleAbort = () => {
    abortRef.current = true;
    setIsBatchProcessing(false);
    setBatchQueue(prev => prev.map(q => 
      q.status === 'ai_tuning' || q.status === 'rendering' || q.status === 'idle' 
        ? { ...q, status: 'failed' as const } 
        : q
    ));
  };

  const startBatchProcessing = async () => {
    if (selectedTrackIds.size === 0) return;
    abortRef.current = false;
    setIsBatchProcessing(true);

    const queueItems: QueueItem[] = playlist
      .filter(t => selectedTrackIds.has(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        status: 'idle' as const,
        progress: 0
      }));

    setBatchQueue(queueItems);

    for (let i = 0; i < queueItems.length; i++) {
      if (abortRef.current) break;

      const item = queueItems[i];
      setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'ai_tuning' as const } : q));

      const trackObj = playlist.find(t => t.id === item.id);
      if (!trackObj) {
        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed' as const } : q));
        continue;
      }

      try {
        // 1. Calibrate settings with AI Remaster API
        const response = await fetch('/api/ai/remaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackName: trackObj.name,
            artist: trackObj.artist,
            genre: trackObj.format,
            style: batchStyle,
            prompt: batchPrompt,
            currentBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((g, idx) => ({ freq: idx, gain: g }))
          })
        });

        if (abortRef.current) break;

        if (!response.ok) {
          throw new Error('Connessione API AI fallita.');
        }

        const aiData = await response.json();

        // 2. Perform offline audio rendering with specific EQ and effects
        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'rendering' as const, progress: 10 } : q));

        const { blob, filename } = await renderTrackOffline(
          trackObj,
          batchFormat,
          aiData.gains,
          aiData.preamp,
          aiData.surround,
          aiData.compressor,
          (prog) => {
            setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: prog } : q));
          }
        );

        if (abortRef.current) break;

        // 3. Initiate client-side download
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.click();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done' as const, progress: 100 } : q));
      } catch (err) {
        console.error(`Errore nel processo batch di "${trackObj.name}":`, err);
        setBatchQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'failed' as const } : q));
      }
    }

    setIsBatchProcessing(false);
  };

  const filteredPlaylist = playlist.filter((track) =>
    track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Computations for overall batch progress
  const completedCount = batchQueue.filter(q => q.status === 'done').length;
  const totalCount = batchQueue.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const activeItem = batchQueue.find(q => q.status === 'ai_tuning' || q.status === 'rendering');

  return (
    <div id="playlist_panel" className="bg-brand-card rounded border border-brand-border p-5 md:p-6 flex flex-col gap-4 h-full relative overflow-hidden">
      
      {/* Background neon glow for Batch processing */}
      {isBatchMode && (
        <div className="absolute -right-24 -top-24 w-48 h-48 bg-brand-accent/5 rounded-full filter blur-3xl pointer-events-none animate-pulse" />
      )}

      {/* Header & Badges */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-brand-accent" />
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              {isBatchMode ? 'Coda Elaborazione Batch' : 'Libreria Audio'}
            </h3>
          </div>
          
          <div className="flex gap-1.5">
            <span className="text-[9px] font-mono font-bold text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-2 py-0.5 rounded">
              {playlist.length} TRACCE
            </span>
            {selectedTrackIds.size > 0 && isBatchMode && (
              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded animate-bounce">
                {selectedTrackIds.size} SELEZIONATE
              </span>
            )}
          </div>
        </div>

        {/* Action Toggles: Demo tracks & Batch Processing mode */}
        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn_load_demos"
            onClick={onLoadDemoTracks}
            disabled={isLoadingDemo || isBatchProcessing}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-extrabold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-brand-muted hover:text-white rounded transition-colors disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            <FolderSync className={`w-3.5 h-3.5 ${isLoadingDemo ? 'animate-spin' : ''}`} />
            {isLoadingDemo ? 'Caricamento...' : 'Demo Tracks'}
          </button>

          <button
            id="btn_toggle_batch"
            disabled={playlist.length === 0 || isBatchProcessing}
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              if (!isBatchMode) deselectAllTracks();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-[10px] font-extrabold rounded border transition-all cursor-pointer uppercase tracking-wider ${
              isBatchMode
                ? 'bg-brand-accent/10 hover:bg-brand-accent/20 border-brand-accent text-brand-accent shadow-sm shadow-brand-accent/10'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-brand-muted hover:text-white'
            } ${playlist.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isBatchMode ? 'Esci Batch' : 'Modalità Batch'}
          </button>
        </div>
      </div>

      {/* 1. Drag & Drop Upload Area (Hidden when Batch is active to save space) */}
      {!isBatchMode && (
        <div
          id="drop_zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border border-dashed rounded p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 select-none group ${
            isDragOver 
              ? 'border-brand-accent bg-brand-accent/5' 
              : 'border-brand-border bg-brand-bg hover:border-brand-accent/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mp3,.flac,.wav"
            multiple
            className="hidden"
          />
          <UploadCloud className={`w-7 h-7 transition-transform group-hover:-translate-y-0.5 ${
            isDragOver ? 'text-brand-accent' : 'text-brand-muted'
          }`} />
          <div>
            <span className="text-[11px] font-bold text-brand-text block">
              Trascina qui i file o clicca per sfogliare
            </span>
            <span className="text-[9px] text-neutral-500 block">
              Supporta MP3, FLAC & WAV ad alta definizione
            </span>
          </div>
        </div>
      )}

      {/* 2. Search box (Visible only when not active batching) */}
      {!isBatchProcessing && (
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-brand-muted absolute left-3 pointer-events-none" />
          <input
            type="text"
            id="playlist_search"
            placeholder="Filtra canzoni nella libreria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-brand-bg border border-brand-border rounded py-1.5 pl-9 pr-3 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent/50 font-mono"
          />
        </div>
      )}

      {/* 3. Batch Mode Control Desk */}
      {isBatchMode && !isBatchProcessing && (
        <div className="bg-brand-bg/50 border border-brand-accent/15 p-3.5 rounded flex flex-col gap-3 animate-fade-in font-sans">
          
          {/* Quick Select Buttons */}
          <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
            <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
              Passo 1. Seleziona Tracce
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTracks}
                className="text-[9px] font-mono font-extrabold text-brand-accent hover:underline cursor-pointer uppercase"
              >
                Tutte
              </button>
              <span className="text-[9px] text-neutral-700 font-mono">•</span>
              <button
                type="button"
                onClick={deselectAllTracks}
                className="text-[9px] font-mono font-extrabold text-brand-muted hover:underline cursor-pointer uppercase"
              >
                Nessuna
              </button>
            </div>
          </div>

          {/* Style Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
              Passo 2. Scegli Stile AI
            </label>
            <select
              value={batchStyle}
              onChange={(e) => setBatchStyle(e.target.value as RemasterStyle)}
              className="w-full bg-brand-bg border border-brand-border rounded p-2 text-xs text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 cursor-pointer font-medium"
            >
              {BATCH_STYLES.map(style => (
                <option key={style.id} value={style.id} className="bg-neutral-950 text-white">
                  {style.emoji} {style.name}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-neutral-500 leading-tight italic">
              {BATCH_STYLES.find(s => s.id === batchStyle)?.desc}
            </span>
          </div>

          {/* Custom prompt */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
              Passo 3. Istruzioni Custom (Opzionale)
            </label>
            <input
              type="text"
              value={batchPrompt}
              onChange={(e) => setBatchPrompt(e.target.value)}
              placeholder="Es. 'Enfatizza i sub-bassi' o 'Voci limpidissime'..."
              className="w-full bg-brand-bg border border-brand-border hover:border-brand-border/80 focus:border-brand-accent focus:outline-none rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 font-mono"
            />
          </div>

          {/* Digital format */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
              Passo 4. Formato di Esportazione
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BATCH_FORMATS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setBatchFormat(f.id as any)}
                  className={`py-1 px-1.5 rounded border text-[9px] font-mono font-bold text-left transition-all ${
                    batchFormat === f.id
                      ? 'bg-brand-accent/5 border-brand-accent text-white'
                      : 'bg-brand-bg border-brand-border text-neutral-500 hover:border-brand-border/80'
                  }`}
                  title={f.desc}
                >
                  <div className="truncate">{f.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="button"
            onClick={startBatchProcessing}
            disabled={selectedTrackIds.size === 0}
            className="w-full mt-1.5 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-black text-xs uppercase tracking-widest rounded transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-accent/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Remasterizza e Scarica ({selectedTrackIds.size})
          </button>

        </div>
      )}

      {/* 4. Active Batch Processing Dashboard */}
      {isBatchProcessing && (
        <div className="bg-brand-bg border border-brand-accent/20 p-4 rounded flex flex-col gap-3 animate-pulse font-mono">
          <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
            <div className="flex items-center gap-1.5 text-brand-accent font-bold text-[10px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>ELABORAZIONE BATCH ATTIVA</span>
            </div>
            <button
              onClick={handleAbort}
              className="text-[9px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
              title="Annulla operazione batch"
            >
              <X className="w-3 h-3" />
              ANNULLA
            </button>
          </div>

          {/* Queue Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] text-brand-muted font-bold">
              <span>PROGRESSO TOTALE ({completedCount}/{totalCount})</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-brand-bg border border-brand-border rounded overflow-hidden">
              <div 
                className="h-full bg-brand-accent transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Current Active Item State */}
          {activeItem && (
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded text-[10px] flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-white">
                <span className="font-bold truncate max-w-[180px]">{activeItem.name}</span>
                <span className="text-brand-accent uppercase font-black text-[9px]">
                  {activeItem.status === 'ai_tuning' ? 'AI Calibration' : `Baking ${activeItem.progress}%`}
                </span>
              </div>
              <div className="w-full h-1 bg-neutral-950 rounded overflow-hidden">
                <div 
                  className="h-full bg-brand-accent transition-all"
                  style={{ width: `${activeItem.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Tracks List (Shows checkboxes when in batch mode) */}
      <div className="flex-1 overflow-y-auto max-h-[220px] lg:max-h-[260px] pr-1 flex flex-col gap-1.5">
        {filteredPlaylist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-brand-muted text-center font-sans">
            <Music className="w-7 h-7 stroke-1 text-brand-dark-muted mb-1.5 animate-pulse" />
            <span className="text-xs">Nessun brano trovato</span>
            <span className="text-[10px] mt-0.5 text-neutral-500 max-w-[180px] leading-relaxed">
              Trascina un file locale o clicca sopra per caricare i brani demo.
            </span>
          </div>
        ) : (
          filteredPlaylist.map((track) => {
            const isActive = currentTrack?.id === track.id;
            const isSelected = selectedTrackIds.has(track.id);
            const queueState = batchQueue.find(q => q.id === track.id);

            const handleItemClick = () => {
              if (isBatchProcessing) return;
              if (isBatchMode) {
                toggleTrackSelection(track.id);
              } else {
                onTrackSelect(track);
              }
            };

            return (
              <div
                key={track.id}
                id={`track_item_${track.id}`}
                className={`group flex items-center justify-between p-2.5 rounded border transition-all cursor-pointer ${
                  isActive && !isBatchMode
                    ? 'bg-brand-accent/5 border-brand-accent/30 text-brand-accent'
                    : isSelected && isBatchMode
                    ? 'bg-emerald-500/5 border-emerald-500/30 text-white'
                    : 'bg-brand-bg/40 hover:bg-brand-bg border-brand-border/60 text-brand-text'
                } ${isBatchProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleItemClick}
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                  
                  {/* Left-side Selector: Checkbox in batch mode, play/equalizer in normal mode */}
                  {isBatchMode ? (
                    <button
                      type="button"
                      disabled={isBatchProcessing}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackSelection(track.id);
                      }}
                      className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-700 shrink-0" />
                      )}
                    </button>
                  ) : (
                    /* Dynamic Gradient Cover art thumbnail */
                    <div
                      className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow"
                      style={{ background: track.coverColor }}
                    >
                      {isActive ? (
                        <div className="flex items-end gap-[2px] h-3">
                          <span className="w-[3px] bg-[#00f5d4] rounded-full animate-[bounce_0.8s_infinite]" />
                          <span className="w-[3px] bg-[#00f5d4] rounded-full animate-[bounce_0.5s_infinite]" />
                          <span className="w-[3px] bg-[#00f5d4] rounded-full animate-[bounce_0.7s_infinite]" />
                        </div>
                      ) : (
                        <Music className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}

                  {/* Track Meta Details */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate group-hover:text-brand-accent transition-colors">
                      {track.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-brand-muted">
                      <span className="truncate">{track.artist}</span>
                      <span className="text-brand-dark-muted">•</span>
                      <span className="shrink-0 uppercase bg-brand-bg text-[8px] font-mono font-bold px-1.5 py-0.5 rounded text-brand-muted border border-brand-border">
                        {track.format}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Area: Duration, Status Indicator, or Delete Trigger */}
                <div className="flex items-center gap-2.5 ml-2 shrink-0">
                  
                  {/* Status indicator in batch processing queue */}
                  {isBatchMode && queueState && (
                    <div className="font-mono text-[9px] font-bold">
                      {queueState.status === 'idle' && (
                        <span className="text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">Coda</span>
                      )}
                      {queueState.status === 'ai_tuning' && (
                        <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 animate-pulse">Tuning</span>
                      )}
                      {queueState.status === 'rendering' && (
                        <span className="text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded border border-brand-accent/20">
                          Render {queueState.progress}%
                        </span>
                      )}
                      {queueState.status === 'done' && (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> OK
                        </span>
                      )}
                      {queueState.status === 'failed' && (
                        <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center gap-0.5">
                          ERR
                        </span>
                      )}
                    </div>
                  )}

                  {/* Duration display */}
                  <span className="text-[11px] font-mono text-brand-muted">
                    {Math.floor(track.duration / 60)}:{(Math.floor(track.duration % 60)).toString().padStart(2, '0')}
                  </span>
                  
                  {/* Delete button (Hidden in batch mode or processing) */}
                  {!isBatchMode && !isBatchProcessing && (
                    <button
                      id={`btn_delete_track_${track.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTrack(track.id);
                      }}
                      className="p-1.5 rounded text-brand-muted hover:text-rose-400 hover:bg-brand-bg/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                      title="Rimuovi brano"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
