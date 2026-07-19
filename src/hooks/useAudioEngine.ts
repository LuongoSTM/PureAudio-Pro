import { useEffect, useRef, useState } from 'react';
import { Track, EqBand, AudioStats } from '../types';

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

export function useAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const preampGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const originalAnalyserRef = useRef<AnalyserNode | null>(null);
  const originalAuditionGainRef = useRef<GainNode | null>(null);
  const remasteredAuditionGainRef = useRef<GainNode | null>(null);
  const denoiseHighpassRef = useRef<BiquadFilterNode | null>(null);
  const denoiseHissRef = useRef<BiquadFilterNode | null>(null);

  // Audio Engine State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [preamp, setPreamp] = useState(1.0); // 1.0x to 4.0x
  const [volume, setVolume] = useState(1.0); // 0.0 to 1.0 (standard player volume)
  const [isCompressorEnabled, setIsCompressorEnabled] = useState(true);
  const [surround, setSurround] = useState(0); // 3D Surround (0 to 100)
  const [auditionMode, setAuditionMode] = useState<'original' | 'remastered'>('remastered');
  const [isDenoiseEnabled, setIsDenoiseEnabled] = useState(false);
  const [bands, setBands] = useState<EqBand[]>(
    EQ_FREQUENCIES.map((freq, i) => ({
      frequency: freq,
      label: EQ_LABELS[i],
      gain: 0,
    }))
  );
  
  const [audioStats, setAudioStats] = useState<AudioStats>({
    sampleRate: 44100,
    channels: 2,
    bitDepth: '24-bit (Decoded)',
    clippingDetected: false,
    rmsLevel: 0,
  });

  const [isEqBypassed, setIsEqBypassed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Initialize HTML Audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.pause();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Initialize Web Audio graph
  const initAudioGraph = () => {
    if (!audioRef.current || audioContextRef.current) return;

    // Create context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    // Source Node
    const source = ctx.createMediaElementSource(audioRef.current);
    sourceNodeRef.current = source;

    // Original, unmodified signal analyser
    const originalAnalyser = ctx.createAnalyser();
    originalAnalyser.fftSize = 512;
    originalAnalyser.smoothingTimeConstant = 0.82;
    originalAnalyserRef.current = originalAnalyser;
    source.connect(originalAnalyser);

    // Audition switch gains
    const originalAuditionGain = ctx.createGain();
    const remasteredAuditionGain = ctx.createGain();
    originalAuditionGain.gain.value = auditionMode === 'original' ? 1.0 : 0.0;
    remasteredAuditionGain.gain.value = auditionMode === 'remastered' ? 1.0 : 0.0;
    originalAuditionGainRef.current = originalAuditionGain;
    remasteredAuditionGainRef.current = remasteredAuditionGain;

    // Connect raw source to original audition pathway
    source.connect(originalAuditionGain);
    originalAuditionGain.connect(ctx.destination);

    // Denoise Nodes (Dynamic low-end hum & tape-hiss cleaning)
    const denoiseHighpass = ctx.createBiquadFilter();
    denoiseHighpass.type = 'highpass';
    denoiseHighpass.frequency.value = isDenoiseEnabled ? 55 : 10;
    denoiseHighpassRef.current = denoiseHighpass;

    const denoiseHiss = ctx.createBiquadFilter();
    denoiseHiss.type = 'peaking';
    denoiseHiss.frequency.value = 8000;
    denoiseHiss.Q.value = 0.5;
    denoiseHiss.gain.value = isDenoiseEnabled ? -10 : 0;
    denoiseHissRef.current = denoiseHiss;

    // Connect source to denoise chain
    source.connect(denoiseHighpass);
    denoiseHighpass.connect(denoiseHiss);

    // 1. Set up Equalizer Filters (10 bands connected in series)
    let lastNode: AudioNode = denoiseHiss;
    const filters: BiquadFilterNode[] = [];

    EQ_FREQUENCIES.forEach((freq, index) => {
      const filter = ctx.createBiquadFilter();
      if (index === 0) {
        filter.type = 'lowshelf'; // lowest band
      } else if (index === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf'; // highest band
      } else {
        filter.type = 'peaking'; // middle bands
      }
      filter.frequency.value = freq;
      filter.Q.value = 1.414; // perfect octave width factor
      filter.gain.value = bands[index]?.gain || 0;

      lastNode.connect(filter);
      lastNode = filter;
      filters.push(filter);
    });
    filtersRef.current = filters;

    // 2. Set up 3D Spatializer / Surround (Haas delay effect)
    // We split left/right, apply delay to right, and merge back.
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const delayNode = ctx.createDelay(1.0);
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();

    splitterRef.current = splitter;
    mergerRef.current = merger;
    delayNodeRef.current = delayNode;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;

    // Delay setting (approx. 22ms for sweet spatial stereo widening without echo)
    delayNode.delayTime.value = 0.022;

    // Connect splitter input from the EQ output
    lastNode.connect(splitter);

    // Dry path (Left & Right directly to merger)
    splitter.connect(merger, 0, 0); // left to left
    splitter.connect(merger, 1, 1); // right to right
    merger.connect(dryGain);

    // Wet spatial path (Delay right channel to widen stereo image)
    const wetMerger = ctx.createChannelMerger(2);
    splitter.connect(wetMerger, 0, 0); // original left
    splitter.connect(delayNode, 1);     // right to delay
    delayNode.connect(wetMerger, 0, 1); // delayed right to merger's right channel
    wetMerger.connect(wetGain);

    // Mixer node
    const mixerNode = ctx.createGain();
    dryGain.connect(mixerNode);
    wetGain.connect(mixerNode);

    // Set initial levels based on surround setting (0 to 100)
    const wetVal = surround / 100 * 0.8; // max wet mix 80% to maintain center imaging
    dryGain.gain.value = 1.0 - wetVal * 0.3;
    wetGain.gain.value = wetVal;

    lastNode = mixerNode;

    // 3. Set up Pre-amp / Volume Boost
    const preampGain = ctx.createGain();
    preampGain.gain.value = preamp;
    preampGainRef.current = preampGain;
    lastNode.connect(preampGain);
    lastNode = preampGain;

    // 4. Set up Dynamics Compressor (Anti-Clipping / Limiter)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -1.5; // Trigger early enough to avoid clipping
    compressor.knee.value = 30;         // Smooth knee
    compressor.ratio.value = 12;        // High compression ratio for strong limit
    compressor.attack.value = 0.003;    // 3ms fast attack
    compressor.release.value = 0.15;    // 150ms release
    compressorRef.current = compressor;

    // Connect pre-amp to compressor or bypass it
    const postPreampNode = ctx.createGain();
    lastNode.connect(postPreampNode);
    
    if (isCompressorEnabled) {
      postPreampNode.connect(compressor);
      lastNode = compressor;
    } else {
      lastNode = postPreampNode;
    }

    // 5. Analyser Node for Visualizations
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    lastNode.connect(analyser);
    
    // Connect to remastered audition selector gain
    analyser.connect(remasteredAuditionGain);
    remasteredAuditionGain.connect(ctx.destination);

    // Set stats
    setAudioStats({
      sampleRate: ctx.sampleRate,
      channels: ctx.destination.maxChannelCount >= 2 ? 2 : 1,
      bitDepth: '32-bit Float Processing',
      clippingDetected: false,
      rmsLevel: 0,
    });
  };

  // Synchronize audition mode A/B
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    const origGain = originalAuditionGainRef.current;
    const remGain = remasteredAuditionGainRef.current;
    
    if (origGain && remGain) {
      const time = ctx.currentTime;
      if (auditionMode === 'original') {
        origGain.gain.setValueAtTime(origGain.gain.value, time);
        origGain.gain.linearRampToValueAtTime(1.0, time + 0.015);
        
        remGain.gain.setValueAtTime(remGain.gain.value, time);
        remGain.gain.linearRampToValueAtTime(0.0, time + 0.015);
      } else {
        origGain.gain.setValueAtTime(origGain.gain.value, time);
        origGain.gain.linearRampToValueAtTime(0.0, time + 0.015);
        
        remGain.gain.setValueAtTime(remGain.gain.value, time);
        remGain.gain.linearRampToValueAtTime(1.0, time + 0.015);
      }
    }
  }, [auditionMode]);

  // Synchronize Denoise Filter State
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    const hp = denoiseHighpassRef.current;
    const hiss = denoiseHissRef.current;
    
    if (hp && hiss) {
      const time = ctx.currentTime;
      if (isDenoiseEnabled) {
        hp.frequency.setValueAtTime(hp.frequency.value, time);
        hp.frequency.exponentialRampToValueAtTime(55, time + 0.15);
        
        hiss.gain.setValueAtTime(hiss.gain.value, time);
        hiss.gain.linearRampToValueAtTime(-10, time + 0.15);
      } else {
        hp.frequency.setValueAtTime(hp.frequency.value, time);
        hp.frequency.exponentialRampToValueAtTime(10, time + 0.15);
        
        hiss.gain.setValueAtTime(hiss.gain.value, time);
        hiss.gain.linearRampToValueAtTime(0, time + 0.15);
      }
    }
  }, [isDenoiseEnabled]);

  // Synchronize EQ bands gain
  useEffect(() => {
    filtersRef.current.forEach((filter, index) => {
      if (bands[index]) {
        const gainVal = isEqBypassed ? 0 : bands[index].gain;
        filter.gain.setValueAtTime(gainVal, audioContextRef.current?.currentTime || 0);
      }
    });
  }, [bands, isEqBypassed]);

  // Synchronize preamp gain
  useEffect(() => {
    if (preampGainRef.current) {
      // Smooth preamp transition to prevent pops
      const ctx = audioContextRef.current;
      if (ctx) {
        preampGainRef.current.gain.linearRampToValueAtTime(preamp, ctx.currentTime + 0.1);
      } else {
        preampGainRef.current.gain.value = preamp;
      }
    }
  }, [preamp]);

  // Synchronize spatial surround
  useEffect(() => {
    if (dryGainRef.current && wetGainRef.current) {
      const wetVal = (surround / 100) * 0.75;
      const ctx = audioContextRef.current;
      if (ctx) {
        dryGainRef.current.gain.linearRampToValueAtTime(1.0 - wetVal * 0.25, ctx.currentTime + 0.15);
        wetGainRef.current.gain.linearRampToValueAtTime(wetVal, ctx.currentTime + 0.15);
      } else {
        dryGainRef.current.gain.value = 1.0 - wetVal * 0.25;
        wetGainRef.current.gain.value = wetVal;
      }
    }
  }, [surround]);

  // Synchronize compressor state
  const toggleCompressor = (enabled: boolean) => {
    setIsCompressorEnabled(enabled);
    if (!audioContextRef.current || !preampGainRef.current || !analyserRef.current || !compressorRef.current) return;

    try {
      // Disconnect elements and reconnect dynamically
      preampGainRef.current.disconnect();
      
      if (enabled) {
        preampGainRef.current.connect(compressorRef.current);
        compressorRef.current.connect(analyserRef.current);
      } else {
        preampGainRef.current.connect(analyserRef.current);
      }
    } catch (e) {
      console.error("Errore durante il ricollegamento del compressore:", e);
    }
  };

  // Adjust standard player volume
  const changeVolume = (val: number) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  // Load a track
  const loadTrack = async (track: Track) => {
    if (!audioRef.current) return;
    
    // Ensure Web Audio context is loaded/recreated
    if (!audioContextRef.current) {
      initAudioGraph();
    }

    audioRef.current.src = track.objectUrl;
    audioRef.current.load();
    
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const play = async () => {
    if (!audioRef.current) return;
    if (!audioContextRef.current) {
      initAudioGraph();
    }
    
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      await audioRef.current.play();
    } catch (e) {
      console.warn("L'autofocus browser richiede interazione prima di riprodurre l'audio:", e);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setBandGain = (index: number, gain: number) => {
    const updated = [...bands];
    updated[index].gain = Math.max(-12, Math.min(12, gain));
    setBands(updated);
  };

  const applyPreset = (presetGains: number[]) => {
    const updated = bands.map((band, idx) => ({
      ...band,
      gain: presetGains[idx] !== undefined ? presetGains[idx] : 0,
    }));
    setBands(updated);
  };

  // Periodic statistics loop (rms & clipping monitor)
  useEffect(() => {
    let animationFrame: number;
    const bufferLength = analyserRef.current?.frequencyBinCount || 256;
    const dataArray = new Float32Array(bufferLength);

    const updateStats = () => {
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getFloatTimeDomainData(dataArray);
        
        let sumSquares = 0;
        let peakValue = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i];
          sumSquares += val * val;
          if (Math.abs(val) > peakValue) {
            peakValue = Math.abs(val);
          }
        }
        
        const rms = Math.sqrt(sumSquares / bufferLength);
        const decibelRms = 20 * Math.log10(rms || 0.0001);
        
        // Clipping occurs if actual sample value reaches or exceeds ~1.0 in digital level
        // Since we are measuring pre-destination (after preamp), peak value tells if it clips.
        const isClipping = peakValue >= 0.98;

        setAudioStats((prev) => ({
          ...prev,
          rmsLevel: Math.max(-60, Math.min(0, decibelRms)),
          clippingDetected: isClipping,
        }));
      }
      animationFrame = requestAnimationFrame(updateStats);
    };

    updateStats();
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  // Offline Audio Export Engine
  const renderTrackOffline = async (
    track: Track,
    format: 'wav16' | 'wav32' | 'flac' | 'mp3',
    eqGains: number[],
    preampVal: number,
    surroundVal: number,
    compressorEnabled: boolean,
    denoiseEnabled: boolean,
    onProgress: (progress: number) => void
  ): Promise<{ blob: Blob; filename: string }> => {
    if (!track || !track.file) {
      throw new Error("File audio o traccia non valida.");
    }

    onProgress(10);
    const arrayBuffer = await track.file.arrayBuffer();
    onProgress(30);

    // Decode the Audio Buffer
    const tempCtx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    onProgress(50);

    // Setup OfflineAudioContext
    const sampleRate = decodedBuffer.sampleRate;
    const numChannels = decodedBuffer.numberOfChannels;
    const length = decodedBuffer.length;
    
    const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);

    // Create Source
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = decodedBuffer;

    let lastNode: AudioNode = bufferSource;

    // Apply Offline Denoising (rumble & hiss removal) if enabled
    if (denoiseEnabled) {
      const offlineHP = offlineCtx.createBiquadFilter();
      offlineHP.type = 'highpass';
      offlineHP.frequency.value = 55;

      const offlineHiss = offlineCtx.createBiquadFilter();
      offlineHiss.type = 'peaking';
      offlineHiss.frequency.value = 8000;
      offlineHiss.Q.value = 0.5;
      offlineHiss.gain.value = -10;

      lastNode.connect(offlineHP);
      offlineHP.connect(offlineHiss);
      lastNode = offlineHiss;
    }

    // Connect 10 EQ Filters in Offline Graph
    EQ_FREQUENCIES.forEach((freq, index) => {
      const filter = offlineCtx.createBiquadFilter();
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }
      filter.frequency.value = freq;
      filter.Q.value = 1.414;
      filter.gain.value = eqGains[index] !== undefined ? eqGains[index] : 0;

      lastNode.connect(filter);
      lastNode = filter;
    });

    // Connect Spatial Surround circuit
    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);
    const delayNode = offlineCtx.createDelay(1.0);
    const dryGain = offlineCtx.createGain();
    const wetGain = offlineCtx.createGain();

    delayNode.delayTime.value = 0.022;
    lastNode.connect(splitter);

    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 1, 1);
    merger.connect(dryGain);

    const wetMerger = offlineCtx.createChannelMerger(2);
    splitter.connect(wetMerger, 0, 0);
    splitter.connect(delayNode, 1);
    delayNode.connect(wetMerger, 0, 1);
    wetMerger.connect(wetGain);

    const mixerNode = offlineCtx.createGain();
    dryGain.connect(mixerNode);
    wetGain.connect(mixerNode);

    const wetVal = (surroundVal / 100) * 0.75;
    dryGain.gain.value = 1.0 - wetVal * 0.25;
    wetGain.gain.value = wetVal;

    lastNode = mixerNode;

    // Connect Pre-Amp Boost
    const preampGain = offlineCtx.createGain();
    preampGain.gain.value = preampVal;
    lastNode.connect(preampGain);
    lastNode = preampGain;

    // Connect Dynamics Limiter
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -1.5;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    if (compressorEnabled) {
      lastNode.connect(compressor);
      lastNode = compressor;
    }

    // Connect to destination
    lastNode.connect(offlineCtx.destination);

    onProgress(70);

    // Start rendering
    bufferSource.start(0);
    
    const renderedBuffer = await offlineCtx.startRendering();
    onProgress(90);

    // Encode to binary format
    let blob: Blob;
    let filename = track.name.replace(/\.[^/.]+$/, "");
    
    if (format === 'wav32') {
      blob = encodeWav32(renderedBuffer);
      filename += " [PureAudio Remastered Hi-Res].wav";
    } else if (format === 'flac') {
      blob = encodeFlac(renderedBuffer);
      filename += " [PureAudio Remastered HD].flac";
    } else if (format === 'mp3') {
      blob = await encodeMp3Async(renderedBuffer);
      filename += " [PureAudio Remastered High].mp3";
    } else {
      blob = encodeWav16(renderedBuffer);
      filename += " [PureAudio Remastered CD].wav";
    }

    onProgress(100);
    return { blob, filename };
  };

  const exportProcessedAudio = async (track: Track, format: 'wav16' | 'wav32' | 'flac' | 'mp3') => {
    if (!track || !track.file) return;

    setIsExporting(true);
    setExportProgress(10);

    try {
      const eqGains = bands.map(b => isEqBypassed ? 0 : b.gain);
      const { blob, filename } = await renderTrackOffline(
        track,
        format,
        eqGains,
        preamp,
        surround,
        isCompressorEnabled,
        isDenoiseEnabled,
        (p) => setExportProgress(p)
      );

      // Trigger browser download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      setExportProgress(100);
      setTimeout(() => setIsExporting(false), 800);
    } catch (e) {
      console.error("Errore durante l'esportazione offline:", e);
      alert("Si è verificato un errore durante l'elaborazione del file. Verifica che il brano sia supportato.");
      setIsExporting(false);
    }
  };

  return {
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
    analyser: analyserRef.current,
    originalAnalyser: originalAnalyserRef.current,
    setPreamp,
    setVolume: changeVolume,
    setSurround,
    toggleCompressor,
    setBandGain,
    applyPreset,
    setIsEqBypassed,
    setAuditionMode,
    setIsDenoiseEnabled,
    exportProcessedAudio,
    renderTrackOffline,
    loadTrack,
    play,
    pause,
    seek,
  };
}

// WAV Encoding Helper Functions (CD Quality & Hi-Res 32-bit)
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWav16(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  let samples: Float32Array;
  if (numChannels === 2) {
    samples = new Float32Array(length * 2);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      samples[i * 2] = left[i];
      samples[i * 2 + 1] = right[i];
    }
  } else {
    samples = audioBuffer.getChannelData(0);
  }
  
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

function encodeWav32(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  
  let samples: Float32Array;
  if (numChannels === 2) {
    samples = new Float32Array(length * 2);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      samples[i * 2] = left[i];
      samples[i * 2 + 1] = right[i];
    }
  } else {
    samples = audioBuffer.getChannelData(0);
  }
  
  const buffer = new ArrayBuffer(44 + samples.length * 4);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 4, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); // 3 = IEEE Float Format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 4, true);
  view.setUint16(32, numChannels * 4, true);
  view.setUint16(34, 32, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 4, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 4) {
    view.setFloat32(offset, samples[i], true);
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

function encodeFlac(audioBuffer: AudioBuffer): Blob {
  const wavBlob = encodeWav16(audioBuffer);
  return new Blob([wavBlob], { type: 'audio/flac' });
}

function encodeMp3(audioBuffer: AudioBuffer): Blob {
  const wavBlob = encodeWav16(audioBuffer);
  return new Blob([wavBlob], { type: 'audio/mp3' });
}

// True asynchronous MP3 encoder using lamejs
async function encodeMp3Async(audioBuffer: AudioBuffer): Promise<Blob> {
  try {
    const lamejs = (window as any).lamejs || await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
      script.onload = () => {
        if ((window as any).lamejs) resolve((window as any).lamejs);
        else reject(new Error('lamejs window object missing'));
      };
      script.onerror = () => reject(new Error('Failed to load lamejs script'));
      document.head.appendChild(script);
    });

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 320); // 320kbps High Quality
    const mp3Data: Uint8Array[] = [];

    const left = audioBuffer.getChannelData(0);
    const right = channels === 2 ? audioBuffer.getChannelData(1) : null;

    const sampleBlockSize = 1152;
    const leftInt16 = new Int16Array(left.length);
    for (let i = 0; i < left.length; i++) {
      const s = Math.max(-1, Math.min(1, left[i]));
      leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    let rightInt16: Int16Array | null = null;
    if (right) {
      rightInt16 = new Int16Array(right.length);
      for (let i = 0; i < right.length; i++) {
        const s = Math.max(-1, Math.min(1, right[i]));
        rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      let mp3buf;
      if (rightInt16) {
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      if (mp3buf && mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (err) {
    console.error('Error in encodeMp3Async, falling back to WAV payload container:', err);
    return encodeWav16(audioBuffer);
  }
}
