import { useState, useEffect, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { newIdeasApi, categoriesApi, exportNewIdeas } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import type { NewIdea, Category } from '../types';
import IdeaNode from './IdeaNode';
import '../styles/idea.css';

/** Droppable zone: drop here to make an idea a root-level node (no parent) */
function RootLevelDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-level',
    data: { type: 'root' },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '16px 20px', marginBottom: 8, borderRadius: 8,
        border: `2px dashed ${isOver ? 'var(--accent)' : 'transparent'}`,
        background: isOver ? 'var(--accent-light)' : 'transparent',
        textAlign: 'center', fontSize: 13, color: isOver ? 'var(--accent)' : 'var(--text-tertiary)',
        transition: 'all 0.2s',
      }}
    >
      {isOver ? '📂 放到这里成为根节点' : '🔄 拖拽到这里移出到根层级'}
    </div>
  );
}

/** Droppable wrapper for each category */
function CategoryDropZone({ category }: { category: Category }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cat-${category.id}`,
    data: { type: 'category', id: category.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`category-drop-zone ${isOver ? 'active' : ''}`}
      style={{
        marginTop: 4,
        borderColor: isOver && category.color ? category.color : undefined,
        background: isOver && category.color ? category.color + '18' : undefined,
        color: isOver && category.color ? category.color : undefined,
      }}
    >
      📁 {category.name}
      {isOver && <span style={{ marginLeft: 'auto', fontSize: 11 }}>↓</span>}
    </div>
  );
}

export default function NewIdeasPage() {
  const [ideas, setIdeas] = useState<NewIdea[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [draggedIdea, setDraggedIdea] = useState<NewIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshTracks } = useWhiteNoise();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const treeData = await newIdeasApi.tree();
      // Flatten all ideas from the tree grouped by todo
      const allIdeas = newIdeasApi.list();
      const [ideasList, cats] = await Promise.all([allIdeas, categoriesApi.list()]);
      setCategories(cats);

      // Build tree structure client-side
      const byId = new Map<number, NewIdea>();
      ideasList.forEach(idea => byId.set(idea.id, { ...idea, children: [] }));

      const roots: NewIdea[] = [];
      byId.forEach(idea => {
        if (idea.parent_idea_id && byId.has(idea.parent_idea_id)) {
          byId.get(idea.parent_idea_id)!.children!.push(idea);
        } else {
          roots.push(idea);
        }
      });
      setIdeas(roots);
    } catch (e) {
      console.error('Failed to load ideas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredIdeas = useMemo(() => {
    if (!selectedCategory) return ideas;
    // Filter: keep only ideas that match the category or have children that match
    const filterTree = (nodes: NewIdea[]): NewIdea[] => {
      return nodes
        .map(node => {
          const match = node.category_id === selectedCategory;
          const filteredChildren = node.children ? filterTree(node.children) : [];
          if (match || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean) as NewIdea[];
    };
    return filterTree(ideas);
  }, [ideas, selectedCategory]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as number;
    const findIdea = (nodes: NewIdea[]): NewIdea | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findIdea(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    setDraggedIdea(findIdea(ideas));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedIdea(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ideaId = active.id as number;

    // Dropped on root-level zone → make this idea top-level (clear parent)
    if (over.data.current?.type === 'root') {
      await newIdeasApi.move(ideaId, { parent_idea_id: null });
      loadData();
      return;
    }

    // Dropped on a category → move idea to that category (cascades to children)
    if (over.data.current?.type === 'category') {
      const categoryId = over.data.current.id as number;
      await newIdeasApi.move(ideaId, { category_id: categoryId });
      loadData();
      return;
    }

    // Dropped on another idea node → make this idea a child of the target
    const targetId = over.id as number;
    if (typeof targetId === 'number' && !isNaN(targetId)) {
      // Also inherit the target's category if this idea has none
      // Find the target idea in the tree
      const findIdea = (nodes: NewIdea[]): NewIdea | null => {
        for (const n of nodes) {
          if (n.id === targetId) return n;
          if (n.children) { const f = findIdea(n.children); if (f) return f; }
        }
        return null;
      };
      const targetIdea = findIdea(ideas);

      // Determine category: use dragged idea's category if it has one, else inherit target's
      const draggedIdeaData = (() => {
        const fn = (nodes: NewIdea[]): NewIdea | null => {
          for (const n of nodes) {
            if (n.id === ideaId) return n;
            if (n.children) { const f = fn(n.children); if (f) return f; }
          }
          return null;
        };
        return fn(ideas);
      })();

      const catId = draggedIdeaData?.category_id ?? targetIdea?.category_id ?? null;
      await newIdeasApi.move(ideaId, { parent_idea_id: targetId, category_id: catId });
      loadData();
    }
  };

  const handlePromote = async (idea: NewIdea) => {
    await newIdeasApi.promote(idea.id);
    loadData();
  };

  const handleDelete = async (ideaId: number) => {
    if (!confirm('确定删除这个想法及其子想法？')) return;
    await newIdeasApi.delete(ideaId);
    loadData();
  };

  const handleAddChild = async (parentId: number, content: string) => {
    await newIdeasApi.create({ content, parent_idea_id: parentId });
    loadData();
  };

  const handleUpdate = async (ideaId: number, content: string) => {
    await newIdeasApi.update(ideaId, { content });
    loadData();
  };

  const handleMoveCategory = async (ideaId: number, categoryId: number | null) => {
    await newIdeasApi.move(ideaId, { category_id: categoryId });
    loadData();
  };

  if (loading) return <div className="page"><p>加载中...</p></div>;

  return (
    <div className="page">
      <div className="todo-list-header">
        <h1 className="page-title">💡 New Ideas 树状视图</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>导出:</span>
          <button className="btn btn-sm btn-secondary" onClick={() => exportNewIdeas('txt')}>📄 TXT</button>
          <button className="btn btn-sm btn-secondary" onClick={() => exportNewIdeas('md')}>📝 MD</button>
          <button className="btn btn-sm btn-secondary" onClick={() => exportNewIdeas('docx')}>📘 Word</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="ideas-page">
          <aside className="ideas-sidebar">
            <h3>分类筛选</h3>
            <button
              className={`category-filter-item ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-filter-item ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: selectedCategory === cat.id && cat.color ? cat.color + '22' : undefined,
                  color: selectedCategory === cat.id && cat.color ? cat.color : undefined,
                  border: selectedCategory === cat.id && cat.color ? `1px solid ${cat.color}44` : undefined,
                  fontWeight: selectedCategory === cat.id ? 600 : 400,
                }}
              >
                📁 {cat.name}
              </button>
            ))}
            {categories.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0 10px' }}>
                暂无分类，前往分类页面创建
              </p>
            )}

            {/* Category drop zone */}
            <div style={{ marginTop: 16 }}>
              <h3>拖拽到分类</h3>
              {categories.map(cat => (
                <CategoryDropZone key={cat.id} category={cat} />
              ))}
            </div>
          </aside>

          <div className="ideas-main">
            {/* Root-level drop zone: drop here to make an idea top-level (no parent) */}
            <RootLevelDropZone />
            {filteredIdeas.length === 0 ? (
              <div className="empty-state">
                <p>暂无 New Ideas，在开始代办事项时记录吧</p>
              </div>
            ) : (
              filteredIdeas.map(idea => (
                <IdeaNode
                  key={idea.id}
                  idea={idea}
                  onPromote={handlePromote}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onUpdate={handleUpdate}
                  onMoveCategory={handleMoveCategory}
                  categories={categories}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>

        <DragOverlay>
          {draggedIdea ? (
            <div className="idea-node-content dragging" style={{ background: 'var(--accent-light)' }}>
              <span className="idea-node-text">{draggedIdea.content}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
