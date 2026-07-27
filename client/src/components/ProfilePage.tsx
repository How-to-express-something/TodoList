import { useState, useEffect } from 'react';
import { todosApi } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import { useNavigate } from 'react-router-dom';
import '../styles/audio.css';

function secondsToDisplay(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function calcLevel(totalSeconds: number): { level: number; next: number; progress: number } {
  const hours = totalSeconds / 3600;
  let level = 1;
  const thresholds = [0, 5, 15, 30, 50, 100, 200, 400, 800];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (hours >= thresholds[i]) { level = i + 1; break; }
  }
  const currentThreshold = thresholds[Math.min(level - 1, thresholds.length - 1)];
  const nextThreshold = thresholds[Math.min(level, thresholds.length - 1)];
  const range = nextThreshold - currentThreshold;
  const progress = range > 0 ? ((hours - currentThreshold) / range) * 100 : 100;
  return { level, next: nextThreshold, progress: Math.min(100, Math.max(0, progress)) };
}

const levelNames = ['', '🌱 新手', '🔥 学徒', '⚡ 进阶', '🌟 达人', '💎 专家', '👑 大师', '🏆 宗师', '🌌 传奇', '✨ 超凡'];

export default function ProfilePage() {
  const [stats, setStats] = useState<{ total: number; count: number } | null>(null);
  const { tracks, currentTrack, isPlaying, volume, setVolume, toggle, selectTrack } = useWhiteNoise();
  const navigate = useNavigate();

  useEffect(() => {
    todosApi.stats().then(setStats).catch(() => {});
  }, []);

  const totalSeconds = stats?.total || 0;
  const { level, next, progress } = calcLevel(totalSeconds);
  const levelName = levelNames[Math.min(level, levelNames.length - 1)] || `Lv.${level}`;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      {/* Level Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f0e4d8, #e8d5c4)',
        borderRadius: 16, padding: 32, marginBottom: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{levelName.split(' ')[0]}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
          {levelName}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Lv.{level}
        </div>

        {/* XP bar */}
        <div style={{ marginTop: 16, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>{secondsToDisplay(totalSeconds)}</span>
            <span>Next: {next}h</span>
          </div>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, #c4956a, #d4a57a)',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12, padding: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>总专注时间</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
            {secondsToDisplay(totalSeconds)}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12, padding: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已完成事务</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
            {stats?.count || 0}
          </div>
        </div>
      </div>

      {/* White Noise Section */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>🎵 白噪声</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/audio')}>
            管理
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            className="mini-player-btn"
            onClick={() => toggle()}
            style={{ width: 32, height: 32, fontSize: 14 }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {tracks.length > 0 && (
            <select
              value={currentTrack?.id || ''}
              onChange={e => selectTrack(Number(e.target.value))}
              style={{
                flex: 1, fontSize: 13, padding: '4px 8px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)',
              }}
            >
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔈</span>
            <input
              type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              style={{ width: 60, height: 4, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🔊</span>
          </div>
        </div>

        {tracks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            暂无白噪声，前往管理添加
          </p>
        )}
      </div>

      {/* Logs Section */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 20,
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>📋 系统日志</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/logs')}>
            查看全部
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          记录所有操作和事件
        </p>
      </div>
    </div>
  );
}
