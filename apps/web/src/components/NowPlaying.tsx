import { useState, useEffect } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';

interface NowPlayingData {
  artist?: string;
  title?: string;
  genre?: string;
}

export function NowPlaying() {
  const [track, setTrack] = useState<NowPlayingData | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'now_playing') {
        setTrack(msg.data as NowPlayingData);
      }
      if (msg.type === 'room_snapshot') {
        // initial state — could fetch current track
      }
    });
  }, [subscribe]);

  if (!track?.title && !track?.artist) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      right: 16,
      background: 'rgba(10, 0, 16, 0.85)',
      border: '1px solid #4c1d95',
      borderRadius: 6,
      padding: '8px 14px',
      fontFamily: 'monospace',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 10, color: '#6d28d9', marginBottom: 2 }}>now playing</div>
      {track.artist && <div style={{ fontSize: 13, color: '#e0d0ff' }}>{track.artist}</div>}
      {track.title && <div style={{ fontSize: 11, color: '#a78bfa' }}>{track.title}</div>}
      {track.genre && <div style={{ fontSize: 10, color: '#4c1d95', marginTop: 2 }}>{track.genre}</div>}
    </div>
  );
}
