/**
 * Idle Worker Pre-Warming Service (Phase 5 Item 5)
 * Pre-initializes FFmpeg.wasm and Whisper WebGPU worker inside requestIdleCallback
 * so cold-start latency is eliminated before the user drops a video file.
 */

import { getLoadedFFmpeg } from '../export/wasmExporter';
import { checkWebGpuAvailability } from './whisperService';

let isPrewarmed = false;

export function prewarmWorkers() {
  if (typeof window === 'undefined' || isPrewarmed) return;
  isPrewarmed = true;

  const scheduleTask =
    (window as any).requestIdleCallback ||
    ((cb: () => void) => setTimeout(cb, 1500));

  scheduleTask(async () => {
    try {
      console.log('[Prewarm] Pre-warming WebGPU adapter and FFmpeg WASM runtime in background...');
      // 1. WebGPU adapter pre-flight probe
      await checkWebGpuAvailability();

      // 2. Pre-initialize FFmpeg WASM core
      getLoadedFFmpeg(() => {}, () => {}).catch((err) => {
        console.debug('[Prewarm] Background FFmpeg warmup deferred:', err?.message);
      });
    } catch (e) {
      console.debug('[Prewarm] Prewarm notification:', e);
    }
  });
}
