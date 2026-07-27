import { Router, Request, Response } from 'express';
import db from '../db.cjs';
import { logger } from '../logger.js';

const router = Router();

function closeActiveSegment(todoId: number): number {
  // Find active segment (end_at IS NULL)
  const seg = db.prepare(
    'SELECT * FROM time_segments WHERE todo_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1'
  ).get(todoId) as any;
  if (!seg) return 0;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE time_segments SET end_at = ? WHERE id = ?').run(now, seg.id);

  const elapsed = Math.round((Date.now() - new Date(seg.start_at + 'Z').getTime()) / 1000);
  return Math.max(0, elapsed);
}

// GET /api/todos — list all todos
router.get('/', (_req: Request, res: Response) => {
  const todos = db.prepare('SELECT * FROM todos ORDER BY priority DESC, created_at DESC').all();
  res.json(todos);
});

// GET /api/todos/:id — get single todo with its new ideas
router.get('/:id', (req: Request, res: Response) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
  const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
  res.json({ ...todo as any, ideas, time_segments: segments });
});

// POST /api/todos — create a todo
router.post('/', (req: Request, res: Response) => {
  const { title, description, priority } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(
    'INSERT INTO todos (title, description, priority) VALUES (?, ?, ?)'
  ).run(title.trim(), description || '', priority || 0);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  logger.info('TODO_CREATE', `Created todo: "${title.trim()}"`, { type: 'todo', id: todo.id });
  res.status(201).json(todo);
});

// PUT /api/todos/:id — update a todo
router.put('/:id', (req: Request, res: Response) => {
  const { title, description, status, priority } = req.body;
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  db.prepare(
    `UPDATE todos SET title = ?, description = ?, status = ?, priority = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? (existing as any).title,
    description ?? (existing as any).description,
    status ?? (existing as any).status,
    priority ?? (existing as any).priority,
    req.params.id
  );

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  const updatedFields = Object.entries({ title, description, status, priority })
    .filter(([_, v]) => v !== undefined).map(([k]) => k).join(', ');
  logger.info('TODO_UPDATE', `Updated todo #${req.params.id}: ${updatedFields}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json(todo);
});

// PATCH /api/todos/:id/start — start / resume a todo
router.patch('/:id/start', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  // If already in_progress, just return current state (no-op)
  if ((existing as any).status === 'in_progress') {
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
    const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
    return res.json({ ...todo as any, ideas, time_segments: segments });
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Close any dangling segment and save its time
  const elapsed = closeActiveSegment(parseInt(req.params.id));
  if (elapsed > 0) {
    db.prepare(
      'UPDATE todos SET total_elapsed_seconds = total_elapsed_seconds + ? WHERE id = ?'
    ).run(elapsed, req.params.id);
  }

  // Create new time segment
  db.prepare('INSERT INTO time_segments (todo_id, start_at) VALUES (?, ?)').run(req.params.id, now);

  db.prepare("UPDATE todos SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
  const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
  logger.info('TODO_START', `Started/resumed todo #${req.params.id}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json({ ...todo as any, ideas, time_segments: segments });
});

// PATCH /api/todos/:id/pause — pause a todo
router.patch('/:id/pause', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  // Close active segment and accumulate elapsed time
  const elapsed = closeActiveSegment(parseInt(req.params.id));

  db.prepare(
    'UPDATE todos SET status = ?, total_elapsed_seconds = total_elapsed_seconds + ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run('pending', elapsed, req.params.id);

  logger.info('TODO_PAUSE', `Paused todo #${req.params.id}, +${elapsed}s`, { type: 'todo', id: parseInt(req.params.id) });
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

// PATCH /api/todos/:id/complete — complete a todo
router.patch('/:id/complete', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  // Close active segment and accumulate elapsed time
  const elapsed = closeActiveSegment(parseInt(req.params.id));

  db.prepare(
    'UPDATE todos SET status = ?, total_elapsed_seconds = total_elapsed_seconds + ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run('completed', elapsed, req.params.id);

  logger.info('TODO_COMPLETE', `Completed todo #${req.params.id}, total ${(existing as any).total_elapsed_seconds + elapsed}s`, { type: 'todo', id: parseInt(req.params.id) });
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

// GET /api/todos/stats/summary — aggregate stats
router.get('/stats/summary', (_req: Request, res: Response) => {
  const totalSeconds = db.prepare('SELECT COALESCE(SUM(total_elapsed_seconds), 0) as total FROM todos').get() as any;
  const completedCount = db.prepare("SELECT COUNT(*) as c FROM todos WHERE status = 'completed'").get() as any;
  const totalCount = db.prepare('SELECT COUNT(*) as c FROM todos').get() as any;
  res.json({ total: totalSeconds.total, completed: completedCount.c, totalCount: totalCount.c });
});

// DELETE /api/todos/:id — delete a todo (cascades to ideas)
router.delete('/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Todo not found' });
  logger.info('TODO_DELETE', `Deleted todo #${req.params.id}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json({ success: true });
});

export default router;
