import { Suspense, useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';
import { ClubCanvas } from '../components/ClubCanvas.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { NowPlaying } from '../components/NowPlaying.tsx';
import { TwitchEmbed } from '../components/TwitchEmbed.tsx';

export function ClubPage() {
  const { connected, subscribe } = useWebSocket();
  const [twitchChannel, setTwitchChannel] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [myAccountId, setMyAccountId] = useState<string | null>(null);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'room_snapshot') {
        const snap = msg.data as { connectedCount: number };
        setConnectedCount(snap.connectedCount);
      }
      if (msg.type === 'blob_join') setConnectedCount((n) => n + 1);
      if (msg.type === 'blob_leave') setConnectedCount((n) => Math.max(0, n - 1));
    });
  }, [subscribe]);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.account?.id) setMyAccountId(d.account.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/now-playing', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.set?.twitchChannel) setTwitchChannel(d.set.twitchChannel);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', position: 'relative' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Suspense fallback={null}>
          <ClubCanvas myAccountId={myAccountId} />
        </Suspense>

        <NowPlaying />

        {twitchChannel && <TwitchEmbed channel={twitchChannel} />}

        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          fontFamily: 'monospace',
          fontSize: 11,
        }}>
          <span style={{ color: connected ? '#4ade80' : '#f87171' }}>
            {connected ? '● live' : '○ connecting...'}
          </span>
          <span style={{ color: '#4a3060' }}>{connectedCount} in the room</span>
        </div>

        <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#4a3060', fontFamily: 'monospace' }}>
          <a href="/auth" style={{ color: '#7c3aed' }}>sign in</a>
          {' · '}
          <a href="/dj" style={{ color: '#7c3aed' }}>dj</a>
        </div>
      </div>

      <ChatPanel />
    </div>
  );
}
