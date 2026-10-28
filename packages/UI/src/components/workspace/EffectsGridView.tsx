import React, { useState } from 'react';
import { ActivityDockTab } from '@astral/core';

export interface EffectsGridViewProps {
  type: 'filters' | 'transitions' | 'titles' | 'stickers';
  onApplyEffect?: (effectName: string) => void;
}

type EffectItem = { name: string; color: string; sub: string; category: string };

export const EffectsGridView: React.FC<EffectsGridViewProps> = ({ type, onApplyEffect }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['Retro Film', 'Cross Dissolve', 'Minimal Modern']));

  const config = {
    filters: {
      title: 'Filters',
      categories: ['All', 'Favorites', 'Featured', 'Cinematic', 'Retro', 'Glitch', 'Blur', 'Vibrant'],
      items: [
        { name: 'Retro Film', color: '#B53471', sub: 'Warm 35mm grain', category: 'Retro' },
        { name: 'Cyberpunk Neon', color: '#168BFF', sub: 'High contrast cyan', category: 'Glitch' },
        { name: 'Golden Sunset', color: '#FFA502', sub: 'Amber warm highlights', category: 'Cinematic' },
        { name: 'Moody B&W', color: '#747D8C', sub: 'Silver haloid monochrome', category: 'Cinematic' },
        { name: 'VHS Distortion', color: '#8854D0', sub: 'Magnetic tape tracking', category: 'Retro' },
        { name: 'Teal & Orange', color: '#00D2D3', sub: 'Blockbuster grade', category: 'Cinematic' },
        { name: 'Soft Bloom', color: '#A29BFE', sub: 'Dreamy diffusion haze', category: 'Blur' },
        { name: 'Featured Punch', color: '#FF6B81', sub: 'Curated highlight punch', category: 'Featured' },
        { name: 'RGB Split', color: '#FF4757', sub: 'Chromatic aberration', category: 'Glitch' },
        { name: 'Noir Fade', color: '#2F3542', sub: 'Lifted shadows black', category: 'Cinematic' },
        { name: 'Polaroid Warm', color: '#E17055', sub: 'Instant vintage print', category: 'Retro' },
        { name: 'Motion Blur Soft', color: '#70A1FF', sub: 'Directional dynamic smear', category: 'Blur' },
        { name: 'Vibrant Pop', color: '#10AC84', sub: 'Vivid saturated punch', category: 'Vibrant' },
        { name: 'Emerald Forest', color: '#05C46B', sub: 'Deep evergreen greens', category: 'Cinematic' },
        { name: 'Sepia Vintage', color: '#CD84F1', sub: 'Antique archival bronze', category: 'Retro' },
        { name: 'Pastel Dream', color: '#FF9FF3', sub: 'Soft aesthetic wash', category: 'Featured' },
        { name: 'Matrix Terminal', color: '#2ED573', sub: 'Phosphor digital CRT', category: 'Glitch' },
        { name: 'Arctic Frost', color: '#48DBFB', sub: 'Cool glacial high-key', category: 'Vibrant' },
        { name: 'Sunset Vignette', color: '#E67E22', sub: 'Amber glow darkened edges', category: 'Cinematic' },
        { name: 'Radial Focus', color: '#575FCF', sub: 'Peripheral lens tilt-shift', category: 'Blur' },
      ] as EffectItem[],
    },
    transitions: {
      title: 'Transitions',
      categories: ['All', 'Favorites', 'Featured', 'Wipe', 'Zoom', 'Geometric', 'Ripple', 'Glitch'],
      items: [
        { name: 'Cross Dissolve', color: '#3867D6', sub: 'Smooth linear overlap', category: 'Featured' },
        { name: 'Whip Pan Right', color: '#2ED573', sub: 'Fast kinetic swipe', category: 'Wipe' },
        { name: 'Glitch Flash', color: '#FF4757', sub: 'RGB chromatic blast', category: 'Glitch' },
        { name: 'Zoom Spin In', color: '#8854D0', sub: 'Dynamic barrel roll', category: 'Zoom' },
        { name: 'Iris Circle', color: '#FFA502', sub: 'Classic film aperture', category: 'Geometric' },
        { name: 'Split Slide', color: '#168BFF', sub: 'Horizontal curtain parting', category: 'Wipe' },
        { name: 'Ripple Push', color: '#00CEC9', sub: 'Wave fluid distortion', category: 'Ripple' },
        { name: 'Hard Cut Flash', color: '#FD79A8', sub: 'White hot exposure flash', category: 'Featured' },
        { name: 'Cube Spin', color: '#6C5CE7', sub: '3D cube face rotation', category: 'Geometric' },
        { name: 'Zoom Blur Out', color: '#0984E3', sub: 'Radial smear exit', category: 'Zoom' },
        { name: 'Whip Pan Left', color: '#10AC84', sub: 'Fast leftward swipe', category: 'Wipe' },
        { name: 'Vertical Blinds', color: '#E17055', sub: 'Shutter slat reveal', category: 'Geometric' },
        { name: 'Swirl Vortex', color: '#00D2D3', sub: 'Twisting spiral wipe', category: 'Ripple' },
        { name: 'Pixelate Dissolve', color: '#6D214F', sub: 'Mosaic digital decay', category: 'Glitch' },
        { name: 'Luma Fade Black', color: '#2C3E50', sub: 'Exposure dip to dark', category: 'Featured' },
        { name: 'Push Up Warp', color: '#F39C12', sub: 'Upward kinetic push', category: 'Wipe' },
        { name: 'Heart Wipe', color: '#EB3B5A', sub: 'Romantic silhouette mask', category: 'Geometric' },
        { name: 'Chaos Static', color: '#D63031', sub: 'Analog noise burst', category: 'Glitch' },
        { name: 'Lens Flare Flash', color: '#F1C40F', sub: 'Anamorphic streak burst', category: 'Featured' },
        { name: 'Diagonal Slash', color: '#8E44AD', sub: 'Angular geometric slice', category: 'Geometric' },
      ] as EffectItem[],
    },
    titles: {
      title: 'Titles & Captions',
      categories: ['All', 'Favorites', 'Minimal', 'Cinematic', 'Social Media', 'Subtitles', 'Bold'],
      items: [
        { name: 'Minimal Modern', color: '#8854D0', sub: 'Clean sans-serif lower third', category: 'Minimal' },
        { name: 'Typewriter Pop', color: '#168BFF', sub: 'Character by character punch', category: 'Minimal' },
        { name: 'Karaoke Glow', color: '#2ED573', sub: 'Word sync lyric highlight', category: 'Subtitles' },
        { name: 'Cinematic Trailer', color: '#FFA502', sub: 'Tracked serif intro card', category: 'Cinematic' },
        { name: 'Social Subscribe', color: '#FF4757', sub: 'Animated callout pill badge', category: 'Social Media' },
        { name: 'Vlog Chapter Marker', color: '#00D2D3', sub: 'Timecode stamp chapter badge', category: 'Social Media' },
        { name: 'Lower Third News', color: '#74B9FF', sub: 'Broadcast live caption bar', category: 'Subtitles' },
        { name: 'Epic Serif Open', color: '#FDCB6E', sub: 'Trailer blockbuster card', category: 'Cinematic' },
        { name: 'Neon Glow Sign', color: '#FF007F', sub: 'Pulsing cyber headline', category: 'Bold' },
        { name: 'Glitch Cyberpunk', color: '#00F0FF', sub: 'Digital offset cyber banner', category: 'Bold' },
        { name: 'Podcast Host Tag', color: '#9B59B6', sub: 'Interview speaker name badge', category: 'Subtitles' },
        { name: 'Clean Elegant Script', color: '#E67E22', sub: 'Luxury signature cursive', category: 'Cinematic' },
        { name: 'Retro 80s Synth', color: '#E056FD', sub: 'Chrome gradient arcade title', category: 'Bold' },
        { name: 'Subtle Bottom Bar', color: '#95A5A6', sub: 'Understated caption line', category: 'Minimal' },
        { name: 'Breaking News Alert', color: '#C0392B', sub: 'Urgent red bulletin strip', category: 'Subtitles' },
        { name: 'Gaming Stream Banner', color: '#27AE60', sub: 'Esports gamer display card', category: 'Social Media' },
        { name: 'Quote Box Accent', color: '#34495E', sub: 'Editorial citation block', category: 'Minimal' },
        { name: 'Bold Impact Headline', color: '#D35400', sub: 'Heavy condensed punchline', category: 'Bold' },
        { name: 'Minimalist Outline', color: '#7F8C8D', sub: 'Ghost stroke typography', category: 'Minimal' },
        { name: 'Golden Luxury Award', color: '#F39C12', sub: 'Shimmering festival laurel', category: 'Cinematic' },
      ] as EffectItem[],
    },
    stickers: {
      title: 'Stickers & Overlays',
      categories: ['All', 'Favorites', 'Emojis', 'Arrows', 'Shapes', 'Social', 'Badges'],
      items: [
        { name: 'Pointing Arrow', color: '#FF4757', sub: 'Red accent locator pointer', category: 'Arrows' },
        { name: 'Like Button Pulse', color: '#168BFF', sub: 'Animated thumbs up button', category: 'Social' },
        { name: 'Sparkle Burst', color: '#FFA502', sub: 'Gold starlight magic burst', category: 'Emojis' },
        { name: 'Heart React', color: '#EB3B5A', sub: 'Pulsing love heart badge', category: 'Emojis' },
        { name: 'Fire Flame', color: '#FF7F50', sub: 'Trending hot fire emblem', category: 'Emojis' },
        { name: 'Checkmark Circle', color: '#2ED573', sub: 'Green verified creator tick', category: 'Badges' },
        { name: 'Subscribe Bell', color: '#FFD32A', sub: 'Golden alert notification bell', category: 'Social' },
        { name: 'Circle Outline', color: '#70A1FF', sub: 'Cyan focus spotlight ring', category: 'Shapes' },
        { name: 'Curved Arrow', color: '#A29BFE', sub: 'Dynamic swooping marker path', category: 'Arrows' },
        { name: '100 Percent Score', color: '#FF3838', sub: 'Double underlined 100 score', category: 'Emojis' },
        { name: 'Star Rating Glow', color: '#F1C40F', sub: 'Five-star golden rating medal', category: 'Badges' },
        { name: 'Warning Hazard', color: '#F39C12', sub: 'Caution hazard triangle sign', category: 'Shapes' },
        { name: 'Party Popper', color: '#9B59B6', sub: 'Celebration confetti blast', category: 'Emojis' },
        { name: 'Target Reticle', color: '#00F0FF', sub: 'Precision sniper crosshair', category: 'Shapes' },
        { name: 'Thumbs Down Vote', color: '#576574', sub: 'Feedback vote thumbs down', category: 'Social' },
        { name: 'Sale Tag Badge', color: '#EE5253', sub: 'Special discount offer tag', category: 'Badges' },
        { name: 'Double Arrow Loop', color: '#10AC84', sub: 'Cycle repeat rewind loop', category: 'Arrows' },
        { name: 'Rocket Launch', color: '#FF9F43', sub: 'Viral moon launch rocket', category: 'Emojis' },
        { name: 'Crown VIP', color: '#E67E22', sub: 'Royalty golden crown emblem', category: 'Badges' },
        { name: 'Speech Bubble', color: '#54A0FF', sub: 'Chat dialogue speech cloud', category: 'Social' },
      ] as EffectItem[],
    },
  }[type];

  const filteredItems = config.items.filter(item => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'Favorites') return favorites.has(item.name);
    return item.category === activeCategory;
  });

  const countLabel = activeCategory === 'All'
    ? `${config.items.length} ${type}`
    : `${filteredItems.length} of ${config.items.length} ${type}`;

  const toggleFavorite = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#181B20',
        padding: '16px 20px',
        overflowY: 'auto',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', margin: 0 }}>
            {config.title}
          </h2>
          <span
            id={`count-badge-${type}`}
            data-testid={`count-badge-${type}`}
            style={{ fontSize: '12px', color: '#636E7B' }}
          >
            ({countLabel})
          </span>
        </div>
      </div>

      {/* Categories Bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {config.categories.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                backgroundColor: isActive ? '#168BFF' : '#22262E',
                color: isActive ? '#FFFFFF' : '#A4B0BE',
                border: 'none',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        {filteredItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#636E7B', padding: '24px 0', textAlign: 'center' }}>
            No presets in this category yet.
          </div>
        )}
        {filteredItems.map(item => {
          const isFav = favorites.has(item.name);
          return (
            <div
              key={item.name}
              draggable={true}
              onDragStart={e => {
                const payload = JSON.stringify({
                  type,
                  name: item.name,
                  color: item.color,
                  sub: item.sub,
                  category: item.category,
                });
                e.dataTransfer.setData('application/scarlet-item', payload);
                e.dataTransfer.setData('text/plain', item.name);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onApplyEffect?.(item.name)}
              style={{
                backgroundColor: '#22262E',
                borderRadius: '12px',
                border: '1px solid #2B303A',
                overflow: 'hidden',
                cursor: 'grab',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.borderColor = '#168BFF';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.borderColor = '#2B303A';
              }}
            >
              <div
                style={{
                  height: '75px',
                  backgroundColor: item.color,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '12px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  onClick={e => toggleFavorite(item.name, e)}
                  title="Favorite"
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    background: 'rgba(0,0,0,0.4)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    color: isFav ? '#FF4757' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {isFav ? '♥' : '♡'}
                </button>
              </div>

              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#FFFFFF' }}>{item.name}</div>
                <div style={{ fontSize: '10px', color: '#636E7B', marginTop: '2px' }}>{item.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
