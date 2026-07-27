import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(level: string, message: string) {
  const line = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  action: string;
  detail?: string;
  entity_type?: string;
  entity_id?: number;
}

/**
 * Log an event to both the database and the log file.
 */
export function log(entry: LogEntry) {
  try {
    // Write to DB
    db.prepare(
      'INSERT INTO log_entries (level, action, detail, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)'
    ).run(entry.level, entry.action, entry.detail || '', entry.entity_type || null, entry.entity_id || null);
  } catch (e) {
    // Don't let logging failures crash the app
    writeToFile('error', `Failed to write to DB log: ${e}`);
  }

  // Always write to file
  const fileMsg = `${entry.action}${entry.detail ? ' — ' + entry.detail : ''}${entry.entity_type ? ' [' + entry.entity_type + '#' + entry.entity_id + ']' : ''}`;
  writeToFile(entry.level, fileMsg);
}

/**
 * Convenience methods
 */
export const logger = {
  info: (action: string, detail?: string, entity?: { type: string; id: number }) =>
    log({ level: 'info', action, detail, entity_type: entity?.type, entity_id: entity?.id }),

  warn: (action: string, detail?: string, entity?: { type: string; id: number }) =>
    log({ level: 'warn', action, detail, entity_type: entity?.type, entity_id: entity?.id }),

  error: (action: string, detail?: string, entity?: { type: string; id: number }) =>
    log({ level: 'error', action, detail, entity_type: entity?.type, entity_id: entity?.id }),
};

/**
 * Express middleware: log all API requests
 */
export function requestLogger(req: any, _res: any, next: any) {
  const method = req.method;
  const url = req.originalUrl || req.url;
  // Don't log audio file serving or health check unless they fail
  if (url === '/api/health' || url.startsWith('/api/audio/') && method === 'GET') {
    return next();
  }
  writeToFile('info', `${method} ${url}`);
  next();
}

/**
 * Get recent log entries from the database
 */
export function getLogEntries(limit = 100, offset = 0) {
  return db.prepare(
    'SELECT * FROM log_entries ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

/**
 * Clear all log entries from DB (file log is kept)
 */
export function clearLogEntries() {
  db.prepare('DELETE FROM log_entries').run();
  writeToFile('info', 'LOG_CLEARED — Database log entries cleared');
}
