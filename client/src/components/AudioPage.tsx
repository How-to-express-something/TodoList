import { useState, useEffect } from 'react';
import { audioApi } from '../api';
import { useWhiteNoise } from '../contexts/WhiteNoiseContext';
import type { AudioTrack } from '../types';
import '../styles/audio.css';

export default function AudioPage() {
  const { tracks, currentTrack, isPlaying, play, pause, refreshTracks } = useWhiteNoise();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await refreshTracks();
      setLoading(false);
    };
    load();
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await audioApi.upload(uploadFile, uploadName || undefined);
      setUploadFile(null);
      setUploadName('');
      await refreshTracks();
    } catch (e) {
      console.error('Upload failed:', e);
      alert('上传失败，请检查文件格式');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此音频？')) return;
    await audioApi.delete(id);
    if (currentTrack?.id === id) {
      pause();
    }
    await refreshTracks();
  };

  const handlePlay = (track: AudioTrack) => {
    if (currentTrack?.id === track.id && isPlaying) {
      pause();
    } else {
      play(track);
    }
  };

  if (loading) return <div className="page"><p>加载中...</p></div>;

  return (
    <div className="page audio-page">
      <h1 className="page-title">🎵 白噪声管理</h1>

      <div className="upload-form">
        <h3>添加新音频</h3>
        <div className="upload-form-row">
          <input
            placeholder="名称（可选，默认文件名）"
            value={uploadName}
            onChange={e => setUploadName(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div className="upload-form-row">
          <input
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.flac,.webm"
            onChange={e => setUploadFile(e.target.files?.[0] || null)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
          >
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
        音频列表 ({tracks.length})
      </h3>

      {tracks.length === 0 ? (
        <div className="empty-state">
          <p>暂无音频文件，上传后即可在白噪声中播放</p>
        </div>
      ) : (
        tracks.map(track => (
          <div
            key={track.id}
            className={`audio-track-item ${currentTrack?.id === track.id ? 'current' : ''}`}
          >
            <div className="audio-track-info">
              <div className="audio-track-name">
                {currentTrack?.id === track.id && isPlaying ? '🔊 ' : '🎵 '}
                {track.name}
              </div>
              <div className="audio-track-meta">
                {track.created_at?.slice(0, 10)}
                {track.is_default ? ' · 默认' : ''}
              </div>
            </div>
            <div className="audio-track-actions">
              <button
                className={`btn btn-sm ${currentTrack?.id === track.id && isPlaying ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handlePlay(track)}
              >
                {currentTrack?.id === track.id && isPlaying ? '暂停' : '播放'}
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(track.id)}>
                删除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
