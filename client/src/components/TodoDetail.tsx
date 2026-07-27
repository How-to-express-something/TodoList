import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { todosApi } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import type { Todo } from '../types';
import ImmersionView from './ImmersionView';

export default function TodoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { autoPlayForTodo, stopForTodo, resumeIfPaused, tracks, isPlaying } = useWhiteNoise();

  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    todosApi.get(Number(id)).then(data => {
      setTodo(data);
      setLoading(false);

      // If not ?immersion=true, redirect to /todos
      if (searchParams.get('immersion') !== 'true') {
        navigate('/todos', { replace: true });
        return;
      }

      // Auto-play music on mount
      if (data.status === 'in_progress' && tracks.length > 0) {
        resumeIfPaused();
        if (!isPlaying) autoPlayForTodo();
      }
    }).catch(() => {
      setLoading(false);
      navigate('/todos', { replace: true });
    });
  }, [id]);

  const handlePause = async () => {
    if (!todo) return;
    await todosApi.pause(todo.id);
    stopForTodo();
    setTodo({ ...todo, status: 'pending' });
  };

  const handleComplete = async () => {
    if (!todo) return;
    await todosApi.complete(todo.id);
    stopForTodo();
    navigate('/todos');
  };

  if (loading || !todo) return null;
  if (searchParams.get('immersion') !== 'true') return null;

  return (
    <ImmersionView
      todo={todo}
      onPause={handlePause}
      onComplete={handleComplete}
    />
  );
}
