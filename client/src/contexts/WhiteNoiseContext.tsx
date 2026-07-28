import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { audioApi } from '../api';
import type { AudioTrack } from '../types';

interface WhiteNoiseContextType {
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (v: number) => void;
  loadTracks: () => Promise<void>;
  play: (track?: AudioTrack) => void;
  pause: () => void;
  stop: () => void;
  toggle: (track?: AudioTrack) => void;
  selectTrack: (id: number) => void;
  resumeIfPaused: () => void;
  autoPlayForTodo: () => void;
  stopForTodo: () => void;
  refreshTracks: () => Promise<void>;
  /** Seek audio to specific fraction [0-1] */
  seek: (fraction: number) => void;
  /** Progress of current track (0-1) */
  progress: number;
  /** Duration in seconds */
  duration: number;
}

const WhiteNoiseContext = createContext<WhiteNoiseContextType | null>(null);

export function WhiteNoiseProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayingBeforePause = useRef(false);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTracks = useCallback(async () => {
    try {
      const t = await audioApi.list();
      setTracks(t);
      if (!currentTrack && t.length > 0) {
        setCurrentTrack(t[0]);
      }
    } catch (e) {
      console.error('Failed to load tracks:', e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  const startProgressTracking = useCallback((audio: HTMLAudioElement) => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    setDuration(audio.duration || 0);
    progressInterval.current = setInterval(() => {
      if (audio && !audio.paused) {
        setProgress(audio.currentTime / (audio.duration || 1));
      }
    }, 250);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const play = useCallback((track?: AudioTrack) => {
    const t = track || currentTrack;
    if (!t) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(audioApi.playUrl(t.id));
    audio.volume = volume;
    audio.loop = true;

    // Restore saved position
    try {
      const saved = localStorage.getItem('todolist_audio_pos_' + t.id);
      if (saved) audio.currentTime = parseFloat(saved);
    } catch {}

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration || 0));
    audio.play().then(() => {
      setIsPlaying(true);
      setCurrentTrack(t);
      wasPlayingBeforePause.current = true;
      startProgressTracking(audio);
    }).catch(e => console.warn('Audio play failed:', e));
    audioRef.current = audio;
  }, [currentTrack, volume, startProgressTracking]);

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      // Save position before pausing
      try {
        if (currentTrack) localStorage.setItem('todolist_audio_pos_' + currentTrack.id, String(audioRef.current.currentTime));
      } catch {}
      audioRef.current.pause();
      setIsPlaying(false);
      wasPlayingBeforePause.current = false;
      stopProgressTracking();
    }
  }, [isPlaying, stopProgressTracking, currentTrack]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    wasPlayingBeforePause.current = false;
    stopProgressTracking();
  }, [stopProgressTracking]);

  const toggle = useCallback((track?: AudioTrack) => {
    if (track) {
      if (currentTrack?.id === track.id && isPlaying) {
        pause();
      } else {
        play(track);
      }
    } else {
      if (isPlaying) pause();
      else play();
    }
  }, [currentTrack, isPlaying, play, pause]);

  const selectTrack = useCallback((id: number) => {
    const track = tracks.find(t => t.id === id);
    if (track) play(track);
  }, [tracks, play]);

  const seek = useCallback((fraction: number) => {
    if (audioRef.current) {
      const target = fraction * audioRef.current.duration;
      audioRef.current.currentTime = target;
      setProgress(fraction);
    }
  }, []);

  const resumeIfPaused = useCallback(() => {
    if (currentTrack && !isPlaying && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        wasPlayingBeforePause.current = true;
        startProgressTracking(audioRef.current!);
      }).catch(e => console.warn('Audio resume failed:', e));
    }
  }, [currentTrack, isPlaying, startProgressTracking]);

  const autoPlayForTodo = useCallback(() => {
    if (tracks.length > 0) {
      const target = currentTrack || tracks[0];
      play(target);
    }
  }, [tracks, currentTrack, play]);

  const stopForTodo = useCallback(() => {
    pause();
  }, [pause]);

  const refreshTracks = useCallback(async () => {
    await loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    loadTracks();
    return () => stopProgressTracking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WhiteNoiseContext.Provider value={{
      tracks,
      currentTrack,
      isPlaying,
      volume,
      setVolume,
      loadTracks,
      play,
      pause,
      stop,
      toggle,
      selectTrack,
      resumeIfPaused,
      autoPlayForTodo,
      stopForTodo,
      refreshTracks,
      seek,
      progress,
      duration,
    }}>
      {children}
    </WhiteNoiseContext.Provider>
  );
}

export function useWhiteNoise() {
  const ctx = useContext(WhiteNoiseContext);
  if (!ctx) throw new Error('useWhiteNoise must be used within WhiteNoiseProvider');
  return ctx;
}
