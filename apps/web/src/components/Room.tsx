import { useEffect, useState, useRef } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Text } from '@react-three/drei';
import { useWebSocket } from '../contexts/WebSocketContext.tsx';
import { Blob } from './Blob.tsx';

type AnimationState = 'idle' | 'moshing' | 'floating' | 'shuffling';

interface BlobState {
  accountId: string;
  position: { x: number; y: number };
  color: string;
  animationState: AnimationState;
}

interface AudioState {
  bpm: number;
  subBassEnergy: number;
  dropActive: boolean;
}

interface NowPlaying {
  artist?: string;
  title?: string;
  genre?: string;
}

function genreToAnimation(genre?: string): AnimationState {
  if (!genre) return 'idle';
  if (['dubstep', 'deep', 'riddim', 'trap'].includes(genre)) return 'moshing';
  if (['dnb'].includes(genre)) return 'shuffling';
  if (['ambient', 'psychedelic'].includes(genre)) return 'floating';
  return 'idle';
}

export function Room() {
  const { subscribe } = useWebSocket();
  const [blobMap, setBlobMap] = useState<Map<string, BlobState>>(new Map());
  const [audio, setAudio] = useState<AudioState>({ bpm: 120, subBassEnergy: 0, dropActive: false });
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const dropVelocities = useRef<Map<string, { x: number; z: number }>>(new Map());

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'audio_state') {
        setAudio(msg.data as AudioState);
      }

      if (msg.type === 'drop_start') {
        setAudio((a) => ({ ...a, dropActive: true }));
        // assign random scatter velocities
        setBlobMap((prev) => {
          const next = new Map(prev);
          for (const [id] of next) {
            dropVelocities.current.set(id, {
              x: (Math.random() - 0.5) * 8,
              z: (Math.random() - 0.5) * 8,
            });
          }
          return next;
        });
        setTimeout(() => setAudio((a) => ({ ...a, dropActive: false })), 2000);
      }

      if (msg.type === 'now_playing') {
        const np = msg.data as NowPlaying;
        setNowPlaying(np);
        const anim = genreToAnimation(np.genre);
        setBlobMap((prev) => {
          const next = new Map(prev);
          for (const [id, b] of next) {
            next.set(id, { ...b, animationState: anim });
          }
          return next;
        });
      }

      if (msg.type === 'blob_join') {
        const { accountId } = msg.data as { accountId: string };
        setBlobMap((prev) => {
          if (prev.has(accountId)) return prev;
          const next = new Map(prev);
          next.set(accountId, {
            accountId,
            position: { x: (Math.random() - 0.5) * 10, y: 0 },
            color: '#8b5cf6',
            animationState: 'idle',
          });
          return next;
        });
      }

      if (msg.type === 'blob_leave') {
        const { accountId } = msg.data as { accountId: string };
        setBlobMap((prev) => {
          const next = new Map(prev);
          next.delete(accountId);
          return next;
        });
      }

      if (msg.type === 'blob_update') {
        const { accountId, position, color } = msg.data as { accountId: string; position?: { x: number; y: number }; color?: string };
        setBlobMap((prev) => {
          const existing = prev.get(accountId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(accountId, {
            ...existing,
            position: position ?? existing.position,
            color: color ?? existing.color,
          });
          return next;
        });
      }

      if (msg.type === 'room_snapshot') {
        const snap = msg.data as { blobPositions: Record<string, { x: number; y: number }> };
        setBlobMap((prev) => {
          const next = new Map(prev);
          for (const [id, pos] of Object.entries(snap.blobPositions ?? {})) {
            next.set(id, {
              accountId: id,
              position: pos,
              color: '#8b5cf6',
              animationState: 'idle',
            });
          }
          return next;
        });
      }
    });
  }, [subscribe]);

  const animState = nowPlaying ? genreToAnimation(nowPlaying.genre) : 'idle';

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.1} color="#1a0040" />
      <pointLight position={[0, 8, 0]} intensity={2} color="#6d28d9" />
      <pointLight position={[-8, 4, -8]} intensity={1.5} color="#be185d" distance={20} />
      <pointLight position={[8, 4, 8]} intensity={1.5} color="#0ea5e9" distance={20} />
      {audio.dropActive && (
        <pointLight position={[0, 6, 0]} intensity={10} color="#ffffff" distance={30} />
      )}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#050008" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* DJ Booth */}
      <group position={[0, 0, -8]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[4, 0.8, 1.5]} />
          <meshStandardMaterial color="#1a0040" emissive="#4c1d95" emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
        {nowPlaying && (
          <Text
            position={[0, 2, 0]}
            fontSize={0.3}
            color="#c084fc"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {[nowPlaying.artist, nowPlaying.title].filter(Boolean).join(' - ') || 'latent space'}
          </Text>
        )}
      </group>

      {/* Blobs */}
      {Array.from(blobMap.values()).map((blob) => (
        <Blob
          key={blob.accountId}
          position={[blob.position.x, 0.5, blob.position.y]}
          color={blob.color}
          animationState={animState}
          bassLevel={audio.subBassEnergy}
          dropActive={audio.dropActive}
          velocity={dropVelocities.current.get(blob.accountId)}
        />
      ))}

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={audio.dropActive ? 3 : 1 + audio.subBassEnergy * 2}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  );
}
