import { Suspense, useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';
import { ClubCanvas } from '../components/ClubCanvas.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { NowPlaying } from '../components/NowPlaying.tsx';
import { TwitchEmbed } from '../components/TwitchEmbed.tsx';
import { ColorPickerModal } from '../components/ColorPickerModal.tsx';

const DEFAULT_BLOB_COLOR = '#8b5cf6';

export function ClubPage() {
  const { connected, subscribe } = useWebSocket();
  const [twitchChannel, setTwitchChannel] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [myAccountId, setMyAccountId] = useState<string | null>(null);
  const [myBlobColor, setMyBlobColor] = useState<string>(DEFAULT_BLOB_COLOR);
  const [needsColorPick, setNeedsColorPick] = useState(false);

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
      .then((d) => {
        if (d.account?.id) {
          setMyAccountId(d.account.id);
          const blobColor: string | undefined = d.blob?.color;
          if (!d.blob || blobColor === DEFAULT_BLOB_COLOR) {
            setNeedsColorPick(true);
          }
          if (blobColor) setMyBlobColor(blobColor);
        }
      })
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
          <ClubCanvas myAccountId={myAccountId} myBlobColor={myBlobColor} />
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

      {needsColorPick && (
        <ColorPickerModal
          onColorPicked={(color) => {
            setMyBlobColor(color);
            setNeedsColorPick(false);
          }}
        />
      )}
    </div>
  );
}
