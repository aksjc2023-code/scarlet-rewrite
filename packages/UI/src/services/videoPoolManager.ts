/**
 * Offscreen 2-Slot Ping-Pong Video Player Pool
 * Eliminates browser decoder stalls and audio pops by recycling two lightweight video DOM elements.
 */

export class VideoPlayerPool {
  private playerA: HTMLVideoElement | null = null;
  private playerB: HTMLVideoElement | null = null;
  private activePlayerSlot: 'A' | 'B' = 'A';
  private currentClipId: string | null = null;
  private isMounted = false;

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

  public swap() {
    this.activePlayerSlot = this.activePlayerSlot === 'A' ? 'B' : 'A';
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
  }
}
