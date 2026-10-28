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
  width: customWidth,
  height: customHeight,
  bRollPool,
  aspectRatio = '16:9',
  style,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute canonical canvas dimensions from Aspect Ratio
  const width = customWidth || (aspectRatio === '9:16' ? 1080 : 1920);
  const height = customHeight || (aspectRatio === '9:16' ? 1920 : 1080);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let cancelled = false;
    let animId: number;
    let rvfcId: number;

    const renderFrame = () => {
      // 1. Draw Master A-Roll Base Video
      const aRoll = aRollVideoRef.current;
      if (aRoll && aRoll.readyState >= 2) {
        if (aspectRatio === '9:16' && aRoll.videoWidth > aRoll.videoHeight) {
          // Center-crop 16:9 into 9:16 vertical canvas
          const srcAspect = aRoll.videoWidth / aRoll.videoHeight;
          const targetAspect = 9 / 16;
          const srcW = aRoll.videoHeight * targetAspect;
          const srcX = (aRoll.videoWidth - srcW) / 2;
          ctx.drawImage(aRoll, srcX, 0, srcW, aRoll.videoHeight, 0, 0, width, height);
        } else {
          ctx.drawImage(aRoll, 0, 0, width, height);
        }
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Composite B-Roll Overlay if present
      if (activeBRoll) {
        const bRollVideo = bRollPool.getActivePlayer();
        if (bRollVideo && bRollVideo.readyState >= 2) {
          ctx.save();

          // Calculate Transitions (Fade / Crossfade / Slide / Zoom)
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

        const timeSinceStart = currentTime - title.timelineStart;
        let animatedText = title.text;
        let titleOpacity = 1.0;
        let titleOffsetY = 0;

        // Kinetic text animations: typewriter, fade_pop, slide_up
        if (title.style.animation === 'typewriter') {
          const charProgress = Math.min(1, Math.max(0, timeSinceStart / 0.8));
          const numChars = Math.floor(charProgress * title.text.length);
          animatedText = title.text.slice(0, numChars);
        } else if (title.style.animation === 'fade_pop') {
          const popProgress = Math.min(1, Math.max(0, timeSinceStart / 0.3));
          titleOpacity = popProgress;
        } else if (title.style.animation === 'slide_up') {
          const slideProgress = Math.min(1, Math.max(0, timeSinceStart / 0.35));
          titleOffsetY = (1 - slideProgress) * 40;
          titleOpacity = slideProgress;
        }

        ctx.globalAlpha = titleOpacity;
        ctx.font = `bold ${title.style.fontSize}px ${title.style.fontFamily || 'Inter, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let posY = height * 0.85 + titleOffsetY; // Lower third default
        if (title.style.position === 'center') posY = height * 0.5 + titleOffsetY;
        if (title.style.position === 'top_banner') posY = height * 0.15 + titleOffsetY;
        if (title.style.position === 'custom' && title.style.customY !== undefined) {
          posY = title.style.customY * height + titleOffsetY;
        }

        const posX = width * 0.5;
        const textMetrics = ctx.measureText(animatedText);

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
          ctx.strokeText(animatedText, posX, posY);
        }

        ctx.fillStyle = title.style.color || '#ffffff';
        ctx.fillText(animatedText, posX, posY);
        ctx.restore();
      }
    };

    // Use requestVideoFrameCallback when supported on Chromium, falling back to rAF
    const aRoll = aRollVideoRef.current;
    if (aRoll && typeof (aRoll as any).requestVideoFrameCallback === 'function') {
      const onFrame = () => {
        if (cancelled) return;
        renderFrame();
        rvfcId = (aRoll as any).requestVideoFrameCallback(onFrame);
      };
      rvfcId = (aRoll as any).requestVideoFrameCallback(onFrame);
    } else {
      const loop = () => {
        if (cancelled) return;
        renderFrame();
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (rvfcId && aRoll && typeof (aRoll as any).cancelVideoFrameCallback === 'function') {
        (aRoll as any).cancelVideoFrameCallback(rvfcId);
      }
    };
  }, [activeBRoll, activeTitles, currentTime, width, height, aRollVideoRef, bRollPool, aspectRatio]);

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
