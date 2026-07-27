import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { NewIdea, Category } from '../types';

interface Props {
  idea: NewIdea;
  onPromote: (idea: NewIdea) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number, content: string) => void;
  onUpdate: (id: number, content: string) => void;
  onMoveCategory: (id: number, categoryId: number | null) => void;
  categories: Category[];
  depth: number;
}

export default function IdeaNode({ idea, onPromote, onDelete, onAddChild, onUpdate, onMoveCategory, categories, depth }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(idea.content);
  const [addingChild, setAddingChild] = useState(false);
  const [childValue, setChildValue] = useState('');

  // Draggable: the idea itself
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: idea.id,
  });

  // Droppable: drop another idea ON this idea to make it a child
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: idea.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const hasChildren = idea.children && idea.children.length > 0;

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== idea.content) {
      onUpdate(idea.id, editValue.trim());
    }
    setEditing(false);
  };

  const handleAddChild = () => {
    if (!childValue.trim()) return;
    onAddChild(idea.id, childValue.trim());
    setChildValue('');
    setAddingChild(false);
    setExpanded(true);
  };

  const categoryInfo = idea.category_id
    ? categories.find(c => c.id === idea.category_id)
    : null;

  return (
    <div className="idea-node" style={{ marginLeft: depth > 0 ? 0 : 0 }}>
      {/* Combined ref: acts as both draggable source AND droppable target */}
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        className={`idea-node-content ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''}`}
        style={style}
      >
        <span
          className={`idea-node-expand ${hasChildren && !expanded ? 'collapsed' : ''} ${!hasChildren ? 'leaf' : ''}`}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          {hasChildren ? '▼' : '•'}
        </span>

        {editing ? (
          <div className="idea-node-edit">
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
          </div>
        ) : (
          <span className="idea-node-text" {...listeners} {...attributes}>
            {idea.content}
            {categoryInfo && (
              <span className="category-badge" style={{
                marginLeft: 8,
                background: categoryInfo.color ? categoryInfo.color + '22' : undefined,
                color: categoryInfo.color || undefined,
                border: categoryInfo.color ? `1px solid ${categoryInfo.color}44` : undefined,
              }}>
                {categoryInfo.name}
              </span>
            )}
          </span>
        )}

        <div className="idea-node-actions">
          {!editing && (
            <>
              <button className="btn-icon" title="编辑" onClick={() => { setEditing(true); setEditValue(idea.content); }}>✏️</button>
              <button className="btn-icon" title="添加子想法" onClick={() => setAddingChild(!addingChild)}>➕</button>
              <button className="btn-icon" title="提升为待办" onClick={() => onPromote(idea)}>⬆</button>
              <button className="btn-icon" title="删除" onClick={() => onDelete(idea.id)}>🗑</button>
            </>
          )}
        </div>
      </div>

      {addingChild && (
        <div style={{ display: 'flex', gap: 6, padding: '4px 12px 4px 40px', alignItems: 'center' }}>
          <input
            placeholder="输入子想法..."
            value={childValue}
            onChange={e => setChildValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddChild();
              if (e.key === 'Escape') setAddingChild(false);
            }}
            style={{ flex: 1, fontSize: 13, padding: '4px 8px' }}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" onClick={handleAddChild}>添加</button>
        </div>
      )}

      {hasChildren && expanded && (
        <div className="idea-node-children">
          {idea.children!.map(child => (
            <IdeaNode
              key={child.id}
              idea={child}
              onPromote={onPromote}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onMoveCategory={onMoveCategory}
              categories={categories}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
