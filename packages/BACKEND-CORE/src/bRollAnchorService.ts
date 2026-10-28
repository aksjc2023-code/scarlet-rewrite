/**
 * Keyword-Anchored Insertion Engine
 * Anchors B-Roll & Titles directly to transcript words so subsequent filler removal
 * or speech trimming keeps overlays dynamically snapped to spoken words.
 */

import { MultiTrackTimelineState, BRollClip, TitleClip, TranscriptWordRef } from './timelineTypes';

/**
 * Calculates current active timeline positions for all anchored clips
 * based on live transcript word positions after cut pruning.
 */
export function recalculateAnchoredTimestamps(
  state: MultiTrackTimelineState
): { bRolls: Record<string, BRollClip>; titles: Record<string, TitleClip> } {
  // Calculate dynamic start/end time of each word factoring out deleted words
  let accumulatedTime = 0;
  const wordTimeMap = new Map<string, { start: number; end: number }>();

  for (const w of state.transcriptWords) {
    const isDel = Boolean(w.isDeleted || w.deleted);
    if (isDel) continue;
    const duration = Math.max(0, w.end - w.start);
    wordTimeMap.set(w.id, {
      start: accumulatedTime,
      end: accumulatedTime + duration,
    });
    accumulatedTime += duration;
  }

  const updatedBRolls: Record<string, BRollClip> = {};
  for (const [id, clip] of Object.entries(state.bRollClips)) {
    if (clip.anchorWordIdStart && clip.anchorWordIdEnd) {
      const startInfo = wordTimeMap.get(clip.anchorWordIdStart);
      const endInfo = wordTimeMap.get(clip.anchorWordIdEnd);

      if (startInfo && endInfo) {
        updatedBRolls[id] = {
          ...clip,
          timelineStart: Number(startInfo.start.toFixed(3)),
          timelineEnd: Number(Math.max(startInfo.start + 0.1, endInfo.end).toFixed(3)),
        };
        continue;
      }
    }
    updatedBRolls[id] = clip;
  }

  const updatedTitles: Record<string, TitleClip> = {};
  for (const [id, clip] of Object.entries(state.titleClips)) {
    if (clip.anchorWordIdStart && clip.anchorWordIdEnd) {
      const startInfo = wordTimeMap.get(clip.anchorWordIdStart);
      const endInfo = wordTimeMap.get(clip.anchorWordIdEnd);

      if (startInfo && endInfo) {
        updatedTitles[id] = {
          ...clip,
          timelineStart: Number(startInfo.start.toFixed(3)),
          timelineEnd: Number(Math.max(startInfo.start + 0.1, endInfo.end).toFixed(3)),
        };
        continue;
      }
    }
    updatedTitles[id] = clip;
  }

  return { bRolls: updatedBRolls, titles: updatedTitles };
}

/**
 * Quick-inserts B-Roll directly mapped to a highlighted transcript keyword sequence
 */
export function insertBRollOnKeywordSelection(
  selectedWordIds: string[],
  sourceFile: File | Blob,
  sourceDuration: number,
  state: MultiTrackTimelineState,
  overrides?: Partial<BRollClip>
): BRollClip {
  if (selectedWordIds.length === 0) {
    throw new Error('At least one word must be selected to anchor B-Roll');
  }

  const startId = selectedWordIds[0]!;
  const endId = selectedWordIds[selectedWordIds.length - 1]!;

  const startWord = state.transcriptWords.find((w) => w.id === startId);
  const endWord = state.transcriptWords.find((w) => w.id === endId);

  const tStart = startWord ? startWord.start : 0;
  const tEnd = endWord ? endWord.end : tStart + 2.0;
  const targetDuration = Math.max(0.5, tEnd - tStart);

  let sourceUrl = '';
  if (
    typeof Blob !== 'undefined' &&
    sourceFile instanceof Blob &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    try {
      sourceUrl = URL.createObjectURL(sourceFile);
    } catch {
      sourceUrl = '';
    }
  }

  const idSuffix = Math.random().toString(36).substring(2, 8);
  const clipId = `broll_${Date.now()}_${idSuffix}`;

  return {
    id: clipId,
    trackId: overrides?.trackId ?? 'track_broll_1',
    trackType: 'B_ROLL',
    anchorWordIdStart: startId,
    anchorWordIdEnd: endId,
    timelineStart: tStart,
    timelineEnd: tEnd,
    sourceFile,
    sourceUrl,
    sourceStart: 0,
    sourceEnd: Math.min(sourceDuration, targetDuration),
    transform: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      opacity: 1,
      fit: 'cover',
      ...(overrides?.transform ?? {}),
    },
    transitionIn: overrides?.transitionIn ?? { type: 'fade', duration: 0.25 },
    transitionOut: overrides?.transitionOut ?? { type: 'fade', duration: 0.25 },
    ...overrides,
  };
}

/**
 * Quick-inserts Title Card directly mapped to a highlighted transcript keyword sequence
 */
export function insertTitleOnKeywordSelection(
  selectedWordIds: string[],
  text: string,
  state: MultiTrackTimelineState,
  overrides?: Partial<TitleClip>
): TitleClip {
  if (selectedWordIds.length === 0) {
    throw new Error('At least one word must be selected to anchor Title');
  }

  const startId = selectedWordIds[0]!;
  const endId = selectedWordIds[selectedWordIds.length - 1]!;

  const startWord = state.transcriptWords.find((w) => w.id === startId);
  const endWord = state.transcriptWords.find((w) => w.id === endId);

  const tStart = startWord ? startWord.start : 0;
  const tEnd = endWord ? endWord.end : tStart + 2.5;

  const idSuffix = Math.random().toString(36).substring(2, 8);
  const clipId = `title_${Date.now()}_${idSuffix}`;

  return {
    id: clipId,
    trackId: overrides?.trackId ?? 'track_title_1',
    trackType: 'TITLE',
    anchorWordIdStart: startId,
    anchorWordIdEnd: endId,
    timelineStart: tStart,
    timelineEnd: Math.max(tStart + 0.5, tEnd),
    text,
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 48,
      color: '#FFFFFF',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      position: 'lower_third',
      animation: 'fade_pop',
      ...(overrides?.style ?? {}),
    },
    ...overrides,
  };
}
