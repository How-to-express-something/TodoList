/**
 * SQLite wrapper using sql.js (pure JS, no compilation needed).
 * Drop-in replacement for better-sqlite3: db.prepare(sql).all()/.get()/.run().
 * Auto-saves to disk every 3s and on process exit.
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'todolist.db');

let _db = null;
let _saveTimer = null;

function save() {
  if (!_db) return;
  const data = _db.export();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

class Statement {
  constructor(sqliteDb, sql) { this._db = sqliteDb; this._sql = sql; }
  all(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this._db.prepare(this._sql);
    if (flat.length > 0) stmt.bind(flat);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  get(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this._db.prepare(this._sql);
    if (flat.length > 0) stmt.bind(flat);
    const row = stmt.step() ? stmt.getAsObject() : undefined;
    stmt.free();
    return row;
  }
  run(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this._db.run(this._sql, flat);
    _scheduleSave();
    const info = this._db.exec("SELECT changes() AS c, last_insert_rowid() AS r");
    const result = { changes: 0, lastInsertRowid: 0 };
    if (info.length > 0 && info[0].values.length > 0) {
      result.changes = info[0].values[0][0];
      result.lastInsertRowid = info[0].values[0][1];
    }
    return result;
  }
}

function _scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 3000);
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, color TEXT DEFAULT NULL, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT CHECK(status IN ('pending','in_progress','completed')) DEFAULT 'pending', priority INTEGER DEFAULT 0, total_elapsed_seconds INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS new_ideas (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, parent_todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE, parent_idea_id INTEGER REFERENCES new_ideas(id) ON DELETE CASCADE, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS audio_tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, file_name TEXT NOT NULL, is_default INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS time_segments (id INTEGER PRIMARY KEY AUTOINCREMENT, todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE, start_at TEXT NOT NULL, end_at TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS log_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT CHECK(level IN ('info','warn','error')) DEFAULT 'info', action TEXT NOT NULL, detail TEXT DEFAULT '', entity_type TEXT, entity_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
`;

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new SQL.Database();
  }
  _db.run("PRAGMA foreign_keys = ON");
  _db.run(SCHEMA);
  try { _db.run("ALTER TABLE todos ADD COLUMN total_elapsed_seconds INTEGER DEFAULT 0"); } catch {}
  try { _db.run("ALTER TABLE categories ADD COLUMN color TEXT DEFAULT NULL"); } catch {}
  try { _db.run("ALTER TABLE todos ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch {}
  save();
  process.on('exit', save);
  process.on('SIGINT', () => { save(); process.exit(0); });
  process.on('SIGTERM', () => { save(); process.exit(0); });
  console.log('✓ SQLite ready');
}

const db = {
  prepare(sql) { return new Statement(_db, sql); },
  exec(sql) { _db.run(sql); _scheduleSave(); },
};

db.init = init;
module.exports = db;
