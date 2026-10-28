/**
 * Real-Time Web Audio API Ducking Graph
 * Smooth volume attenuation of secondary audio whenever A-Roll speech or designated keyword segments are active.
 * Uses linearRampToValueAtTime to eliminate pops, clicks, and micro-stutters.
 */

export interface DuckingConfig {
  baseVolume: number;
  duckedVolume: number;
  rampDuration: number;
}

export class AudioDuckingEngine {
  private audioCtx: AudioContext | null = null;
  private bgGainNode: GainNode | null = null;
  private bgSourceNode: MediaElementAudioSourceNode | null = null;
  private isDucked = false;
  private isInitialized = false;

  public init(bgAudioElement: HTMLAudioElement) {
    if (typeof window === 'undefined') return;
    if (this.isInitialized) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      this.bgGainNode = this.audioCtx.createGain();

      this.bgSourceNode = this.audioCtx.createMediaElementSource(bgAudioElement);
      this.bgSourceNode.connect(this.bgGainNode);
      this.bgGainNode.connect(this.audioCtx.destination);

      this.bgGainNode.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
      this.isInitialized = true;
    } catch (e) {
      console.warn('[AudioDuckingEngine] Web Audio context initialization failed:', e);
    }
  }

  public updateDuckingState(
    currentTime: number,
    isVoicePresent: boolean,
    config: DuckingConfig = { baseVolume: 0.7, duckedVolume: 0.15, rampDuration: 0.25 },
    duckSpans?: Array<{ start: number; end: number }>
  ) {
    if (!this.audioCtx || !this.bgGainNode) return;

    // Resume suspended audio context on user interaction if needed
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const now = this.audioCtx.currentTime;
    const isKeywordDucked = duckSpans ? duckSpans.some(s => currentTime >= s.start && currentTime <= s.end) : false;
    const shouldDuck = isVoicePresent || isKeywordDucked;

    if (shouldDuck && !this.isDucked) {
      // Voice or designated keyword span detected -> Duck background volume smoothly
      this.bgGainNode.gain.cancelScheduledValues(now);
      this.bgGainNode.gain.setValueAtTime(this.bgGainNode.gain.value, now);
      this.bgGainNode.gain.linearRampToValueAtTime(
        config.duckedVolume,
        now + config.rampDuration
      );
      this.isDucked = true;
    } else if (!shouldDuck && this.isDucked) {
      // Voice & keywords ended -> Restore background volume smoothly
      this.bgGainNode.gain.cancelScheduledValues(now);
      this.bgGainNode.gain.setValueAtTime(this.bgGainNode.gain.value, now);
      this.bgGainNode.gain.linearRampToValueAtTime(
        config.baseVolume,
        now + config.rampDuration * 1.5
      );
      this.isDucked = false;
    }
  }

  public destroy() {
    try {
      this.audioCtx?.close().catch(() => {});
    } catch {}
    this.audioCtx = null;
    this.bgGainNode = null;
    this.bgSourceNode = null;
    this.isInitialized = false;
    this.isDucked = false;
  }
}
