import React, { useState } from 'react';
import { ScarletButton } from '../common/ScarletButton';
import { IconSparkles } from '../common/ScarletIcons';

export interface AutoCleanButtonProps {
  /** Total word count in the active transcript */
  wordCount: number;
  /** Whether an active media asset is available for transcription */
  hasMedia?: boolean;
  /** Callback fired to execute the 5-step neural audio enhancement pipeline */
  onAutoClean: () => Promise<void>;
}

/**
 * "Audio Enhance & Auto-Clean (AI)" button for the Transcript Editor action bar.
 *
 * Triggers the 5-step audio enhancement & disfluency pruning pipeline:
 * 1. DeepFilterNet3 Waveform Cleanse (strips static, hum, noise)
 * 2. Silero VAD v5 Silence Segmentation (30ms frames, >1.0s cut candidates)
 * 3. Timestamped Token Stream (checks if transcript is already generated, otherwise generates with Whisper-tiny)
 * 4. fdt-disfluency-tiny-4m Sequence Tagging (BIO labels for repetitions, false starts, fillers)
 * 5. 15ms Padded EDL Union (unions adjacent intervals with anti-clipping padding)
 */
export const AutoCleanButton: React.FC<AutoCleanButtonProps> = ({
  wordCount,
  hasMedia = true,
  onAutoClean,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setLoading(true);
      setError(null);
      await onAutoClean();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Disfluency analysis failed';
      setError(msg);
      console.error('[AutoCleanButton]', err);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = !loading && (wordCount > 0 || hasMedia);
  const buttonLabel = loading
    ? 'Cleansing Audio & Fumbles…'
    : wordCount > 0
      ? 'Audio Enhance & Auto-Clean (AI)'
      : 'Audio Enhance & Transcribe (AI)';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <ScarletButton
        id="btn-auto-clean-fumbles"
        variant="additional-v1"
        size="sm"
        icon={<IconSparkles size={14} color="#D97706" />}
        onClick={handleClick}
        disabled={!isEnabled}
        title="5-Step Audio Enhancement: 1. DeepFilterNet3 Waveform Cleanse, 2. Silero VAD Silence Segmentation, 3. Transcript Check (reuses if generated, otherwise runs Whisper-tiny), 4. fdt-disfluency-tiny-4m BIO Tagging, 5. 15ms Padded EDL Union"
      >
        {buttonLabel}
      </ScarletButton>

      {error && (
        <span
          style={{
            fontSize: '10px',
            color: '#FF6B81',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={error}
        >
          ⚠ {error}
        </span>
      )}
    </div>
  );
};
