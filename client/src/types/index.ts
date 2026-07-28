export interface Todo {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: number;
  total_elapsed_seconds?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  ideas?: NewIdea[];
  time_segments?: TimeSegment[];
}

export interface NewIdea {
  id: number;
  content: string;
  parent_todo_id: number | null;
  parent_idea_id: number | null;
  category_id: number | null;
  sort_order: number;
  created_at: string;
  children?: NewIdea[];
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  created_at: string;
  children?: Category[];
}

export interface AudioTrack {
  id: number;
  name: string;
  file_name: string;
  is_default: number;
  created_at: string;
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error';
  action: string;
  detail: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

export interface TimeSegment {
  id: number;
  todo_id: number;
  start_at: string;
  end_at: string | null;
  created_at: string;
}
