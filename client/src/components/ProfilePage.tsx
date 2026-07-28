import { useState, useEffect } from 'react';
import { todosApi } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import { useNavigate } from 'react-router-dom';
import type { Todo } from '../types';

function secondsToDisplay(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function calcLevel(totalSeconds: number) {
  const hours = totalSeconds / 3600;
  let level = 1;
  const thresholds = [0, 5, 15, 30, 50, 100, 200, 400, 800];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (hours >= thresholds[i]) { level = i + 1; break; }
  }
  const current = thresholds[Math.min(level - 1, thresholds.length - 1)];
  const next = thresholds[Math.min(level, thresholds.length - 1)];
  const range = next - current;
  const progress = range > 0 ? ((hours - current) / range) * 100 : 100;
  return { level, next, progress: Math.min(100, Math.max(0, progress)) };
}

const levelNames = ['', '🌱 Novice', '🔥 Apprentice', '⚡ Advanced', '🌟 Expert', '💎 Master', '👑 Grandmaster', '🏆 Legend', '🌌 Transcendent', '✨ Divine'];

/* ─── Color thresholds for calendar ─── */
const DEFAULT_OPTIMAL_MIN = 15;  // minutes
const DEFAULT_OPTIMAL_MAX = 60; // minutes

function getDayColor(seconds: number, optMin: number, optMax: number): string {
  if (seconds === 0) return '#ebedf0';
  const mins = seconds / 60;
  if (mins >= optMin && mins <= optMax) return '#216e39'; // optimal
  if (mins > optMax) return '#cb181d'; // too long - red
  return '#7bc96f'; // too short - light green/blue-ish
}

export default function ProfilePage() {
  const [stats, setStats] = useState<{ total: number; completed: number; deleted: number; totalCount: number } | null>(null);
  const { tracks, currentTrack, isPlaying, volume, setVolume, toggle, selectTrack } = useWhiteNoise();
  const navigate = useNavigate();

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calData, setCalData] = useState<Record<string, { count: number; seconds: number }> | null>(null);
  const [optMin, setOptMin] = useState(DEFAULT_OPTIMAL_MIN);
  const [optMax, setOptMax] = useState(DEFAULT_OPTIMAL_MAX);

  // Deleted items
  const [deletedTodos, setDeletedTodos] = useState<Todo[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    todosApi.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    todosApi.calendar(calYear, calMonth).then(res => setCalData(res.days)).catch(() => {});
  }, [calYear, calMonth]);

  useEffect(() => {
    todosApi.deleted().then(setDeletedTodos).catch(() => {});
  }, []);

  const loadAll = () => {
    todosApi.stats().then(setStats).catch(() => {});
    todosApi.calendar(calYear, calMonth).then(res => setCalData(res.days)).catch(() => {});
    todosApi.deleted().then(setDeletedTodos).catch(() => {});
  };

  const handlePrevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  const handlePermanentDelete = async (id: number) => {
    if (!confirm('永久删除？不可恢复！')) return;
    await todosApi.permanentDelete(id);
    loadAll();
  };

  const totalSeconds = stats?.total || 0;
  const { level, next, progress } = calcLevel(totalSeconds);
  const levelName = levelNames[Math.min(level, levelNames.length - 1)] || `Lv.${level}`;

  // Calendar grid
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const gridDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) gridDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) gridDays.push(d);

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      {/* Level Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f0e4d8, #e8d5c4)',
        borderRadius: 16, padding: 28, marginBottom: 20,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>{levelName.split(' ')[0]}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{levelName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Lv.{level}</div>
        <div style={{ marginTop: 12, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>{secondsToDisplay(totalSeconds)}</span>
            <span>Next: {next}h</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #c4956a, #d4a57a)', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Time</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{secondsToDisplay(totalSeconds)}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Completed</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: 'var(--success)' }}>{stats?.completed || 0}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setShowDeleted(!showDeleted)}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Deleted</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: 'var(--danger)' }}>{stats?.deleted || 0} {showDeleted ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Deleted Items */}
      {showDeleted && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 20, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>🗑 Deleted Items</h3>
          {deletedTodos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No deleted items</p>
          ) : (
            deletedTodos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{t.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.deleted_at?.slice(0, 10)}</span>
                <button className="btn btn-sm btn-danger" onClick={() => handlePermanentDelete(t.id)}>Delete Forever</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Calendar Heatmap ─── */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={handlePrevMonth}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{calYear} / {calMonth}</span>
          <button className="btn btn-sm btn-secondary" onClick={handleNextMonth}>▶</button>
        </div>

        {/* Day-of-week labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {gridDays.map((d, i) => {
            if (d === null) return <div key={'e' + i} />;
            const key = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const day = calData?.[key];
            const secs = day?.seconds || 0;
            const color = getDayColor(secs, optMin, optMax);
            return (
              <div key={key} style={{
                aspectRatio: '1', borderRadius: 4,
                background: color, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#333',
                cursor: 'pointer', position: 'relative',
              }}
                title={`${key}: ${day?.count || 0} completed, ${Math.round(secs / 60)} min`}
              >
                <span style={{ color: ['#216e39', '#cb181d'].includes(color) ? '#fff' : '#333', fontWeight: d === new Date().getDate() && calMonth === now.getMonth() + 1 && calYear === now.getFullYear() ? 700 : 400 }}>
                  {d}
                </span>
              </div>
            );
          })}
        </div>

        {/* Color legend + threshold settings */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Less</span>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#7bc96f' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#216e39' }} />
            <div style={{ width: 14, height: 14, borderRadius: 3, background: '#cb181d' }} />
            <span>More</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Optimal:</span>
            <input type="number" value={optMin} onChange={e => setOptMin(parseInt(e.target.value) || 15)} style={{ width: 40, fontSize: 11, padding: '2px 4px' }} /> min
            <span>~</span>
            <input type="number" value={optMax} onChange={e => setOptMax(parseInt(e.target.value) || 60)} style={{ width: 40, fontSize: 11, padding: '2px 4px' }} /> min
          </div>
        </div>
      </div>

      {/* White Noise */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 8, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>🎵 White Noise</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/audio')}>Manage</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="mini-player-btn" onClick={() => toggle()} style={{ width: 32, height: 32, fontSize: 14 }}>{isPlaying ? '⏸' : '▶'}</button>
          {tracks.length > 0 && (
            <select value={currentTrack?.id || ''} onChange={e => selectTrack(Number(e.target.value))}
              style={{ flex: 1, fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>🔈</span>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} style={{ width: 50, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>🔊</span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>📋 Logs</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/logs')}>View All</button>
        </div>
      </div>
    </div>
  );
}
