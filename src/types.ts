export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  size: string; // formatted size e.g. "4.5 MB"
  format: 'mp3' | 'flac' | 'other';
  file: File;
  objectUrl: string;
  coverColor: string; // dynamically generated gradient colors
}

export interface EqBand {
  frequency: number;
  label: string;
  gain: number; // in dB (-12 to +12)
}

export type PresetName = 'Flat' | 'Bass Boost' | 'Treble Boost' | 'Vocal Clarifier' | 'Electronic' | 'Rock' | 'Classical' | 'Acoustic' | 'Jazz' | 'Pop' | 'Hip-Hop' | 'Metal' | 'Reggae' | 'Country' | 'R&B' | 'Custom';

export interface EqPreset {
  name: PresetName;
  gains: number[]; // 10 values for the 10 bands
}

export interface AudioStats {
  sampleRate: number;
  channels: number;
  bitDepth: string;
  clippingDetected: boolean;
  rmsLevel: number; // Root Mean Square (loudness metric)
}
