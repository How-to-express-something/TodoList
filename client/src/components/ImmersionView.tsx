import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { todosApi, newIdeasApi } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import type { Todo, NewIdea, TimeSegment } from '../types';

interface Props {
  todo: Todo;
  onPause: () => void;
  onComplete: () => void;
}

function linkify(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#b08050', textDecoration: 'underline' }}>{part}</a>;
    }
    return part;
  });
}

function getActiveSegmentStart(segments: TimeSegment[]): number | null {
  const active = segments.find(s => !s.end_at);
  if (!active) return null;
  return new Date(active.start_at + 'Z').getTime();
}

export default function ImmersionView({ todo, onPause, onComplete }: Props) {
  const navigate = useNavigate();
  const { tracks, currentTrack, isPlaying, volume, setVolume, toggle, pause: pauseMusic, resumeIfPaused, autoPlayForTodo, seek, progress } = useWhiteNoise();

  const [ideas, setIdeas] = useState<NewIdea[]>([]);
  const [ideaInput, setIdeaInput] = useState('');
  const [panelWidth, setPanelWidth] = useState(380);
  const resizing = useRef(false);

  // Timer: use client-side calculation based on server data
  const [tod, setTod] = useState(todo); // mutable todo state
  const baseRef = useRef(todo.total_elapsed_seconds || 0);
  const segStartRef = useRef<number | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(todo.total_elapsed_seconds || 0);
  const [isPaused, setIsPaused] = useState(todo.status !== 'in_progress');

  // Inline editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  const loadIdeas = useCallback(async () => {
    const data = await newIdeasApi.list({ todo_id: todo.id });
    setIdeas(data);
  }, [todo.id]);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  // Sync pause state
  useEffect(() => {
    setIsPaused(todo.status !== 'in_progress');
    setTod(todo);
    baseRef.current = todo.total_elapsed_seconds || 0;
  }, [todo.status, todo.total_elapsed_seconds]);

  // Fetch latest segments to find active segment start
  useEffect(() => {
    if (!isPaused) {
      todosApi.get(todo.id).then(data => {
        setTod(data);
        baseRef.current = data.total_elapsed_seconds || 0;
        if (data.time_segments) {
          segStartRef.current = getActiveSegmentStart(data.time_segments);
        }
      }).catch(() => {});
    }
  }, [isPaused, todo.id]);

  // Accurate timer: compute from total_elapsed_seconds + active segment duration
  useEffect(() => {
    if (!isPaused) {
      // If no segment start known, use current time as approximation
      if (!segStartRef.current) {
        segStartRef.current = Date.now();
      }
      const tick = () => {
        const base = baseRef.current;
        const seg = segStartRef.current;
        if (seg) {
          setDisplaySeconds(base + Math.round((Date.now() - seg) / 1000));
        } else {
          setDisplaySeconds(base);
        }
      };
      tick();
      const interval = setInterval(tick, 500); // 500ms for smooth display
      return () => clearInterval(interval);
    }
  }, [isPaused]);

  const handlePause = async () => {
    setIsPaused(true);
    pauseMusic();
    await onPause();
    // After pause, reload to get updated total_elapsed_seconds from server
    const data = await todosApi.get(todo.id);
    baseRef.current = data.total_elapsed_seconds || 0;
    segStartRef.current = null;
    setDisplaySeconds(data.total_elapsed_seconds || 0);
  };

  const handleResume = async () => {
    const data = await todosApi.start(todo.id);
    baseRef.current = data.total_elapsed_seconds || 0;
    if (data.time_segments) {
      segStartRef.current = getActiveSegmentStart(data.time_segments);
    }
    setIsPaused(false);
    if (tracks.length > 0) {
      resumeIfPaused();
      if (!isPlaying) autoPlayForTodo();
    }
    loadIdeas();
  };

  const handleExit = () => navigate('/todos');

  const handleDone = async () => {
    await onComplete();
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await todosApi.update(todo.id, { title: editTitle.trim() });
    setTod(prev => ({ ...prev, title: editTitle.trim() }));
    setEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    await todosApi.update(todo.id, { description: editDesc });
    setTod(prev => ({ ...prev, description: editDesc }));
    setEditingDesc(false);
  };

  const handleMouseDown = useCallback(() => {
    resizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      setPanelWidth(Math.max(280, Math.min(window.innerWidth - 100, e.clientX)));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const isActuallyPaused = isPaused;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', overflow: 'hidden',
      background: 'linear-gradient(135deg, #fdf6ec 0%, #f5e6d3 30%, #e8d5c4 60%, #f0e6d8 100%)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 40%, rgba(255,200,150,0.12) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* ===== New Idea Panel ===== */}
      <div style={{
        width: panelWidth, minWidth: 280,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        position: 'relative', zIndex: 1,
      }}>
        <div
          onMouseDown={handleMouseDown}
          style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10 }}
        />
        <div style={{ padding: '24px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#5a4a3a', marginBottom: 4 }}>💡 记录灵感</div>
          <div style={{ fontSize: 12, color: '#999' }}>记下每一个新想法</div>
        </div>

        {!isActuallyPaused && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <textarea
              placeholder="输入想法，按 Enter 添加..."
              value={ideaInput}
              onChange={e => setIdeaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (ideaInput.trim()) {
                    newIdeasApi.create({ content: ideaInput.trim(), parent_todo_id: todo.id }).then(idea => {
                      setIdeas(prev => [idea, ...prev]);
                      setIdeaInput('');
                    });
                  }
                }
              }}
              style={{
                width: '100%', minHeight: 56,
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '10px 14px',
                fontSize: 14, resize: 'vertical', background: 'rgba(255,255,255,0.8)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {ideas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 14 }}>暂无想法</div>
          ) : (
            ideas.map(idea => (
              <div key={idea.id} style={{
                padding: '10px 14px', margin: '4px 0', borderRadius: 10, fontSize: 14, lineHeight: 1.5,
                background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.04)',
                display: 'flex', gap: 8, alignItems: 'flex-start', transition: 'box-shadow 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#3a3a3a' }}>{idea.content}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>{idea.created_at?.slice(0, 16)}</div>
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button className="btn-icon" title="提升为待办" onClick={() =>
                    newIdeasApi.promote(idea.id).then(() => setIdeas(prev => prev.filter(i => i.id !== idea.id)))
                  } style={{ fontSize: 14 }}>⬆</button>
                  <button className="btn-icon" title="删除" onClick={() =>
                    newIdeasApi.delete(idea.id).then(() => setIdeas(prev => prev.filter(i => i.id !== idea.id)))
                  } style={{ fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Main area ===== */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1, padding: 40,
      }}>
        {/* Timer */}
        <div style={{
          fontSize: 48, fontWeight: 200, color: '#8a7a6a',
          fontFamily: 'Menlo, Monaco, monospace', letterSpacing: 4, marginBottom: 24,
        }}>
          {fmtTime(displaySeconds)}
        </div>

        {/* Editable title */}
        {editingTitle ? (
          <div style={{ marginBottom: 8, width: '100%', maxWidth: 500, textAlign: 'center' }}>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus
              style={{
                width: '100%', fontSize: 32, fontWeight: 700, textAlign: 'center',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '8px 12px',
                background: 'rgba(255,255,255,0.6)', color: '#5a4a3a', outline: 'none',
              }}
            />
          </div>
        ) : (
          <div style={{
            fontSize: 32, fontWeight: 700, color: '#5a4a3a', marginBottom: 8,
            maxWidth: 500, textAlign: 'center', cursor: isActuallyPaused ? 'default' : 'pointer',
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
            onClick={() => { if (!isActuallyPaused) { setEditingTitle(true); setEditTitle(tod.title); } }}
            title="点击编辑标题"
          >
            {tod.title}{!isActuallyPaused && <span style={{ fontSize: 16, marginLeft: 8, opacity: 0.5 }}>✏️</span>}
          </div>
        )}

        {/* Editable description */}
        {editingDesc ? (
          <div style={{ marginBottom: 8, width: '100%', maxWidth: 500, textAlign: 'center' }}>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
              onBlur={handleSaveDesc}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSaveDesc(); if (e.key === 'Escape') setEditingDesc(false); }}
              autoFocus rows={3}
              style={{
                width: '100%', fontSize: 16, textAlign: 'center', resize: 'vertical',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
                padding: '8px 12px', background: 'rgba(255,255,255,0.6)',
                color: '#8a7a6a', outline: 'none', fontFamily: 'inherit',
              }} />
          </div>
        ) : tod.description ? (
          <div
            style={{ fontSize: 16, color: '#8a7a6a', maxWidth: 500, lineHeight: 1.6, textAlign: 'center', cursor: isActuallyPaused ? 'default' : 'pointer' }}
            onClick={() => { if (!isActuallyPaused) { setEditingDesc(true); setEditDesc(tod.description); } }}
            title="点击编辑备注"
          >
            {linkify(tod.description)}
          </div>
        ) : !isActuallyPaused ? (
          <div
            style={{ fontSize: 16, color: '#b0a090', maxWidth: 500, lineHeight: 1.6, textAlign: 'center', cursor: 'pointer', fontStyle: 'italic' }}
            onClick={() => { setEditingDesc(true); setEditDesc(''); }}
          >
            + 添加备注（可添加网址链接）
          </div>
        ) : null}

        {/* Zen element */}
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,150,0.3) 0%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, marginTop: 32, marginBottom: 32,
          animation: isActuallyPaused ? 'none' : 'immersionPulse 4s ease-in-out infinite',
        }}>
          {isActuallyPaused ? '💤' : '🧘'}
        </div>

        {isActuallyPaused && (
          <div style={{ fontSize: 18, color: '#8a7a6a', fontWeight: 500, marginBottom: 16, fontStyle: 'italic' }}>
            已暂停 — 点击继续恢复
          </div>
        )}

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 28, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 10,
          padding: '0 40px', flexWrap: 'wrap',
        }}>
          <button onClick={handleExit} style={{
            padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)',
            fontSize: 14, color: '#5a4a3a', cursor: 'pointer', fontWeight: 500,
          }}>← 退出</button>

          <button onClick={isActuallyPaused ? handleResume : handlePause} style={{
            padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)',
            fontSize: 14, color: '#5a4a3a', cursor: 'pointer', fontWeight: 500,
          }}>{isActuallyPaused ? '▶ 继续' : '⏸ 暂停'}</button>

          <button onClick={handleDone} style={{
            padding: '10px 22px', borderRadius: 12, border: 'none',
            background: '#5a4a3a', color: '#fff',
            fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>✓ 完成</button>

          {/* Music: speaker + progress bar + volume */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)',
            padding: '6px 14px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {/* Speaker — toggles play/pause */}
            <button onClick={() => toggle()}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: isPlaying ? 'rgba(255,255,255,0.8)' : 'transparent',
                fontSize: 15, color: '#5a4a3a', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >{isPlaying ? '🔊' : '🔇'}</button>

            {/* Progress / seek bar */}
            <div style={{ flex: 1, minWidth: 80, maxWidth: 140, position: 'relative' }}>
              <input type="range" min="0" max="1" step="0.005" value={progress}
                onChange={e => seek(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: 4, accentColor: '#c4956a', cursor: 'pointer',
                  WebkitAppearance: 'none' as any, appearance: 'none',
                }}
                title="播放进度"
              />
              {/* Track name below */}
              <div style={{
                fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentTrack?.name || ''}
              </div>
            </div>

            {/* Volume — horizontal slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>🔈</span>
              <input type="range" min="0" max="1" step="0.05" value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ width: 50, height: 4, accentColor: '#c4956a', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: '#aaa' }}>🔊</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes immersionPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
