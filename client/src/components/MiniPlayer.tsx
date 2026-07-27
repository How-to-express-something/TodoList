import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function MiniPlayer() {
  const { tracks, currentTrack, isPlaying, volume, setVolume, toggle, selectTrack } = useWhiteNoise();
  const navigate = useNavigate();
  const [showVolume, setShowVolume] = useState(false);

  const handlePlayPause = () => {
    if (tracks.length === 0) {
      navigate('/audio');
      return;
    }
    toggle();
  };

  return (
    <div className="mini-player">
      <div
        className="mini-player-track"
        title={currentTrack?.name || '暂无音频'}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate('/audio')}
      >
        {currentTrack ? currentTrack.name : '添加白噪声'}
      </div>
      <div className="mini-player-controls">
        <button
          className="mini-player-btn"
          onClick={handlePlayPause}
          title={isPlaying ? '暂停' : '播放'}
          style={{ width: 28, height: 28, fontSize: 12 }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="btn-icon"
            onClick={() => setShowVolume(!showVolume)}
            title="音量"
            style={{ fontSize: 14, width: 24, height: 24 }}
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔈' : '🔊'}
          </button>
          {showVolume && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.95)', padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ width: 64, height: 4, accentColor: 'var(--accent)' }}
              />
            </div>
          )}
        </div>

        {tracks.length > 1 && (
          <select
            value={currentTrack?.id || ''}
            onChange={e => selectTrack(Number(e.target.value))}
            style={{
              width: 80, fontSize: 11, padding: '2px 4px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', cursor: 'pointer',
            }}
            title="切换曲目"
          >
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.name.slice(0, 10)}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
