/**
 * Token-Anchored Multi-Track Timeline Store (Zustand)
 * Manages B-Roll, Kinetic Titles, Ducked Audio, and 60fps Transient DOM Subscriptions.
 */

import { create } from 'zustand';
import {
  WordToken,
  TimelineClip,
  BRollClip,
  TitleClip,
  AudioDuckingConfig,
  MultiTrackTimelineState,
  CutIntervalSec,
  recalculateAnchoredTimestamps,
  FastTimelineCursor,
  insertBRollOnKeywordSelection,
  insertTitleOnKeywordSelection,
} from '@astral/core';

export interface TimelineStoreState {
  // Transcript & Media Assets
  tokensByMedia: Record<string, WordToken[]>;
  activeTranscriptMediaId: string;
  clips: TimelineClip[];

  // Playhead & Playback
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Multi-Track Overlays & Ducking
  bRollClips: Record<string, BRollClip>;
  titleClips: Record<string, TitleClip>;
  audioDuckingConfig: AudioDuckingConfig;
  duckedKeywords: string[];

  // Fast Timeline Cursor for O(1) sequential lookup & O(log N) seeks
  tokenCursor: FastTimelineCursor<WordToken>;
  activeEdlIntervals: CutIntervalSec[];
  edlCursor: FastTimelineCursor<CutIntervalSec>;

  // Actions
  setActiveTranscriptMediaId: (mediaId: string) => void;
  setTokensByMedia: (updater: (prev: Record<string, WordToken[]>) => Record<string, WordToken[]>) => void;
  setClips: (updater: (prev: TimelineClip[]) => TimelineClip[]) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean | ((prev: boolean) => boolean)) => void;
  setPlaybackSpeed: (speed: number) => void;

  // Overlays
  setBRollClips: (clips: Record<string, BRollClip> | ((prev: Record<string, BRollClip>) => Record<string, BRollClip>)) => void;
  setTitleClips: (clips: Record<string, TitleClip> | ((prev: Record<string, TitleClip>) => Record<string, TitleClip>)) => void;
  setAudioDuckingConfig: (updater: (prev: AudioDuckingConfig) => AudioDuckingConfig) => void;
  addDuckedKeywords: (keywords: string[]) => void;

  // Keyword Anchoring Actions
  insertBRollOnKeywords: (selectedWordIds: string[], sourceFile: File | Blob, defaultDurationSec?: number) => BRollClip | null;
  insertTitleOnKeywords: (selectedWordIds: string[], text?: string, stylePreset?: string) => TitleClip | null;
  reanchorClips: () => void;

  // Fast Cursor Query
  getActiveTokenAtTime: (time: number) => WordToken | null;
  isInsideDeletedRange: (time: number) => boolean;
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => {
  const tokenCursor = new FastTimelineCursor<WordToken>([]);
  const edlCursor = new FastTimelineCursor<CutIntervalSec>([]);

  return {
    tokensByMedia: {},
    activeTranscriptMediaId: '',
    clips: [],

    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1.0,

    bRollClips: {},
    titleClips: {},
    audioDuckingConfig: {
      id: 'track_audio_bgm',
      sourceUrl: '',
      baseVolume: 0.7,
      duckedVolume: 0.15,
      rampUpTime: 0.25,
      rampDownTime: 0.4,
      duckOnSpeech: true,
      duckKeywords: [],
    },
    duckedKeywords: [],

    tokenCursor,
    activeEdlIntervals: [],
    edlCursor,

    setActiveTranscriptMediaId: (mediaId: string) => {
      set({ activeTranscriptMediaId: mediaId });
      const currentTokens = get().tokensByMedia[mediaId] ?? [];
      tokenCursor.setItems(currentTokens.filter(t => !t.deleted));
    },

    setTokensByMedia: (updater) => {
      set((state) => {
        const nextTokensByMedia = updater(state.tokensByMedia);
        const activeTokens = nextTokensByMedia[state.activeTranscriptMediaId] ?? [];
        tokenCursor.setItems(activeTokens.filter(t => !t.deleted));

        // Automatically shift anchored B-Roll and Title timestamps
        const multiTrackState: MultiTrackTimelineState = {
          tracks: {
            aRollTrackId: 'track_video',
            bRollTracks: ['track_stickers'],
            titleTracks: ['track_title'],
            audioTracks: ['track_audio'],
          },
          bRollClips: state.bRollClips,
          titleClips: state.titleClips,
          audioConfigs: { [state.audioDuckingConfig.id]: state.audioDuckingConfig },
          transcriptWords: activeTokens,
        };

        const { bRolls, titles } = recalculateAnchoredTimestamps(multiTrackState);

        return {
          tokensByMedia: nextTokensByMedia,
          bRollClips: bRolls,
          titleClips: titles,
        };
      });
    },

    setClips: (updater) => {
      set((state) => ({ clips: updater(state.clips) }));
    },

    setCurrentTime: (time: number) => {
      set({ currentTime: time });
    },

    setIsPlaying: (isPlayingOrUpdater) => {
      set((state) => ({
        isPlaying: typeof isPlayingOrUpdater === 'function' ? isPlayingOrUpdater(state.isPlaying) : isPlayingOrUpdater,
      }));
    },

    setPlaybackSpeed: (speed: number) => {
      set({ playbackSpeed: speed });
    },

    setBRollClips: (clipsOrUpdater) => {
      set((state) => ({
        bRollClips: typeof clipsOrUpdater === 'function' ? clipsOrUpdater(state.bRollClips) : clipsOrUpdater,
      }));
    },

    setTitleClips: (clipsOrUpdater) => {
      set((state) => ({
        titleClips: typeof clipsOrUpdater === 'function' ? clipsOrUpdater(state.titleClips) : clipsOrUpdater,
      }));
    },

    setAudioDuckingConfig: (updater) => {
      set((state) => ({
        audioDuckingConfig: updater(state.audioDuckingConfig),
      }));
    },

    addDuckedKeywords: (keywords: string[]) => {
      set((state) => {
        const merged = Array.from(new Set([...state.duckedKeywords, ...keywords]));
        return {
          duckedKeywords: merged,
          audioDuckingConfig: {
            ...state.audioDuckingConfig,
            duckKeywords: merged,
          },
        };
      });
    },

    insertBRollOnKeywords: (selectedWordIds: string[], sourceFile: File | Blob, defaultDurationSec = 15.0) => {
      const state = get();
      const words = state.tokensByMedia[state.activeTranscriptMediaId] ?? [];
      if (selectedWordIds.length === 0 || words.length === 0) return null;

      const multiTrackState: MultiTrackTimelineState = {
        tracks: {
          aRollTrackId: 'track_video',
          bRollTracks: ['track_stickers'],
          titleTracks: ['track_title'],
          audioTracks: ['track_audio'],
        },
        bRollClips: state.bRollClips,
        titleClips: state.titleClips,
        audioConfigs: { [state.audioDuckingConfig.id]: state.audioDuckingConfig },
        transcriptWords: words,
      };

      const newClip = insertBRollOnKeywordSelection(selectedWordIds, sourceFile, defaultDurationSec, multiTrackState);
      set((s) => ({
        bRollClips: { ...s.bRollClips, [newClip.id]: newClip },
      }));
      return newClip;
    },

    insertTitleOnKeywords: (selectedWordIds: string[], text?: string, stylePreset = 'lower_third') => {
      const state = get();
      const words = state.tokensByMedia[state.activeTranscriptMediaId] ?? [];
      if (selectedWordIds.length === 0 || words.length === 0) return null;

      const titleText = text || words.filter(w => selectedWordIds.includes(w.id)).map(w => w.text).join(' ') || 'Keyword Title';

      const multiTrackState: MultiTrackTimelineState = {
        tracks: {
          aRollTrackId: 'track_video',
          bRollTracks: ['track_stickers'],
          titleTracks: ['track_title'],
          audioTracks: ['track_audio'],
        },
        bRollClips: state.bRollClips,
        titleClips: state.titleClips,
        audioConfigs: { [state.audioDuckingConfig.id]: state.audioDuckingConfig },
        transcriptWords: words,
      };

      const newClip = insertTitleOnKeywordSelection(selectedWordIds, titleText, multiTrackState, {
        style: {
          fontFamily: 'Inter, sans-serif',
          position: (stylePreset as any) || 'lower_third',
          fontSize: 48,
          color: '#FFFFFF',
          animation: 'fade_pop',
        },
      });
      set((s) => ({
        titleClips: { ...s.titleClips, [newClip.id]: newClip },
      }));
      return newClip;
    },

    reanchorClips: () => {
      const state = get();
      const words = state.tokensByMedia[state.activeTranscriptMediaId] ?? [];
      if (words.length === 0) return;

      const multiTrackState: MultiTrackTimelineState = {
        tracks: {
          aRollTrackId: 'track_video',
          bRollTracks: ['track_stickers'],
          titleTracks: ['track_title'],
          audioTracks: ['track_audio'],
        },
        bRollClips: state.bRollClips,
        titleClips: state.titleClips,
        audioConfigs: { [state.audioDuckingConfig.id]: state.audioDuckingConfig },
        transcriptWords: words,
      };

      const { bRolls, titles } = recalculateAnchoredTimestamps(multiTrackState);
      set({ bRollClips: bRolls, titleClips: titles });
    },

    getActiveTokenAtTime: (time: number) => {
      return tokenCursor.findCurrent(time);
    },

    isInsideDeletedRange: (time: number) => {
      return edlCursor.findCurrent(time) !== null;
    },
  };
});
