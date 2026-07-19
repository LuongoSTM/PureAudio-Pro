import React, { useState, useEffect } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { Track } from './types';
import { analyzeTrackAudio } from './lib/analyzer';
import Header from './components/Header';
import Visualizer from './components/Visualizer';
import Equalizer from './components/Equalizer';
import AudioControls from './components/AudioControls';
import Playlist from './components/Playlist';
import TrackDetails from './components/TrackDetails';
import AudioExporter from './components/AudioExporter';
import AiRemasterConsole from './components/AiRemasterConsole';
import { HelpCircle, Sparkles, Disc, Waves, ShieldCheck } from 'lucide-react';

// WAV encoder for synthesized demo track
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function writeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // Format chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // Data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Generate beautiful relaxing ambient chord sweep to test equalizer immediately
function generateOfflineSynthTrack() {
  const sampleRate = 44100;
  const duration = 20; // 20 seconds
  const numSamples = sampleRate * duration;
  const samples = new Float32Array(numSamples);

  // C Major 9 chord frequencies: C3, G3, B3, D4, G4
  const freqs = [130.81, 196.00, 246.94, 293.66, 392.00];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Harmonic overlay
    let wave = 0;
    freqs.forEach((f, idx) => {
      // Gentle frequency sweeping modulation
      const mod = 1.0 + 0.002 * Math.sin(2 * Math.PI * 0.4 * t + idx);
      const subwave = Math.sin(2 * Math.PI * (f * mod) * t);
      
      // Filter frequency sweep simulation (resonance)
      const sweepHz = 350 + 250 * Math.sin(2 * Math.PI * 0.1 * t);
      const isFiltered = (f < sweepHz);
      
      wave += isFiltered ? subwave * (1 / (idx + 1)) : subwave * 0.02;
    });

    // Sub Bass Layer (C2 - 65.4Hz)
    const subBass = Math.sin(2 * Math.PI * 65.41 * t) * 0.35;
    wave += subBass;

    // LFO Volume tremolo
    const tremolo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.2 * t);
    wave *= tremolo;

    // ADSR Amplitude Envelope (Fade in and fade out)
    let env = 1.0;
    if (t < 3.0) {
      env = t / 3.0; // Slow fade-in
    } else if (t > duration - 3.0) {
      env = (duration - t) / 3.0; // Slow fade-out
    }

    samples[i] = wave * env * 0.25; // Safe gain
  }

  const wavBlob = writeWav(samples, sampleRate);
  return new File([wavBlob], 'PureAudio Synthesizer Ambient DSP.wav', { type: 'audio/wav' });
}

export default function App() {
  const {
    isPlaying,
    currentTime,
    duration,
    preamp,
    volume,
    isCompressorEnabled,
    surround,
    bands,
    audioStats,
    isEqBypassed,
    isExporting,
    exportProgress,
    auditionMode,
    isDenoiseEnabled,
    isVolumeBoostEnabled,
    analyser,
    originalAnalyser,
    setPreamp,
    setVolume,
    setSurround,
    toggleCompressor,
    setBandGain,
    applyPreset,
    setIsEqBypassed,
    setAuditionMode,
    setIsDenoiseEnabled,
    setIsVolumeBoostEnabled,
    exportProcessedAudio,
    renderTrackOffline,
    loadTrack,
    play,
    pause,
    seek,
  } = useAudioEngine();

  // Playlist state
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Prevent multiple redundant analysis calls
  const analyzingIdsRef = React.useRef<Set<string>>(new Set());

  // Automatically trigger AI analysis for playlist tracks
  useEffect(() => {
    const unanalyzed = playlist.filter((t) => !t.aiAnalysis && !analyzingIdsRef.current.has(t.id));
    if (unanalyzed.length === 0) return;

    unanalyzed.forEach(async (track) => {
      analyzingIdsRef.current.add(track.id);
      try {
        const analysis = await analyzeTrackAudio(track);
        setPlaylist((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, aiAnalysis: analysis } : t))
        );
        // Sync active current track if its analysis was just completed
        setCurrentTrack((prev) => (prev && prev.id === track.id ? { ...prev, aiAnalysis: analysis } : prev));
      } catch (e) {
        console.error("Errore nell'analisi automatica:", track.name, e);
      }
    });
  }, [playlist]);

  // Handle uploading files (MP3 / FLAC)
  const addFilesToPlaylist = (files: FileList) => {
    const newTracks: Track[] = [];

    Array.from(files).forEach((file) => {
      const isMp3 = file.name.toLowerCase().endsWith('.mp3');
      const isFlac = file.name.toLowerCase().endsWith('.flac');
      const isWav = file.name.toLowerCase().endsWith('.wav');
      
      if (!isMp3 && !isFlac && !isWav) {
        alert(`Il file "${file.name}" non è supportato. Carica solo file MP3, FLAC o WAV.`);
        return;
      }

      const format = isFlac ? 'flac' : isMp3 ? 'mp3' : 'other';
      const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const objectUrl = URL.createObjectURL(file);

      // Elegant linear gradient covers generated dynamically
      const colors = [
        'linear-gradient(135deg, #00f5d4 0%, #006b5d 100%)', // Mint theme
        'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)', // Carbon black
        'linear-gradient(135deg, #006b5d 0%, #151515 100%)', // Deep forest
        'linear-gradient(135deg, #262626 0%, #171717 100%)', // Neutral charcoal
        'linear-gradient(135deg, #00f5d4 0%, #1a1a1a 100%)', // Mint glow
      ];
      const coverColor = colors[Math.floor(Math.random() * colors.length)];

      newTracks.push({
        id: Math.random().toString(36).substring(2, 9),
        name: cleanName,
        artist: 'File Locale',
        album: 'Archivio Importato',
        duration: 0, // Web Audio element will set duration when loaded
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        format: format,
        file: file,
        objectUrl: objectUrl,
        coverColor: coverColor,
      });
    });

    if (newTracks.length > 0) {
      setPlaylist((prev) => [...prev, ...newTracks]);
      
      // Auto-play the first uploaded song if none is selected
      if (!currentTrack) {
        handleTrackSelect(newTracks[0]);
      }
    }
  };

  // Remove a song
  const removeTrack = (id: string) => {
    const isCurrent = currentTrack?.id === id;
    const filtered = playlist.filter((t) => t.id !== id);
    setPlaylist(filtered);

    if (isCurrent) {
      pause();
      setCurrentTrack(null);
      if (filtered.length > 0) {
        handleTrackSelect(filtered[0]);
      }
    }
  };

  // Select and trigger playback of a track
  const handleTrackSelect = async (track: Track) => {
    setCurrentTrack(track);
    await loadTrack(track);
    // Add subtle delay to ensure the browser has parsed source before play trigger
    setTimeout(async () => {
      await play();
    }, 150);
  };

  // Load online sample demo tracks + offline high quality synth
  const loadDemoTracks = async () => {
    setIsLoadingDemo(true);
    const newTracks: Track[] = [];

    // 1. Generate the Offline Synthesizer track (Guaranteed to work completely offline, zero CORS issues!)
    try {
      const synthFile = generateOfflineSynthTrack();
      const synthUrl = URL.createObjectURL(synthFile);
      newTracks.push({
        id: 'synth_demo',
        name: 'PureAudio DSP Synth Sweep',
        artist: 'Sintetizzatore Interno',
        album: 'Sintesi Analogica Virtuale',
        duration: 20,
        size: `${(synthFile.size / (1024 * 1024)).toFixed(1)} MB`,
        format: 'other',
        file: synthFile,
        objectUrl: synthUrl,
        coverColor: 'linear-gradient(135deg, #00f5d4 0%, #006b5d 100%)', // Elegant mint theme
      });
    } catch (e) {
      console.error("Impossibile generare la traccia di sintesi locale:", e);
    }

    // 2. Fetch a couple of high-fidelity online demo tracks (using SoundHelix public samples)
    const demoFiles = [
      {
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        name: 'Deep Chill Resonance (SoundHelix #1)',
        artist: 'SoundHelix Orchestra',
        album: 'Acoustic Odyssey',
      },
      {
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        name: 'Midnight Groove Fusion (SoundHelix #3)',
        artist: 'SoundHelix Band',
        album: 'Electric Neon Wave',
      },
    ];

    for (const fileData of demoFiles) {
      try {
        const res = await fetch(fileData.url);
        if (!res.ok) throw new Error("CORS or Network error");
        const blob = await res.blob();
        const file = new File([blob], `${fileData.name}.mp3`, { type: 'audio/mp3' });
        const objectUrl = URL.createObjectURL(file);

        newTracks.push({
          id: `demo_${Math.random().toString(36).substring(2, 6)}`,
          name: fileData.name,
          artist: fileData.artist,
          album: fileData.album,
          duration: 372, // SoundHelix tracks are typically ~6 mins long
          size: `${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
          format: 'mp3',
          file: file,
          objectUrl: objectUrl,
          coverColor: 'linear-gradient(135deg, #00f5d4 0%, #006b5d 100%)',
        });
      } catch (err) {
        console.warn(`Errore durante il recupero del file remoto ${fileData.name} (probabile restrizione CORS):`, err);
      }
    }

    setPlaylist((prev) => {
      // Prevent duplicates of synth_demo
      const filteredPrev = prev.filter(t => t.id !== 'synth_demo');
      return [...filteredPrev, ...newTracks];
    });

    setIsLoadingDemo(false);

    // Auto select first loaded track
    if (newTracks.length > 0) {
      handleTrackSelect(newTracks[0]);
    }
  };

  // Next Track Logic
  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    
    let nextIndex = 0;
    
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else if (currentTrack) {
      const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
      nextIndex = (currentIndex + 1) % playlist.length;
    }

    handleTrackSelect(playlist[nextIndex]);
  };

  // Previous Track Logic
  const handlePrevTrack = () => {
    if (playlist.length === 0) return;

    let prevIndex = 0;

    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * playlist.length);
    } else if (currentTrack) {
      const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
      prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1;
    }

    handleTrackSelect(playlist[prevIndex]);
  };

  // Handle song ending (for loop/repeat, next track)
  useEffect(() => {
    const audio = document.getElementsByTagName('audio')[0];
    if (!audio) return;

    const handleEnded = () => {
      if (isRepeat) {
        seek(0);
        play();
      } else {
        handleNextTrack();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playlist, currentTrack, isShuffle, isRepeat]);

  // Load initial synthesized track on first load so user has immediate feedback!
  useEffect(() => {
    const initSynth = () => {
      const synthFile = generateOfflineSynthTrack();
      const synthUrl = URL.createObjectURL(synthFile);
      const initialTrack: Track = {
        id: 'synth_demo',
        name: 'PureAudio DSP Synth Sweep',
        artist: 'Sintetizzatore Interno',
        album: 'Sintesi Analogica Virtuale',
        duration: 20,
        size: `${(synthFile.size / (1024 * 1024)).toFixed(1)} MB`,
        format: 'other',
        file: synthFile,
        objectUrl: synthUrl,
        coverColor: 'linear-gradient(135deg, #00f5d4 0%, #006b5d 100%)',
      };
      setPlaylist([initialTrack]);
      setCurrentTrack(initialTrack);
      loadTrack(initialTrack);
    };

    // Initialize with local synth track after short timeout
    const t = setTimeout(initSynth, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div id="main_app_layout" className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col font-sans selection:bg-[#00f5d4]/20 selection:text-[#00f5d4]">
      
      {/* 1. Navigation Header */}
      <Header />

      {/* 2. Main Content Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 md:px-6 lg:py-4 flex flex-col gap-4 lg:h-[calc(100vh-120px)] overflow-hidden">
        
        {/* Top Info Banner - User Guide */}
        <div className="bg-brand-card border border-brand-border rounded p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded bg-brand-accent/10 text-brand-accent mt-0.5 md:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-white tracking-widest uppercase">Algoritmo di Ottimizzazione PureAudio™</h4>
              <p className="text-[11px] text-brand-muted leading-relaxed mt-0.5">
                La traccia musicale ha un volume troppo basso? Usa lo slider <strong className="text-brand-accent font-bold">PRE-AMP BOOST</strong> per amplificare il segnale digitale. L'algoritmo <strong className="text-brand-accent font-bold">Anti-Distorsione Safe</strong> (Dynamics Limiter) livella automaticamente i picchi di frequenza prevenendo la saturazione, garantendo un'acustica eccellente ed impeccabile anche al massimo volume.
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Spectra Visualizer - Panoramic Layout (Both Spectrograms Side-by-Side Full-Width) */}
        <div className="shrink-0">
          <Visualizer 
            analyser={analyser} 
            originalAnalyser={originalAnalyser} 
            isPlaying={isPlaying} 
            auditionMode={auditionMode}
            onAuditionModeChange={setAuditionMode}
          />
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 lg:h-0 lg:items-stretch overflow-hidden">
          
          {/* Left Column: Playlist & Library (3/12 width) */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden">
            <Playlist
              playlist={playlist}
              currentTrack={currentTrack}
              onTrackSelect={handleTrackSelect}
              onRemoveTrack={removeTrack}
              onAddFiles={addFilesToPlaylist}
              onLoadDemoTracks={loadDemoTracks}
              isLoadingDemo={isLoadingDemo}
              renderTrackOffline={renderTrackOffline}
            />
          </div>

          {/* Center Column: TrackDetails, Controls (5/12 width) */}
          <div className="lg:col-span-5 flex flex-col gap-4 h-full overflow-y-auto pr-1">

            {/* Now Playing Info Specs */}
            <TrackDetails 
              track={currentTrack} 
              isPlaying={isPlaying} 
              stats={audioStats}
              preamp={preamp}
            />

             {/* Playback Progress, Volume Boost & 3D Surround */}
            <AudioControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              preamp={preamp}
              volume={volume}
              isCompressorEnabled={isCompressorEnabled}
              isDenoiseEnabled={isDenoiseEnabled}
              isVolumeBoostEnabled={isVolumeBoostEnabled}
              surround={surround}
              onPlayPause={() => (isPlaying ? pause() : play())}
              onNext={handleNextTrack}
              onPrev={handlePrevTrack}
              onSeek={seek}
              onVolumeChange={setVolume}
              onPreampChange={setPreamp}
              onSurroundChange={setSurround}
              onToggleCompressor={toggleCompressor}
              onToggleDenoise={setIsDenoiseEnabled}
              onToggleVolumeBoost={setIsVolumeBoostEnabled}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              onToggleRepeat={() => setIsRepeat(!isRepeat)}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
            />

          </div>

          {/* Right Column: Equalizer, AI Remaster & Exporter (4/12 width) */}
          <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-y-auto pr-1">
            
            {/* 10-Band Graphic Equalizer */}
            <Equalizer
              bands={bands}
              setBandGain={setBandGain}
              applyPreset={applyPreset}
              isEqBypassed={isEqBypassed}
              setIsEqBypassed={setIsEqBypassed}
            />

            {/* AI Mastering & Personal Remastering Console */}
            <AiRemasterConsole
              currentTrack={currentTrack}
              bands={bands}
              onApplyRemaster={(gains, newPreamp, newSurround, compressor) => {
                applyPreset(gains);
                setPreamp(newPreamp);
                setSurround(newSurround);
                toggleCompressor(compressor);
              }}
            />

            {/* Save & Export Audio Panel */}
            <AudioExporter
              currentTrack={currentTrack}
              isExporting={isExporting}
              exportProgress={exportProgress}
              onExport={exportProcessedAudio}
            />

          </div>

        </div>

      </main>

      {/* 3. Footer */}
      <footer className="border-t border-brand-border bg-brand-card py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-brand-muted">
          <span>PureAudio Equalizer & Player v1.5.0 — High-Resolution DSP Engine</span>
          <div className="flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-brand-accent" />
            <span>Frequenza di campionamento attiva: {audioStats.sampleRate} Hz</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
