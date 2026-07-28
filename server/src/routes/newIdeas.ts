import { Router, Request, Response } from 'express';
import db from '../db.cjs';
import { logger } from '../logger.js';

function buildTree(): any[] {
  const ideas = db.prepare('SELECT * FROM new_ideas ORDER BY sort_order ASC, created_at DESC').all() as any[];
  const ideaMap = new Map<number, any>();
  ideas.forEach(idea => ideaMap.set(idea.id, { ...idea, children: [] }));
  const roots: any[] = [];
  ideaMap.forEach(idea => {
    if (idea.parent_idea_id && ideaMap.has(idea.parent_idea_id)) {
      ideaMap.get(idea.parent_idea_id)!.children.push(idea);
    } else {
      roots.push(idea);
    }
  });
  return roots;
}

function renderTreeAsText(nodes: any[], depth = 0): string {
  let result = '';
  const prefix = '  '.repeat(depth);
  nodes.forEach(node => {
    result += `${prefix}- ${node.content}\n`;
    if (node.children && node.children.length > 0) {
      result += renderTreeAsText(node.children, depth + 1);
    }
  });
  return result;
}

function renderTreeAsMarkdown(nodes: any[], depth = 0): string {
  let result = '';
  nodes.forEach(node => {
    const indent = '  '.repeat(depth);
    const bullet = depth === 0 ? '###' : depth === 1 ? '- ' : '  '.repeat(depth - 1) + '- ';
    if (depth === 0) {
      result += `\n### ${node.content}\n\n`;
    } else {
      result += `${indent}- ${node.content}\n`;
    }
    if (node.children && node.children.length > 0) {
      result += renderTreeAsMarkdown(node.children, depth + 1);
    }
  });
  return result;
}

function renderTreeAsHtml(nodes: any[], depth = 0): string {
  let result = '<ul>\n';
  const fontSize = Math.max(12, 28 - depth * 3);
  nodes.forEach(node => {
    result += `  <li style="font-size:${fontSize}px;line-height:1.8">${escapeHtml(node.content)}`;
    if (node.children && node.children.length > 0) {
      result += '\n' + renderTreeAsHtml(node.children, depth + 1);
    }
    result += '</li>\n';
  });
  result += '</ul>\n';
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const router = Router();

// GET /api/new-ideas — list all, optional filters
router.get('/', (req: Request, res: Response) => {
  let query = 'SELECT * FROM new_ideas';
  const params: any[] = [];
  const conditions: string[] = [];

  if (req.query.todo_id) {
    conditions.push('parent_todo_id = ?');
    params.push(req.query.todo_id);
  }
  if (req.query.category_id) {
    conditions.push('category_id = ?');
    params.push(req.query.category_id);
  }
  if (req.query.parent_idea_id !== undefined) {
    if (req.query.parent_idea_id === 'null') {
      conditions.push('parent_idea_id IS NULL');
    } else {
      conditions.push('parent_idea_id = ?');
      params.push(req.query.parent_idea_id);
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY sort_order ASC, created_at DESC';

  const ideas = db.prepare(query).all(...params);
  res.json(ideas);
});

// GET /api/new-ideas/tree — full tree structure grouped by todo
router.get('/tree', (_req: Request, res: Response) => {
  const ideas = db.prepare('SELECT * FROM new_ideas ORDER BY sort_order ASC, created_at DESC').all() as any[];

  // Build lookup: key by id
  const ideaMap = new Map<number, any>();
  ideas.forEach(idea => ideaMap.set(idea.id, { ...idea, children: [] }));

  const roots: any[] = [];
  ideaMap.forEach(idea => {
    if (idea.parent_idea_id && ideaMap.has(idea.parent_idea_id)) {
      ideaMap.get(idea.parent_idea_id)!.children.push(idea);
    } else {
      roots.push(idea);
    }
  });

  // Also group by todo for the tree page
  const todos = db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all() as any[];
  const treeByTodo = todos.map(todo => {
    const todoIdeas = roots.filter(idea => idea.parent_todo_id === todo.id);
    return { ...todo, ideas: todoIdeas };
  });

  res.json(treeByTodo);
});

// POST /api/new-ideas — create a new idea
router.post('/', (req: Request, res: Response) => {
  const { content, parent_todo_id, parent_idea_id, category_id } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  // If parent_idea_id is set and no category_id provided, inherit parent's category
  let finalCategoryId = category_id;
  if (parent_idea_id && finalCategoryId === undefined) {
    const parent = db.prepare('SELECT category_id FROM new_ideas WHERE id = ?').get(parent_idea_id) as any;
    if (parent) finalCategoryId = parent.category_id;
  }

  const result = db.prepare(
    'INSERT INTO new_ideas (content, parent_todo_id, parent_idea_id, category_id) VALUES (?, ?, ?, ?)'
  ).run(content.trim(), parent_todo_id || null, parent_idea_id || null, finalCategoryId ?? null);

  const idea = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(result.lastInsertRowid);
  logger.info('IDEA_CREATE', `Created idea: "${content.trim().substring(0, 50)}..."`, { type: 'idea', id: idea.id });
  res.status(201).json(idea);
});

// PUT /api/new-ideas/:id — update content
router.put('/:id', (req: Request, res: Response) => {
  const { content, category_id } = req.body;
  const existing = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'New idea not found' });

  db.prepare('UPDATE new_ideas SET content = ?, category_id = ? WHERE id = ?')
    .run(
      content ?? (existing as any).content,
      category_id !== undefined ? category_id : (existing as any).category_id,
      req.params.id
    );

  logger.info('IDEA_UPDATE', `Updated idea #${req.params.id}`, { type: 'idea', id: parseInt(req.params.id) });
  const idea = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(req.params.id);
  res.json(idea);
});

// PATCH /api/new-ideas/:id/move — move to different parent/category
router.patch('/:id/move', (req: Request, res: Response) => {
  const { parent_todo_id, parent_idea_id, category_id, sort_order } = req.body;
  const existing = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'New idea not found' });

  const newCategoryId = category_id !== undefined ? category_id : (existing as any).category_id;
  const oldCategoryId = (existing as any).category_id;

  db.prepare(
    'UPDATE new_ideas SET parent_todo_id = ?, parent_idea_id = ?, category_id = ?, sort_order = ? WHERE id = ?'
  ).run(
    parent_todo_id !== undefined ? parent_todo_id : (existing as any).parent_todo_id,
    parent_idea_id !== undefined ? parent_idea_id : (existing as any).parent_idea_id,
    newCategoryId,
    sort_order ?? (existing as any).sort_order,
    req.params.id
  );

  // Cascade category_id to all descendants if it changed
  if (newCategoryId !== oldCategoryId) {
    // Recursive CTE to get all descendants and update their category_id
    db.prepare(`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM new_ideas WHERE parent_idea_id = ?
        UNION ALL
        SELECT n.id FROM new_ideas n JOIN descendants d ON n.parent_idea_id = d.id
      )
      UPDATE new_ideas SET category_id = ? WHERE id IN (SELECT id FROM descendants)
    `).run(req.params.id, newCategoryId);
  }

  logger.info('IDEA_MOVE', `Moved idea #${req.params.id}${newCategoryId !== oldCategoryId ? `, cascaded category to descendants` : ''}`, { type: 'idea', id: parseInt(req.params.id) });
  const idea = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(req.params.id);
  res.json(idea);
});

// POST /api/new-ideas/:id/promote — promote to a todo
router.post('/:id/promote', (req: Request, res: Response) => {
  const idea = db.prepare('SELECT * FROM new_ideas WHERE id = ?').get(req.params.id) as any;
  if (!idea) return res.status(404).json({ error: 'New idea not found' });

  const result = db.prepare('INSERT INTO todos (title, description) VALUES (?, ?)')
    .run(idea.content, `Promoted from idea #${idea.id}`);

  // Optionally delete or keep the idea — keeping it with a reference
  db.prepare('UPDATE new_ideas SET parent_todo_id = ? WHERE id = ?')
    .run(result.lastInsertRowid, idea.id);

  logger.info('IDEA_PROMOTE', `Promoted idea #${idea.id} to todo #${result.lastInsertRowid}`, { type: 'idea', id: idea.id });
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(todo);
});

// DELETE /api/new-ideas/:id — delete
router.delete('/:id', (req: Request, res: Response) => {
  // First, orphan children (set their parent_idea_id to null)
  db.prepare('UPDATE new_ideas SET parent_idea_id = NULL WHERE parent_idea_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM new_ideas WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'New idea not found' });
  logger.info('IDEA_DELETE', `Deleted idea #${req.params.id}`, { type: 'idea', id: parseInt(req.params.id) });
  res.json({ success: true });
});

// GET /api/new-ideas/export — export as txt/md/docx
router.get('/export', (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'txt';
  const tree = buildTree();
  const todoName = req.query.todo_name || 'My New Ideas';

  if (format === 'md') {
    const header = `# ${todoName}\n\n*Exported on ${new Date().toISOString().slice(0, 10)}*\n\n`;
    const body = renderTreeAsMarkdown(tree);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="new-ideas-${Date.now()}.md"`);
    return res.send(header + body);
  }

  if (format === 'docx') {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>New Ideas</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;max-width:800px;margin:auto}
h1{font-size:32px;font-weight:600}ul{list-style:none;padding-left:20px;padding-left:0}
li{margin:8px 0;padding:6px 12px;border-left:3px solid #4A90D9;background:#f8f9fa;border-radius:4px}
ul ul li{border-left-color:#6cafdb;margin-left:16px;font-size:95%}
ul ul ul li{border-left-color:#93c4e6;margin-left:32px;font-size:90%}
</style></head><body>
<h1>${escapeHtml(String(todoName))}</h1>
<p style="color:#888">Exported on ${new Date().toISOString().slice(0, 10)}</p>
${renderTreeAsHtml(tree)}
</body></html>`;
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="new-ideas-${Date.now()}.doc"`);
    return res.send(html);
  }

  // default: txt
  const header = `=== ${todoName} ===\nExported: ${new Date().toISOString().slice(0, 10)}\n\n`;
  const body = renderTreeAsText(tree);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="new-ideas-${Date.now()}.txt"`);
  res.send(header + body);
});

export default router;
