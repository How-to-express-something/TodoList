/**
 * Seed script — runs on server startup if DB or audio directory is empty.
 * Generates default white noise WAV files + sample tasks/categories/ideas.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

// Use db.cjs so tables are created first
const db = require('./db.cjs');

/* ─── WAV generation helpers ─── */

function makeWav(samples, sampleRate = 44100) {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  return buf;
}

function createPinkFilter() {
  const b = [0, 0, 0, 0, 0, 0, 0];
  return {
    next(white) {
      b[0] = 0.99886 * b[0] + white * 0.0555179;
      b[1] = 0.99332 * b[1] + white * 0.0750759;
      b[2] = 0.96900 * b[2] + white * 0.1538520;
      b[3] = 0.86650 * b[3] + white * 0.3104856;
      b[4] = 0.55000 * b[4] + white * 0.5329522;
      b[5] = -0.7616 * b[5] - white * 0.0168980;
      const pink = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362) * 0.11;
      b[6] = white * 0.115926;
      return pink;
    }
  };
}

function generatePinkNoise(durationSec, sampleRate = 44100) {
  const n = durationSec * sampleRate;
  const out = new Float32Array(n);
  const filter = createPinkFilter();
  for (let i = 0; i < n; i++) out[i] = filter.next(Math.random() * 2 - 1);
  return out;
}

function generateBrownNoise(durationSec, sampleRate = 44100) {
  const n = durationSec * sampleRate;
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}

function generateWhiteNoise(durationSec, sampleRate = 44100, gain = 0.4) {
  const n = durationSec * sampleRate;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * gain;
  return out;
}

/* ─── Seed logic ─── */

function seed() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const needsSeed = db.prepare('SELECT COUNT(*) as c FROM categories').get().c === 0;

  if (!needsSeed) {
    // If categories exist but no audio tracks registered, register existing files
    const audioCount = db.prepare('SELECT COUNT(*) as c FROM audio_tracks').get().c;
    if (audioCount === 0 && fs.existsSync(AUDIO_DIR)) {
      const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
      const ins = db.prepare('INSERT INTO audio_tracks (name, file_name) VALUES (?, ?)');
      for (const f of files) {
        const name = f.replace(/\.[^/.]+$/, '').replace(/^\d+-\d+-/, '');
        ins.run(name, f);
        console.log(`  ✓ Registered audio: ${name}`);
      }
    }
    return;
  }

  console.log('📦 First launch — seeding sample data...');

  const cat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  cat.run('Work', '#61afef');
  cat.run('Personal', '#98c379');
  cat.run('Reading', '#d19a66');
  cat.run('Health', '#c678dd');
  cat.run('Ideas', '#e06c75');

  const t = db.prepare('INSERT INTO todos (title, description) VALUES (?, ?)');
  const t1 = Number(t.run('Read "The Pragmatic Programmer"', 'Finish chapters 5-8, take notes').lastInsertRowid);
  const t2 = Number(t.run('Morning workout', '30 min cardio + stretching').lastInsertRowid);
  const t3 = Number(t.run('Weekly project review', 'Review progress, update backlog').lastInsertRowid);
  const t4 = Number(t.run('Learn TypeScript patterns', 'Discriminated unions, conditional types, mapped types').lastInsertRowid);

  const i = db.prepare('INSERT INTO new_ideas (content, parent_todo_id, category_id) VALUES (?, ?, ?)');
  i.run('Read "Clean Architecture" next', t1, 3);
  i.run('Create a reading notes template', t1, 1);
  i.run('Try yoga for back pain relief', t2, 4);
  i.run('Meal prep recipes for the week', t2, 2);
  i.run('Refactor the API error handling', t3, 5);
  i.run('Add E2E tests for auth flow', t3, 5);
  i.run('Publish a shared types npm package', t4, 1);
  i.run('Write blog post about advanced TypeScript', t4, 2);

  const ins2 = db.prepare('INSERT INTO new_ideas (content, parent_idea_id, category_id) VALUES (?, ?, ?)');
  const root = Number(ins2.run('App idea: habit tracker with gamification', null, 5).lastInsertRowid);
  const child = Number(ins2.run('Streaks, badges, social accountability', root, 5).lastInsertRowid);
  ins2.run('Weekly challenge system', child, 5);

  // Default audio
  console.log('🔊 Generating default white noise (60s each)...');
  const sr = 44100, dur = 60;
  const audioDefs = [
    { name: 'Rain', samples: generatePinkNoise(dur, sr), file: 'default-rain.wav' },
    { name: 'Ocean', samples: generateBrownNoise(dur, sr), file: 'default-ocean.wav' },
    { name: 'White Noise', samples: generateWhiteNoise(dur, sr), file: 'default-white.wav' },
  ];
  const insAudio = db.prepare('INSERT INTO audio_tracks (name, file_name, is_default) VALUES (?, ?, 1)');
  const existingFiles = new Set(fs.readdirSync(AUDIO_DIR));
  for (const a of audioDefs) {
    if (!existingFiles.has(a.file)) {
      const wavBuf = makeWav(a.samples, sr);
      fs.writeFileSync(path.join(AUDIO_DIR, a.file), wavBuf);
    }
    insAudio.run(a.name, a.file);
    console.log(`  ✓ ${a.name}`);
  }

  // Also register any existing audio files that aren't default (user's MP3s)
  const existingDb = new Set(
    db.prepare('SELECT file_name FROM audio_tracks').all().map(function(r) { return r.file_name; })
  );
  const insExisting = db.prepare('INSERT INTO audio_tracks (name, file_name) VALUES (?, ?)');
  for (const f of fs.readdirSync(AUDIO_DIR)) {
    if (!existingDb.has(f) && (f.endsWith('.mp3') || f.endsWith('.wav'))) {
      const name = f.replace(/\.[^/.]+$/, '').replace(/^\d+-\d+-/, '').replace(/-/g, ' ').trim() || 'Untitled';
      insExisting.run(name, f);
      console.log(`  ✓ Registered existing: ${f}`);
    }
  }

  console.log('✅ Seed complete.');
}

module.exports = { seed };
