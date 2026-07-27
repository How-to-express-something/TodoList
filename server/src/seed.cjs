/**
 * Seed script — runs on server startup if DB is empty.
 * Copies default MP3 audio files + creates sample categories/tasks/ideas.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_DIR = path.join(ROOT, 'defaults', 'audio');
const DATA_DIR = path.join(ROOT, 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

const db = require('./db.cjs');

function seed() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const needsSeed = db.prepare('SELECT COUNT(*) as c FROM categories').get().c === 0;
  if (!needsSeed) return;

  console.log('📦 First launch — seeding sample data...');

  // ── Categories ──
  const cat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  cat.run('Work', '#61afef');
  cat.run('Personal', '#98c379');
  cat.run('Reading', '#d19a66');
  cat.run('Health', '#c678dd');
  cat.run('Ideas', '#e06c75');

  // ── Todos ──
  const t = db.prepare('INSERT INTO todos (title, description) VALUES (?, ?)');
  const t1 = Number(t.run('Read "The Pragmatic Programmer"', 'Finish chapters 5-8, take notes').lastInsertRowid);
  const t2 = Number(t.run('Morning workout', '30 min cardio + stretching').lastInsertRowid);
  const t3 = Number(t.run('Weekly project review', 'Review progress, update backlog').lastInsertRowid);
  const t4 = Number(t.run('Learn TypeScript patterns', 'Discriminated unions, conditional types, mapped types').lastInsertRowid);

  // ── New Ideas ──
  const i = db.prepare('INSERT INTO new_ideas (content, parent_todo_id, category_id) VALUES (?, ?, ?)');
  i.run('Read "Clean Architecture" next', t1, 3);
  i.run('Create a reading notes template', t1, 1);
  i.run('Try yoga for back pain relief', t2, 4);
  i.run('Meal prep recipes for the week', t2, 2);
  i.run('Refactor the API error handling', t3, 5);
  i.run('Add E2E tests for auth flow', t3, 5);
  i.run('Publish a shared types npm package', t4, 1);
  i.run('Write blog post about advanced TypeScript', t4, 2);

  // Nested ideas
  const ins2 = db.prepare('INSERT INTO new_ideas (content, parent_idea_id, category_id) VALUES (?, ?, ?)');
  const root = Number(ins2.run('App idea: habit tracker with gamification', null, 5).lastInsertRowid);
  const child = Number(ins2.run('Streaks, badges, social accountability', root, 5).lastInsertRowid);
  ins2.run('Weekly challenge system', child, 5);

  // ── Default audio ──
  console.log('🔊 Copying default white noise...');
  const insAudio = db.prepare('INSERT INTO audio_tracks (name, file_name, is_default) VALUES (?, ?, 1)');
  const existingDataFiles = new Set(fs.readdirSync(AUDIO_DIR));

  if (fs.existsSync(DEFAULTS_DIR)) {
    for (const file of fs.readdirSync(DEFAULTS_DIR)) {
      if (!file.endsWith('.mp3')) continue;
      // Copy to data/audio/ if not already there
      if (!existingDataFiles.has(file)) {
        fs.copyFileSync(path.join(DEFAULTS_DIR, file), path.join(AUDIO_DIR, file));
      }
      // Use filename (minus .mp3) as display name
      const name = file.replace(/\.mp3$/, '');
      insAudio.run(name, file);
      console.log(`  ✓ ${name}`);
    }
  }

  // Also register any existing MP3s in data/audio/ (user's own files)
  const registeredFiles = new Set(
    db.prepare('SELECT file_name FROM audio_tracks').all().map(function(r) { return r.file_name; })
  );
  const insExisting = db.prepare('INSERT INTO audio_tracks (name, file_name) VALUES (?, ?)');
  for (const f of fs.readdirSync(AUDIO_DIR)) {
    if (!registeredFiles.has(f) && f.endsWith('.mp3')) {
      insExisting.run(f.replace(/\.mp3$/, ''), f);
      console.log(`  ✓ Registered existing: ${name}`);
    }
  }

  console.log('✅ Seed complete.');
}

module.exports = { seed };
