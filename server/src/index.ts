import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import todosRouter from './routes/todos.js';
import newIdeasRouter from './routes/newIdeas.js';
import categoriesRouter from './routes/categories.js';
import audioRouter from './routes/audio.js';
import { logger, requestLogger, getLogEntries, clearLogEntries } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api/todos', todosRouter);
app.use('/api/new-ideas', newIdeasRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/audio', audioRouter);

// Log viewing endpoints
app.get('/api/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  const entries = getLogEntries(limit, offset);
  res.json(entries);
});

app.delete('/api/logs', (_req, res) => {
  clearLogEntries();
  logger.info('LOG_CLEARED', 'User cleared all log entries');
  res.json({ success: true });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  logger.info('SERVER_START', `Server started on port ${PORT}`);
  console.log(`✓ Server running at http://localhost:${PORT}`);
});

// Graceful shutdown: close active time segments on exit
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Closing active time segments...`);
  // Close all in_progress todos' segments
  const activeTodos = db.prepare("SELECT id FROM todos WHERE status = 'in_progress'").all() as any[];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const t of activeTodos) {
    const seg = db.prepare(
      'SELECT * FROM time_segments WHERE todo_id = ? AND end_at IS NULL ORDER BY start_at DESC LIMIT 1'
    ).get(t.id) as any;
    if (seg) {
      const elapsed = Math.round((Date.now() - new Date(seg.start_at + 'Z').getTime()) / 1000);
      db.prepare('UPDATE time_segments SET end_at = ? WHERE id = ?').run(now, seg.id);
      db.prepare(
        "UPDATE todos SET status = 'pending', total_elapsed_seconds = total_elapsed_seconds + ?, updated_at = ? WHERE id = ?"
      ).run(Math.max(0, elapsed), now, t.id);
      logger.info('SHUTDOWN_SAVE', `Saved todo #${t.id} segment: +${Math.max(0, elapsed)}s`);
    }
  }

  logger.info('SERVER_STOP', `Server shutting down (${signal})`);
  console.log('✓ All data saved. Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
