/**
 * Dual-Decoder Lookahead Pool (0ms Cut & B-Roll Transitions)
 * Maintains a 2-slot <video> pool for A-Roll and a 2-slot <video> pool for B-Roll.
 * Pre-seeks inactive video elements 500ms before reaching cut boundaries or upcoming B-Roll.
 */

export class VideoPlayerPool {
  private playerA: HTMLVideoElement | null = null;
  private playerB: HTMLVideoElement | null = null;
  private activePlayerSlot: 'A' | 'B' = 'A';
  private currentClipId: string | null = null;
  private isMounted = false;
  private lastPreseekTime: number | null = null;

  constructor() {
    this.initPlayers();
  }

  private initPlayers() {
    if (typeof document === 'undefined') return;

    this.playerA = document.createElement('video');
    this.playerB = document.createElement('video');

    [this.playerA, this.playerB].forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.style.position = 'fixed';
      v.style.top = '-9999px';
      v.style.left = '-9999px';
      v.style.width = '1px';
      v.style.height = '1px';
      v.style.opacity = '0';
      v.style.pointerEvents = 'none';
      document.body.appendChild(v);
    });

    this.isMounted = true;
  }

  public getActivePlayer(): HTMLVideoElement | null {
    if (!this.isMounted) this.initPlayers();
    return this.activePlayerSlot === 'A' ? this.playerA : this.playerB;
  }

  public getInactivePlayer(): HTMLVideoElement | null {
    if (!this.isMounted) this.initPlayers();
    return this.activePlayerSlot === 'A' ? this.playerB : this.playerA;
  }

  public prepareClip(clipId: string, url: string, sourceStart: number) {
    if (this.currentClipId === clipId) return;

    const nextPlayer = this.getInactivePlayer();
    if (!nextPlayer) return;

    if (nextPlayer.src !== url) {
      nextPlayer.src = url;
    }
    nextPlayer.currentTime = sourceStart;
    this.currentClipId = clipId;
  }

  /**
   * Pre-seeks the inactive player to targetTimestamp 500ms in advance
   * so hardware video frames are primed before boundary leap.
   */
  public preseek(targetTimestamp: number, url?: string) {
    const inactive = this.getInactivePlayer();
    if (!inactive) return;

    if (url && inactive.src !== url) {
      inactive.src = url;
    }

    if (this.lastPreseekTime === null || Math.abs(this.lastPreseekTime - targetTimestamp) > 0.08) {
      inactive.currentTime = Math.max(0, targetTimestamp);
      this.lastPreseekTime = targetTimestamp;
    }
  }

  public swap() {
    this.activePlayerSlot = this.activePlayerSlot === 'A' ? 'B' : 'A';
    this.lastPreseekTime = null;
  }

  public syncTime(time: number, isPlaying: boolean) {
    const active = this.getActivePlayer();
    if (!active) return;

    if (Math.abs(active.currentTime - time) > 0.15) {
      active.currentTime = time;
    }

    if (isPlaying && active.paused) {
      active.play().catch(() => {});
    } else if (!isPlaying && !active.paused) {
      active.pause();
    }
  }

  public destroy() {
    this.playerA?.remove();
    this.playerB?.remove();
    this.playerA = null;
    this.playerB = null;
    this.isMounted = false;
    this.currentClipId = null;
    this.lastPreseekTime = null;
  }
}

/**
 * High-Level Dual-Track Decoder Lookahead Pool:
 * Manages 2 slots for A-Roll and 2 slots for B-Roll simultaneously.
 */
export class DualTrackDecoderPool {
  public readonly aRollPool = new VideoPlayerPool();
  public readonly bRollPool = new VideoPlayerPool();

  /**
   * 500ms Lookahead scanner: primes decoders right before cut or B-Roll boundaries.
   */
  public checkLookahead(
    currentTime: number,
    lookaheadUpcomingCutTarget: number | null,
    lookaheadUpcomingBRoll: { url: string; start: number } | null
  ) {
    // 1. A-Roll cut lookahead
    if (lookaheadUpcomingCutTarget !== null) {
      this.aRollPool.preseek(lookaheadUpcomingCutTarget);
    }

    // 2. B-Roll appearance lookahead
    if (lookaheadUpcomingBRoll !== null) {
      this.bRollPool.preseek(lookaheadUpcomingBRoll.start, lookaheadUpcomingBRoll.url);
    }
  }

  public destroy() {
    this.aRollPool.destroy();
    this.bRollPool.destroy();
  }
}
