import { useState, useEffect } from 'react';
import { categoriesApi } from '../api';
import type { Category } from '../types';
import { CATEGORY_PALETTE, pickUnusedColor } from '../palette';
import '../styles/category.css';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState<number | null>(null);
  const [formColor, setFormColor] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (e) {
      console.error('Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  // Populate a swatch component
  const ColorSwatch = ({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      style={{
        width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
        background: color, flexShrink: 0,
        border: selected ? '3px solid #333' : '3px solid transparent',
        outline: selected ? '2px solid ' + color : 'none',
        transition: 'transform 0.15s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
      }}
    />
  );

  const openCreateForm = () => {
    const existingColors = extractFlatColors(categories);
    setFormColor(pickUnusedColor(existingColors));
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    await categoriesApi.create({ name: formName.trim(), parent_id: formParent, color: formColor || null });
    setFormName('');
    setFormColor('');
    setFormParent(null);
    setShowForm(false);
    loadCategories();
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    await categoriesApi.update(id, { name: editName.trim(), color: editColor || undefined });
    setEditingId(null);
    loadCategories();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此分类？')) return;
    await categoriesApi.delete(id);
    loadCategories();
  };

  const flattenCategories = (cats: Category[], level = 0): { id: number; name: string; color: string | null; level: number }[] => {
    const result: { id: number; name: string; color: string | null; level: number }[] = [];
    cats.forEach(c => {
      result.push({ id: c.id, name: c.name, color: c.color, level });
      if (c.children) result.push(...flattenCategories(c.children, level + 1));
    });
    return result;
  };

  const flatCats = flattenCategories(categories);

  const renderCategoryTree = (cats: Category[]) => {
    return cats.map(cat => (
      <div key={cat.id} className="category-tree-node">
        <div className="category-tree-content">
          {editingId === cat.id ? (
            <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                onBlur={() => handleRename(cat.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingId(null); }}
                autoFocus style={{ flex: 1, minWidth: 120 }} />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {['', ...CATEGORY_PALETTE].map((c, i) => (
                  <ColorSwatch key={i} color={c || '#ccc'} selected={editColor === c}
                    onClick={() => setEditColor(c)} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <span className="category-tree-name" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '2px 8px', borderRadius: 6,
                background: cat.color ? cat.color + '18' : undefined,
                color: cat.color || undefined,
              }}>
                📁 {cat.name}
              </span>
              <div className="category-tree-actions">
                <button className="btn-icon" title="编辑" onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color || ''); }}>✏️</button>
                <button className="btn-icon" title="删除" onClick={() => handleDelete(cat.id)}>🗑</button>
              </div>
            </>
          )}
        </div>
        {cat.children && cat.children.length > 0 && (
          <div className="category-tree-children">{renderCategoryTree(cat.children)}</div>
        )}
      </div>
    ));
  };

  if (loading) return <div className="page"><p>加载中...</p></div>;

  return (
    <div className="page categories-page">
      <div className="todo-list-header">
        <h1 className="page-title">📁 分类管理</h1>
        <button className="btn btn-primary" onClick={openCreateForm}>+ 新建分类</button>
      </div>

      {categories.length === 0 ? (
        <div className="empty-state"><p>暂无分类，点击上方按钮创建</p></div>
      ) : (
        <div style={{ marginTop: 8 }}>{renderCategoryTree(categories)}</div>
      )}

      {showForm && (
        <div className="todo-form-overlay" onClick={() => setShowForm(false)}>
          <div className="todo-form" onClick={e => e.stopPropagation()}>
            <h3>新建分类</h3>
            <input placeholder="分类名称" value={formName}
              onChange={e => setFormName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            <select value={formParent || ''}
              onChange={e => setFormParent(e.target.value ? Number(e.target.value) : null)}>
              <option value="">顶级分类</option>
              {flatCats.map(c => (
                <option key={c.id} value={c.id}>{'　'.repeat(c.level)}{c.name}</option>
              ))}
            </select>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>颜色</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORY_PALETTE.map(c => (
                  <ColorSwatch key={c} color={c} selected={formColor === c}
                    onClick={() => setFormColor(formColor === c ? '' : c)} />
                ))}
              </div>
            </div>
            <div className="todo-form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractFlatColors(cats: Category[]): (string | null)[] {
  const result: (string | null)[] = [];
  for (const c of cats) {
    result.push(c.color);
    if (c.children) result.push(...extractFlatColors(c.children));
  }
  return result;
}
