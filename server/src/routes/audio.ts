import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.cjs';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', '..', 'data', 'audio');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AUDIO_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: mp3, wav, ogg, m4a, flac, webm'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

const router = Router();

// GET /api/audio — list tracks
router.get('/', (_req: Request, res: Response) => {
  const tracks = db.prepare('SELECT * FROM audio_tracks ORDER BY created_at DESC').all();
  res.json(tracks);
});

// POST /api/audio/upload — upload new track
const uploadHandler = upload.single('audio');
router.post('/upload', (req: Request, res: Response) => {
  uploadHandler(req, res, (err: any) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? '文件过大，最大 50MB'
        : `上传失败: ${err.message}`;
      logger.warn('AUDIO_UPLOAD_ERR', msg);
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: '未选择文件' });

    const name = req.body.name || req.file.originalname.replace(/\.[^/.]+$/, '');
    const result = db.prepare('INSERT INTO audio_tracks (name, file_name) VALUES (?, ?)')
      .run(name, req.file.filename);

    logger.info('AUDIO_UPLOAD', `Uploaded audio: "${name}"`, { type: 'audio', id: result.lastInsertRowid as number });
    const track = db.prepare('SELECT * FROM audio_tracks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(track);
  });
});

// GET /api/audio/:id/play — serve audio file
router.get('/:id/play', (req: Request, res: Response) => {
  const track = db.prepare('SELECT * FROM audio_tracks WHERE id = ?').get(req.params.id) as any;
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const filePath = path.join(AUDIO_DIR, track.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.sendFile(filePath);
});

// DELETE /api/audio/:id
router.delete('/:id', (req: Request, res: Response) => {
  const track = db.prepare('SELECT * FROM audio_tracks WHERE id = ?').get(req.params.id) as any;
  if (!track) return res.status(404).json({ error: 'Track not found' });

  // Delete file from disk
  const filePath = path.join(AUDIO_DIR, track.file_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  logger.info('AUDIO_DELETE', `Deleted audio #${req.params.id}: "${track.name}"`, { type: 'audio', id: parseInt(req.params.id) });
  db.prepare('DELETE FROM audio_tracks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
