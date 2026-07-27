import type { Todo, NewIdea, Category, AudioTrack } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Todos
export const todosApi = {
  list: () => request<Todo[]>('/todos'),
  get: (id: number) => request<Todo>(`/todos/${id}`),
  create: (data: { title: string; description?: string; priority?: number }) =>
    request<Todo>('/todos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Todo>) =>
    request<Todo>(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  start: (id: number) => request<Todo>(`/todos/${id}/start`, { method: 'PATCH' }),
  pause: (id: number) => request<Todo>(`/todos/${id}/pause`, { method: 'PATCH' }),
  complete: (id: number) => request<Todo>(`/todos/${id}/complete`, { method: 'PATCH' }),
  delete: (id: number) => request<{ success: boolean }>(`/todos/${id}`, { method: 'DELETE' }),
  stats: () => request<{ total: number; completed: number; totalCount: number }>('/todos/stats/summary'),
};

// New Ideas
export const newIdeasApi = {
  list: (params?: { todo_id?: number; category_id?: number; parent_idea_id?: number | 'null' }) => {
    const q = new URLSearchParams();
    if (params?.todo_id) q.set('todo_id', String(params.todo_id));
    if (params?.category_id) q.set('category_id', String(params.category_id));
    if (params?.parent_idea_id !== undefined) q.set('parent_idea_id', String(params.parent_idea_id));
    const qs = q.toString();
    return request<NewIdea[]>(`/new-ideas${qs ? '?' + qs : ''}`);
  },
  tree: () => request<(Todo & { ideas: NewIdea[] })[]>('/new-ideas/tree'),
  create: (data: { content: string; parent_todo_id?: number | null; parent_idea_id?: number | null; category_id?: number | null }) =>
    request<NewIdea>('/new-ideas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { content?: string; category_id?: number | null }) =>
    request<NewIdea>(`/new-ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  move: (id: number, data: { parent_todo_id?: number | null; parent_idea_id?: number | null; category_id?: number | null; sort_order?: number }) =>
    request<NewIdea>(`/new-ideas/${id}/move`, { method: 'PATCH', body: JSON.stringify(data) }),
  promote: (id: number) => request<Todo>(`/new-ideas/${id}/promote`, { method: 'POST' }),
  delete: (id: number) => request<{ success: boolean }>(`/new-ideas/${id}`, { method: 'DELETE' }),
};

// Categories
export const categoriesApi = {
  list: () => request<Category[]>('/categories'),
  flat: () => request<Category[]>('/categories/flat'),
  create: (data: { name: string; parent_id?: number | null; color?: string | null }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string; color?: string }) =>
    request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  move: (id: number, parent_id: number | null) =>
    request<Category>(`/categories/${id}/move`, { method: 'PATCH', body: JSON.stringify({ parent_id }) }),
  delete: (id: number) => request<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
};

// Audio
export const audioApi = {
  list: () => request<AudioTrack[]>('/audio'),
  upload: async (file: File, name?: string) => {
    const form = new FormData();
    form.append('audio', file);
    if (name) form.append('name', name);
    const res = await fetch(`${BASE}/audio/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json() as Promise<AudioTrack>;
  },
  playUrl: (id: number) => `${BASE}/audio/${id}/play`,
  delete: (id: number) => request<{ success: boolean }>(`/audio/${id}`, { method: 'DELETE' }),
};

// Export
export function exportNewIdeas(format: 'txt' | 'md' | 'docx', todoName = 'My New Ideas') {
  window.open(`${BASE}/new-ideas/export?format=${format}&todo_name=${encodeURIComponent(todoName)}`, '_blank');
}
