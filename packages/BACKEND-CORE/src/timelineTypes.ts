/**
 * Multi-Track Overlay Pipeline State Schema & Types
 * Decouples overlay clips from base A-Roll track while anchoring to transcript word IDs.
 */

export type TrackType = 'A_ROLL' | 'B_ROLL' | 'TITLE' | 'AUDIO_DUCKED';

export interface BaseClip {
  id: string;
  trackId: string;
  trackType: TrackType;
  // Anchoring to transcript words allows cuts/filler removal to automatically shift B-Roll
  anchorWordIdStart?: string;
  anchorWordIdEnd?: string;
  // Fallback absolute timeline positions (seconds)
  timelineStart: number;
  timelineEnd: number;
}

export interface BRollClip extends BaseClip {
  trackType: 'B_ROLL';
  sourceFile?: File | Blob;
  sourceUrl: string;
  sourceStart: number; // In-point in source video
  sourceEnd: number;   // Out-point in source video
  transform: {
    x: number;          // Normalized 0-1
    y: number;
    width: number;      // Normalized 0-1 (1.0 = full frame)
    height: number;
    opacity: number;
    fit: 'cover' | 'contain' | 'pip';
    borderRadius?: number;
  };
  transitionIn?: {
    type: 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'crossfade';
    duration: number; // e.g. 0.3s
  };
  transitionOut?: {
    type: 'fade' | 'slide_right' | 'zoom';
    duration: number;
  };
}

export interface TitleClip extends BaseClip {
  trackType: 'TITLE';
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;    // px or vw
    color: string;
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    position: 'lower_third' | 'center' | 'top_banner' | 'custom';
    customY?: number;
    animation: 'none' | 'fade_pop' | 'typewriter' | 'slide_up';
  };
}

export interface AudioTrackConfig {
  id: string;
  sourceUrl: string;
  baseVolume: number;    // 0.0 to 1.0 (default e.g. 0.7)
  duckedVolume: number;  // 0.0 to 1.0 (default e.g. 0.15)
  rampUpTime: number;    // Lookahead/fade-out in seconds (e.g. 0.25)
  rampDownTime: number;  // Recovery time in seconds (e.g. 0.4)
  duckOnSpeech: boolean; // Auto-duck when A-Roll has voice
  duckKeywords?: string[]; // Extra aggressive ducking or SFX trigger
}

export interface TranscriptWordRef {
  id: string;
  word?: string;
  text?: string;
  start: number;
  end: number;
  isFiller?: boolean;
  isDeleted?: boolean;
  deleted?: boolean;
}

export interface MultiTrackTimelineState {
  tracks: {
    aRollTrackId: string;
    bRollTracks: string[];
    titleTracks: string[];
    audioTracks: string[];
  };
  bRollClips: Record<string, BRollClip>;
  titleClips: Record<string, TitleClip>;
  audioConfigs: Record<string, AudioTrackConfig>;
  // Existing Whisper transcript words reference
  transcriptWords: TranscriptWordRef[];
}
