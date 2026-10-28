import React, { useRef, useEffect } from 'react';
import { BRollClip, TitleClip, AspectRatio } from '@astral/core';
import { VideoPlayerPool } from '../../services/videoPoolManager';

export interface PreviewCompositorProps {
  aRollVideoRef: React.RefObject<HTMLVideoElement>;
  activeBRoll: BRollClip | null;
  activeTitles: TitleClip[];
  currentTime: number;
  width?: number;
  height?: number;
  bRollPool: VideoPlayerPool;
  aspectRatio?: AspectRatio;
  style?: React.CSSProperties;
  className?: string;
}

export const PreviewCompositor: React.FC<PreviewCompositorProps> = ({
  aRollVideoRef,
  activeBRoll,
  activeTitles,
  currentTime,
  width = 1920,
  height = 1080,
  bRollPool,
  aspectRatio = '16:9',
  style,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const renderFrame = () => {
      // 1. Draw Master A-Roll Base Video
      const aRoll = aRollVideoRef.current;
      if (aRoll && aRoll.readyState >= 2) {
        ctx.drawImage(aRoll, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Composite B-Roll Overlay if present
      if (activeBRoll) {
        const bRollVideo = bRollPool.getActivePlayer();
        if (bRollVideo && bRollVideo.readyState >= 2) {
          ctx.save();

          // Calculate Transitions (Fade / Crossfade / Slide)
          let opacity = activeBRoll.transform.opacity ?? 1.0;
          const timeSinceStart = currentTime - activeBRoll.timelineStart;
          const timeUntilEnd = activeBRoll.timelineEnd - currentTime;

          let slideOffsetX = 0;
          let slideOffsetY = 0;
          let zoomScale = 1.0;

          if (activeBRoll.transitionIn && timeSinceStart < activeBRoll.transitionIn.duration && activeBRoll.transitionIn.duration > 0) {
            const progress = Math.max(0, timeSinceStart / activeBRoll.transitionIn.duration);
            if (activeBRoll.transitionIn.type === 'fade' || activeBRoll.transitionIn.type === 'crossfade') {
              opacity *= progress;
            } else if (activeBRoll.transitionIn.type === 'slide_left') {
              slideOffsetX = (1 - progress) * width * 0.5;
            } else if (activeBRoll.transitionIn.type === 'slide_up') {
              slideOffsetY = (1 - progress) * height * 0.5;
            } else if (activeBRoll.transitionIn.type === 'zoom') {
              zoomScale = 0.5 + progress * 0.5;
            }
          }

          if (activeBRoll.transitionOut && timeUntilEnd < activeBRoll.transitionOut.duration && activeBRoll.transitionOut.duration > 0) {
            const progress = Math.max(0, timeUntilEnd / activeBRoll.transitionOut.duration);
            if (activeBRoll.transitionOut.type === 'fade') {
              opacity *= progress;
            } else if (activeBRoll.transitionOut.type === 'slide_right') {
              slideOffsetX = (1 - progress) * width * 0.5;
            } else if (activeBRoll.transitionOut.type === 'zoom') {
              zoomScale = 1.0 + (1 - progress) * 0.5;
            }
          }

          ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

          // Calculate Geometry / PIP coordinates
          const isPip = activeBRoll.transform.fit === 'pip';
          const destW = (isPip ? (activeBRoll.transform.width ?? 0.42) : 1) * width * zoomScale;
          const destH = (isPip ? (activeBRoll.transform.height ?? 0.42) : 1) * height * zoomScale;
          const destX = (activeBRoll.transform.x ?? 0) * width + slideOffsetX;
          const destY = (activeBRoll.transform.y ?? 0) * height + slideOffsetY;

          if (activeBRoll.transform.borderRadius) {
            ctx.beginPath();
            ctx.roundRect(destX, destY, destW, destH, activeBRoll.transform.borderRadius);
            ctx.clip();
          }

          ctx.drawImage(bRollVideo, destX, destY, destW, destH);
          ctx.restore();
        }
      }

      // 3. Render Kinetic Text Titles & Overlays
      for (const title of activeTitles) {
        ctx.save();
        ctx.font = `bold ${title.style.fontSize}px ${title.style.fontFamily || 'Inter, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let posY = height * 0.85; // Lower third default
        if (title.style.position === 'center') posY = height * 0.5;
        if (title.style.position === 'top_banner') posY = height * 0.15;
        if (title.style.position === 'custom' && title.style.customY !== undefined) {
          posY = title.style.customY * height;
        }

        const posX = width * 0.5;
        const textMetrics = ctx.measureText(title.text);

        // Background card
        if (title.style.backgroundColor) {
          ctx.fillStyle = title.style.backgroundColor;
          const padX = 24;
          const padY = 12;
          ctx.fillRect(
            posX - textMetrics.width / 2 - padX,
            posY - title.style.fontSize / 2 - padY,
            textMetrics.width + padX * 2,
            title.style.fontSize + padY * 2
          );
        }

        // Text Stroke & Fill
        if (title.style.strokeColor && title.style.strokeWidth) {
          ctx.strokeStyle = title.style.strokeColor;
          ctx.lineWidth = title.style.strokeWidth;
          ctx.strokeText(title.text, posX, posY);
        }

        ctx.fillStyle = title.style.color || '#ffffff';
        ctx.fillText(title.text, posX, posY);
        ctx.restore();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [activeBRoll, activeTitles, currentTime, width, height, aRollVideoRef, bRollPool]);

  return (
    <canvas
      ref={canvasRef}
      id="preview-compositor-canvas"
      data-testid="preview-compositor-canvas"
      width={width}
      height={height}
      className={`w-full h-full object-contain rounded-lg shadow-2xl bg-black ${className}`}
      style={{
        width: '100%',
        height: '100%',
        objectFit: aspectRatio === '16:9' ? 'contain' : 'cover',
        ...style,
      }}
    />
  );
};
