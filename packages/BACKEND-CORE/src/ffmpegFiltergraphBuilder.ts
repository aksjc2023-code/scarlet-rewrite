/**
 * FFmpeg.wasm Multi-Track Complex Filtergraph Generator
 * Compiles timeline tracks, transitions, overlays, and ducked audio into an atomic export pipeline.
 */

import { BRollClip, TitleClip, AudioTrackConfig } from './timelineTypes';

export interface MultiTrackExportParams {
  aRollDuration: number;
  bRolls: BRollClip[];
  titles: TitleClip[];
  bgAudio?: AudioTrackConfig;
  outputWidth?: number;
  outputHeight?: number;
  outputFilename?: string;
}

export function buildFFmpegMultiTrackArgs(params: MultiTrackExportParams): string[] {
  const {
    bRolls,
    titles,
    bgAudio,
    outputWidth = 1920,
    outputHeight = 1080,
    outputFilename = 'final_export.mp4',
  } = params;

  const filterChains: string[] = [];
  const inputArgs: string[] = [];

  // Input 0 is always A-Roll trimmed base: 'aroll_trimmed.mp4'
  inputArgs.push('-i', 'aroll_trimmed.mp4');

  let currentVLayer = '0:v';
  let inputIndex = 1;

  // 1. Process B-Roll Overlay Inputs
  bRolls.forEach((broll, idx) => {
    inputArgs.push('-i', `broll_${idx}.mp4`);
    const brollInput = `${inputIndex}:v`;
    const scaledTag = `broll_scaled_${idx}`;
    const overlayTag = `overlay_${idx}`;

    const isPip = broll.transform.fit === 'pip';
    const destW = Math.round((broll.transform.width || 1) * outputWidth);
    const destH = Math.round((broll.transform.height || 1) * outputHeight);
    const destX = Math.round((broll.transform.x || 0) * outputWidth);
    const destY = Math.round((broll.transform.y || 0) * outputHeight);

    if (isPip) {
      filterChains.push(
        `[${brollInput}]scale=${destW}:${destH}:force_original_aspect_ratio=decrease,pad=${destW}:${destH}:(ow-iw)/2:(oh-ih)/2[${scaledTag}]`
      );
    } else {
      filterChains.push(
        `[${brollInput}]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight}[${scaledTag}]`
      );
    }

    // Apply Overlay timed to timeline start and end
    const enableCondition = `between(t,${broll.timelineStart.toFixed(3)},${broll.timelineEnd.toFixed(3)})`;
    const overlayX = isPip ? destX : 0;
    const overlayY = isPip ? destY : 0;

    filterChains.push(
      `[${currentVLayer}][${scaledTag}]overlay=x=${overlayX}:y=${overlayY}:enable='${enableCondition}'[${overlayTag}]`
    );

    currentVLayer = overlayTag;
    inputIndex++;
  });

  // 2. Process Text Titles via drawtext filters
  titles.forEach((title, idx) => {
    const textLayerTag = `text_${idx}`;
    const enableCondition = `between(t,${title.timelineStart.toFixed(3)},${title.timelineEnd.toFixed(3)})`;
    const escapedText = title.text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/%/g, '%%');

    let yPos = 'h-(h*0.15)';
    if (title.style.position === 'center') {
      yPos = '(h-text_h)/2';
    } else if (title.style.position === 'top_banner') {
      yPos = 'h*0.15';
    } else if (title.style.position === 'custom' && title.style.customY !== undefined) {
      yPos = `h*${title.style.customY.toFixed(2)}`;
    }

    const boxParam = title.style.backgroundColor
      ? ':box=1:boxcolor=black@0.65:boxborderw=12'
      : '';

    const fontColor = title.style.color || 'white';
    const fontSize = title.style.fontSize || 48;

    filterChains.push(
      `[${currentVLayer}]drawtext=text='${escapedText}':fontsize=${fontSize}:` +
      `fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPos}${boxParam}:enable='${enableCondition}'[${textLayerTag}]`
    );

    currentVLayer = textLayerTag;
  });

  // 3. Audio Ducking with sidechaincompress
  let audioMapArg = '0:a';
  if (bgAudio) {
    inputArgs.push('-i', 'bg_music.mp3');
    const bgAudioIndex = inputIndex;

    // A-Roll dialogue ducks background audio via sidechain compression
    const baseVol = bgAudio.baseVolume ?? 0.7;
    filterChains.push(
      `[${bgAudioIndex}:a]volume=${baseVol}[bg_pre]`,
      `[bg_pre][0:a]sidechaincompress=threshold=0.08:ratio=8:attack=100:release=400[ducked_bg]`,
      `[0:a][ducked_bg]amix=inputs=2:duration=first:dropout_transition=2[outa]`
    );
    audioMapArg = '[outa]';
  }

  const complexFilter = filterChains.length > 0 ? filterChains.join(';') : null;

  const resultArgs = [...inputArgs];
  if (complexFilter) {
    resultArgs.push('-filter_complex', complexFilter);
    resultArgs.push('-map', `[${currentVLayer}]`);
    resultArgs.push('-map', audioMapArg);
  }

  resultArgs.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y', outputFilename
  );

  return resultArgs;
}
