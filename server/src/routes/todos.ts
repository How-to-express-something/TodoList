import { Router, Request, Response } from 'express';
import db from '../db.cjs';
import { logger } from '../logger.js';

const router = Router();

function closeActiveSegment(todoId: number): number {
  const seg = db.prepare(
    'SELECT * FROM time_segments WHERE todo_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1'
  ).get(todoId) as any;
  if (!seg) return 0;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE time_segments SET end_at = ? WHERE id = ?').run(now, seg.id);

  const elapsed = Math.round((Date.now() - new Date(seg.start_at + 'Z').getTime()) / 1000);
  return Math.max(0, elapsed);
}

// GET /api/todos — list active (not deleted) todos
router.get('/', (_req: Request, res: Response) => {
  const todos = db.prepare("SELECT * FROM todos WHERE deleted_at IS NULL ORDER BY priority DESC, created_at DESC").all();
  res.json(todos);
});

// GET /api/todos/deleted — list deleted todos (for Profile page)
router.get('/deleted', (_req: Request, res: Response) => {
  const todos = db.prepare("SELECT * FROM todos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all();
  res.json(todos);
});

// GET /api/todos/:id — get single todo
router.get('/:id', (req: Request, res: Response) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
  const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
  res.json({ ...todo as any, ideas, time_segments: segments });
});

// POST /api/todos — create
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

// PUT /api/todos/:id — update
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

// PATCH /api/todos/:id/start — start / resume
router.patch('/:id/start', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  if ((existing as any).status === 'in_progress') {
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
    const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
    return res.json({ ...todo as any, ideas, time_segments: segments });
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const elapsed = closeActiveSegment(parseInt(req.params.id));
  if (elapsed > 0) {
    db.prepare('UPDATE todos SET total_elapsed_seconds = total_elapsed_seconds + ? WHERE id = ?').run(elapsed, req.params.id);
  }
  db.prepare('INSERT INTO time_segments (todo_id, start_at) VALUES (?, ?)').run(req.params.id, now);
  db.prepare("UPDATE todos SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  const ideas = db.prepare('SELECT * FROM new_ideas WHERE parent_todo_id = ? ORDER BY created_at DESC').all(req.params.id);
  const segments = db.prepare('SELECT * FROM time_segments WHERE todo_id = ? ORDER BY start_at ASC').all(req.params.id);
  logger.info('TODO_START', `Started/resumed todo #${req.params.id}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json({ ...todo as any, ideas, time_segments: segments });
});

// PATCH /api/todos/:id/pause
router.patch('/:id/pause', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  const elapsed = closeActiveSegment(parseInt(req.params.id));
  db.prepare(
    "UPDATE todos SET status = ?, total_elapsed_seconds = total_elapsed_seconds + ?, updated_at = datetime('now') WHERE id = ?"
  ).run('pending', elapsed, req.params.id);

  logger.info('TODO_PAUSE', `Paused todo #${req.params.id}, +${elapsed}s`, { type: 'todo', id: parseInt(req.params.id) });
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

// PATCH /api/todos/:id/complete
router.patch('/:id/complete', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });

  const elapsed = closeActiveSegment(parseInt(req.params.id));
  db.prepare(
    "UPDATE todos SET status = ?, total_elapsed_seconds = total_elapsed_seconds + ?, updated_at = datetime('now') WHERE id = ?"
  ).run('completed', elapsed, req.params.id);

  logger.info('TODO_COMPLETE', `Completed todo #${req.params.id}, total ${(existing as any).total_elapsed_seconds + elapsed}s`, { type: 'todo', id: parseInt(req.params.id) });
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json(todo);
});

// GET /api/todos/stats/summary
router.get('/stats/summary', (_req: Request, res: Response) => {
  const totalSeconds = db.prepare('SELECT COALESCE(SUM(total_elapsed_seconds), 0) as total FROM todos').get() as any;
  const completedCount = db.prepare("SELECT COUNT(*) as c FROM todos WHERE status = 'completed'").get() as any;
  const deletedCount = db.prepare("SELECT COUNT(*) as c FROM todos WHERE deleted_at IS NOT NULL").get() as any;
  const totalCount = db.prepare('SELECT COUNT(*) as c FROM todos').get() as any;
  res.json({ total: totalSeconds.total, completed: completedCount.c, deleted: deletedCount.c, totalCount: totalCount.c });
});

// GET /api/todos/calendar?year=2026&month=7 — daily stats for calendar
router.get('/calendar/data', (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

  // Get completed count per day from time_segments grouped by date
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const dailyCompleted = db.prepare(`
    SELECT DATE(t.updated_at) AS day, COUNT(*) AS count,
           COALESCE(SUM(t.total_elapsed_seconds), 0) AS seconds
    FROM todos t
    WHERE t.status = 'completed'
      AND t.updated_at >= ? AND t.updated_at < ?
      AND t.deleted_at IS NULL
    GROUP BY DATE(t.updated_at)
  `).all(startDate, endDate) as any[];

  // Fill in all days of month
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: Record<string, { count: number; seconds: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result[key] = { count: 0, seconds: 0 };
  }

  // Also get segments-based daily totals for time tracking
  const dailySegments = db.prepare(`
    SELECT DATE(ts.start_at) AS day,
           COALESCE(SUM(
             CASE WHEN ts.end_at IS NOT NULL
               THEN CAST((julianday(ts.end_at) - julianday(ts.start_at)) * 86400 AS INTEGER)
               ELSE 0 END
           ), 0) AS seconds2
    FROM time_segments ts
    JOIN todos t ON ts.todo_id = t.id
    WHERE t.deleted_at IS NULL
      AND ts.start_at >= ? AND ts.start_at < ?
    GROUP BY DATE(ts.start_at)
  `).all(startDate, endDate) as any[];

  for (const row of dailyCompleted) {
    const key = (row.day as string).slice(0, 10);
    if (result[key]) {
      result[key].count = row.count;
      result[key].seconds = Math.max(row.seconds, 0);
    }
  }

  // Merge segment seconds
  for (const row of dailySegments) {
    const key = (row.day as string).slice(0, 10);
    if (result[key]) {
      result[key].seconds = Math.max(result[key].seconds, row.seconds2);
    }
  }

  res.json({ year, month, days: result });
});

// DELETE /api/todos/:id — soft delete (hides from main list)
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Todo not found' });
  if ((existing as any).status === 'in_progress') {
    closeActiveSegment(parseInt(req.params.id));
  }
  db.prepare("UPDATE todos SET status = 'completed', deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  logger.info('TODO_DELETE_SOFT', `Soft deleted todo #${req.params.id}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json({ success: true });
});

// DELETE /api/todos/:id/permanent — permanent delete (from Profile page)
router.delete('/:id/permanent', (req: Request, res: Response) => {
  // Delete time segments first (FK constraint)
  db.prepare('DELETE FROM time_segments WHERE todo_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Todo not found' });
  logger.info('TODO_DELETE_PERMANENT', `Permanently deleted todo #${req.params.id}`, { type: 'todo', id: parseInt(req.params.id) });
  res.json({ success: true });
});

export default router;
