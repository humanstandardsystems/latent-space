import { Suspense, useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';
import { ClubCanvas } from '../components/ClubCanvas.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { NowPlaying } from '../components/NowPlaying.tsx';

export function ClubPage() {
  const { connected } = useWebSocket();

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', position: 'relative' }}>
      {/* 3D canvas fills the page */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Suspense fallback={null}>
          <ClubCanvas />
        </Suspense>
        <NowPlaying />
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: 11,
          color: connected ? '#4ade80' : '#f87171',
          fontFamily: 'monospace',
        }}>
          {connected ? '● live' : '○ connecting...'}
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#4a3060', fontFamily: 'monospace' }}>
          <a href="/auth" style={{ color: '#7c3aed' }}>sign in</a>
          {' · '}
          <a href="/dj" style={{ color: '#7c3aed' }}>dj dashboard</a>
        </div>
      </div>

      {/* Chat sidebar */}
      <ChatPanel />
    </div>
  );
}
