import { useState, useEffect } from 'react';
import type { LogEntry } from '../types';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/logs?limit=200');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const handleClear = async () => {
    if (!confirm('确定清空所有日志？')) return;
    await fetch('/api/logs', { method: 'DELETE' });
    loadLogs();
  };

  const handleRefresh = () => loadLogs();

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'var(--danger)';
      case 'warn': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) return <div className="page"><p>加载中...</p></div>;

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="todo-list-header">
        <h1 className="page-title">📋 系统日志</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleRefresh}>🔄 刷新</button>
          <button className="btn btn-danger" onClick={handleClear}>🗑 清空</button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>暂无日志</p>
        </div>
      ) : (
        <div style={{
          background: '#1d1d1f',
          borderRadius: 'var(--radius)',
          padding: 16,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: 12,
          lineHeight: 1.6,
          maxHeight: 'calc(100vh - 180px)',
          overflowY: 'auto',
        }}>
          {logs.map(log => (
            <div key={log.id} style={{
              color: levelColor(log.level),
              padding: '2px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              gap: 12,
            }}>
              <span style={{ color: '#888', minWidth: 20 }}>{log.id}</span>
              <span style={{ color: '#666', minWidth: 160 }}>{log.created_at}</span>
              <span style={{
                minWidth: 60,
                fontWeight: 600,
                color: log.level === 'error' ? '#ff3b30' : log.level === 'warn' ? '#ff9500' : '#4A90D9',
              }}>
                {log.level.toUpperCase()}
              </span>
              <span style={{ color: '#ddd', minWidth: 140, fontWeight: 500 }}>{log.action}</span>
              <span style={{ color: '#aaa' }}>{log.detail}</span>
              {log.entity_type && (
                <span style={{ color: '#666' }}>[{log.entity_type}#{log.entity_id}]</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
