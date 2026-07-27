import { Router, Request, Response } from 'express';
import db from '../db.cjs';
import { logger } from '../logger.js';

const router = Router();

// GET /api/categories — tree structure
router.get('/', (_req: Request, res: Response) => {
  const all = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as any[];

  const map = new Map<number, any>();
  all.forEach(c => map.set(c.id, { ...c, children: [] }));

  const roots: any[] = [];
  map.forEach(c => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(c);
    } else {
      roots.push(c);
    }
  });

  res.json(roots);
});

// GET /api/categories/flat — flat list for dropdowns
router.get('/flat', (_req: Request, res: Response) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(categories);
});

// POST /api/categories
router.post('/', (req: Request, res: Response) => {
  const { name, parent_id, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare('INSERT INTO categories (name, parent_id, color) VALUES (?, ?, ?)')
    .run(name.trim(), parent_id || null, color || null);

  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  logger.info('CATEGORY_CREATE', `Created category: "${name.trim()}"`, { type: 'category', id: cat.id });
  res.status(201).json(cat);
});

// PUT /api/categories/:id
router.put('/:id', (req: Request, res: Response) => {
  const { name, color } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
    .run(
      name ?? (existing as any).name,
      color !== undefined ? color : (existing as any).color,
      req.params.id
    );

  logger.info('CATEGORY_RENAME', `Renamed category #${req.params.id}`, { type: 'category', id: parseInt(req.params.id) });
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(cat);
});

// PATCH /api/categories/:id/move
router.patch('/:id/move', (req: Request, res: Response) => {
  const { parent_id } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  db.prepare('UPDATE categories SET parent_id = ? WHERE id = ?').run(parent_id || null, req.params.id);
  logger.info('CATEGORY_MOVE', `Moved category #${req.params.id}`, { type: 'category', id: parseInt(req.params.id) });
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(cat);
});

// DELETE /api/categories/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('UPDATE new_ideas SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Category not found' });
  logger.info('CATEGORY_DELETE', `Deleted category #${req.params.id}`, { type: 'category', id: parseInt(req.params.id) });
  res.json({ success: true });
});

export default router;
