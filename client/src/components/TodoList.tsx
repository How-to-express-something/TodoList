import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { todosApi } from '../api';
import type { Todo } from '../types';
import '../styles/todo.css';

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingField, setEditingField] = useState<'title' | 'desc'>('title');

  const navigate = useNavigate();

  const loadTodos = async () => {
    try {
      setLoading(true);
      const data = await todosApi.list();
      setTodos(data);
    } catch (e) {
      console.error('Failed to load todos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTodos(); }, []);

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    await todosApi.create({ title: formTitle.trim(), description: formDesc.trim() });
    setFormTitle('');
    setFormDesc('');
    setShowForm(false);
    loadTodos();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除？')) return;
    await todosApi.delete(id);
    loadTodos();
  };

  const handleStart = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await todosApi.start(id);
    navigate(`/todos/${id}?immersion=true`);
  };

  const handleResume = async (id: number, e: React.MouseEvent, isPausedTodo: boolean) => {
    e.stopPropagation();
    // Only call API if actually resuming from paused; if already in_progress, just navigate
    if (isPausedTodo) {
      await todosApi.start(id);
    }
    navigate(`/todos/${id}?immersion=true`);
  };

  const handlePause = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await todosApi.pause(id);
    loadTodos();
  };

  const handleComplete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await todosApi.complete(id);
    loadTodos();
  };

  const handleSaveTitle = async (id: number) => {
    if (!editTitle.trim()) return;
    await todosApi.update(id, { title: editTitle.trim() });
    setEditingId(null);
    loadTodos();
  };

  const handleSaveDesc = async (id: number) => {
    await todosApi.update(id, { description: editDesc });
    setEditingId(null);
    loadTodos();
  };

  const startEditTitle = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditingField('title');
  };

  const startEditDesc = (todo: Todo) => {
    setEditingId(todo.id);
    setEditDesc(todo.description || '');
    setEditingField('desc');
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': return '待开始';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return s;
    }
  };

  const isPaused = (todo: Todo) =>
    todo.status === 'pending' && (todo.total_elapsed_seconds || 0) > 0;

  if (loading) return <div className="page"><p>加载中...</p></div>;

  return (
    <div className="page">
      <div className="todo-list-header">
        <h1 className="page-title">所有事项</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 新建</button>
      </div>

      {todos.length === 0 ? (
        <div className="empty-state">
          <p>暂无待办事项，点击上方按钮创建</p>
        </div>
      ) : (
        todos.map(todo => (
          <div key={todo.id} className={`todo-item ${todo.status}`}>
            <div className={`todo-status-dot ${todo.status}`} />
            <div className="todo-info">
              {editingId === todo.id && editingField === 'title' ? (
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => handleSaveTitle(todo.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTitle(todo.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  style={{ fontSize: 15, fontWeight: 500, width: '100%' }}
                />
              ) : (
                <div
                  className="todo-title"
                  onClick={() => startEditTitle(todo)}
                  style={{ cursor: 'pointer' }}
                >
                  {todo.title}
                  {todo.status !== 'completed' && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>✏️</span>}
                </div>
              )}
              {editingId === todo.id && editingField === 'desc' ? (
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  onBlur={() => handleSaveDesc(todo.id)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setEditingId(null);
                    if (e.key === 'Enter' && e.metaKey) handleSaveDesc(todo.id);
                  }}
                  autoFocus
                  rows={2}
                  style={{ width: '100%', fontSize: 12, resize: 'vertical', marginTop: 4, padding: '4px 8px' }}
                />
              ) : (
                <div
                  className="todo-desc"
                  onClick={() => startEditDesc(todo)}
                  style={{ cursor: 'pointer', color: todo.description ? undefined : 'var(--text-tertiary)', fontStyle: todo.description ? undefined : 'italic' }}
                >
                  {todo.description || '添加备注...'}
                </div>
              )}
              <div className="todo-meta">
                {statusLabel(todo.status)}
                {(todo.total_elapsed_seconds || 0) > 0 && ` · ${Math.floor((todo.total_elapsed_seconds || 0) / 60)} 分钟`}
                {todo.status === 'completed' && ` · ${todo.updated_at?.slice(0, 10)}`}
                {todo.status !== 'completed' && ` · ${todo.created_at?.slice(0, 10)}`}
              </div>
            </div>
            <div className="todo-actions">
              {todo.status === 'pending' && !isPaused(todo) && (
                <button className="btn btn-sm btn-primary" onClick={(e) => handleStart(todo.id, e)}>
                  开始
                </button>
              )}
              {todo.status === 'in_progress' && (
                <>
                  <button className="btn btn-sm btn-primary" onClick={(e) => handleResume(todo.id, e, false)}>
                    继续
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={(e) => handlePause(todo.id, e)}>
                    暂停
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={(e) => handleComplete(todo.id, e)}>
                    完成
                  </button>
                </>
              )}
              {isPaused(todo) && (
                <button className="btn btn-sm btn-primary" onClick={(e) => handleResume(todo.id, e, true)}>
                  继续
                </button>
              )}
              {isPaused(todo) && (
                <button className="btn btn-sm btn-primary" onClick={(e) => handleComplete(todo.id, e)}>
                  完成
                </button>
              )}
              <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(todo.id, e)}>
                删除
              </button>
            </div>
          </div>
        ))
      )}

      {showForm && (
        <div className="todo-form-overlay" onClick={() => setShowForm(false)}>
          <div className="todo-form" onClick={e => e.stopPropagation()}>
            <h3>新建待办</h3>
            <input
              placeholder="标题"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <textarea
              placeholder="描述（可选）"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', borderRadius: 4, border: '1px solid var(--border)', padding: '8px 12px' }}
            />
            <div className="todo-form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
