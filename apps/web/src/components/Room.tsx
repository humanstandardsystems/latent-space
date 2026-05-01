import { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Text, Grid } from '@react-three/drei';
import { MyBlob } from './MyBlob.tsx';
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

// Pulsing ceiling rig bar
function RigBar({ position, color, phase }: { position: [number, number, number]; color: string; phase: number }) {
  const meshRef = useRef<any>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    meshRef.current.material.emissiveIntensity = 1.5 + Math.sin(t * 2 + phase) * 0.5;
  });
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.06, 0.06, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0.2} />
    </mesh>
  );
}

// Speaker tower with glowing accent strips
function SpeakerTower({ position, accentColor }: { position: [number, number, number]; accentColor: string }) {
  const stripRef = useRef<any>(null);
  useFrame(({ clock }) => {
    if (!stripRef.current) return;
    const t = clock.elapsedTime;
    stripRef.current.material.emissiveIntensity = 0.8 + Math.sin(t * 1.5 + position[0]) * 0.4;
  });
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[0.7, 4, 0.7]} />
        <meshStandardMaterial color="#040c1a" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Top accent strip */}
      <mesh ref={stripRef} position={[0, 4.1, 0]}>
        <boxGeometry args={[0.72, 0.08, 0.72]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.8} roughness={0.1} />
      </mesh>
      {/* Mid accent strip */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[0.72, 0.04, 0.72]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

export function Room({ myAccountId, myBlobColor }: { myAccountId: string | null; myBlobColor: string }) {
  const { subscribe, send } = useWebSocket();
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
        const { accountId, color } = msg.data as { accountId: string; color?: string };
        setBlobMap((prev) => {
          if (prev.has(accountId)) return prev;
          const next = new Map(prev);
          next.set(accountId, {
            accountId,
            position: { x: (Math.random() - 0.5) * 10, y: 0 },
            color: color ?? '#8b5cf6',
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
        const snap = msg.data as {
          blobPositions: Record<string, { x: number; y: number }>;
          blobColors?: Record<string, string>;
        };
        setBlobMap((prev) => {
          const next = new Map(prev);
          for (const [id, pos] of Object.entries(snap.blobPositions ?? {})) {
            next.set(id, {
              accountId: id,
              position: pos,
              color: snap.blobColors?.[id] ?? '#8b5cf6',
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
      <ambientLight intensity={0.04} color="#000814" />
      <pointLight position={[0, 8, 0]} intensity={4} color="#00ffff" distance={30} />
      <pointLight position={[-8, 5, 0]} intensity={3} color="#ff00ff" distance={25} />
      <pointLight position={[8, 5, 0]} intensity={3} color="#ff00ff" distance={25} />
      <pointLight position={[0, 2, 8]} intensity={1.5} color="#0040ff" distance={20} />
      {audio.dropActive && (
        <pointLight position={[0, 6, 0]} intensity={20} color="#ffffff" distance={40} />
      )}

      {/* Tron grid floor */}
      <Grid
        position={[0, -0.5, 0]}
        args={[60, 60]}
        cellColor="#0a1a2a"
        sectionColor="#00ffff"
        cellSize={1}
        sectionSize={5}
        fadeDistance={50}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Ceiling light rig bars */}
      <group position={[0, 9, -1]}>
        <RigBar position={[-3.5, 0, 0]} color="#00ffff" phase={0} />
        <RigBar position={[-1.5, 0, 0]} color="#ff00ff" phase={1.2} />
        <RigBar position={[1.5, 0, 0]} color="#00ffff" phase={2.4} />
        <RigBar position={[3.5, 0, 0]} color="#ff00ff" phase={0.6} />
      </group>

      {/* Speaker towers — flanking the DJ booth */}
      <SpeakerTower position={[-5.5, 0, -6]} accentColor="#00ffff" />
      <SpeakerTower position={[5.5, 0, -6]} accentColor="#ff00ff" />
      {/* Back corners */}
      <SpeakerTower position={[-5.5, 0, 5]} accentColor="#ff00ff" />
      <SpeakerTower position={[5.5, 0, 5]} accentColor="#00ffff" />

      {/* DJ Booth */}
      <group position={[0, 0, -8]}>
        {/* Main body */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[4, 0.8, 1.5]} />
          <meshStandardMaterial color="#020c1a" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Front edge glow strip */}
        <mesh position={[0, 0.02, 0.76]}>
          <boxGeometry args={[4.02, 0.04, 0.04]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={3} />
        </mesh>
        {/* Top edge strip */}
        <mesh position={[0, 0.82, 0]}>
          <boxGeometry args={[4.02, 0.04, 1.52]} />
          <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={2} />
        </mesh>
        {/* Now playing text */}
        {nowPlaying && (
          <Text
            position={[0, 2.2, 0]}
            fontSize={0.28}
            color="#00ffff"
            anchorX="center"
            anchorY="middle"
            font={undefined}
            outlineWidth={0.01}
            outlineColor="#000814"
          >
            {[nowPlaying.artist, nowPlaying.title].filter(Boolean).join(' — ') || 'latent space'}
          </Text>
        )}
        {!nowPlaying && (
          <Text
            position={[0, 2.2, 0]}
            fontSize={0.18}
            color="#1a3a5a"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            latent space
          </Text>
        )}
      </group>

      {/* My blob — keyboard controlled, always mounted when authenticated */}
      {myAccountId && (
        <MyBlob
          color={myBlobColor}
          bassLevel={audio.subBassEnergy}
          dropActive={audio.dropActive}
          initialPosition={{ x: 0, y: 0 }}
          onMove={(x, y) => send('move', { x, y })}
        />
      )}

      {/* Other blobs */}
      {Array.from(blobMap.values())
        .filter((blob) => blob.accountId !== myAccountId)
        .map((blob) => (
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
          intensity={audio.dropActive ? 5 : 1.2 + audio.subBassEnergy * 2}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.2}
        />
      </EffectComposer>
    </>
  );
}
