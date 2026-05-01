import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { BeanieVoxels } from './BeanieVoxels.tsx';

type AnimationState = 'idle' | 'moshing' | 'floating' | 'shuffling';

interface BlobProps {
  position: [number, number, number];
  color: string;
  animationState: AnimationState;
  bassLevel: number;
  isMe?: boolean;
  dropActive?: boolean;
  velocity?: { x: number; z: number };
}

export function Blob({ position, color, animationState, bassLevel, isMe, dropActive, velocity }: BlobProps) {
  const meshRef = useRef<Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const dropVel = useRef({ x: 0, z: 0 });

  if (dropActive && velocity) {
    dropVel.current = velocity;
  }

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const p = phase.current;

    // base bounce
    let yOffset = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (animationState === 'idle') {
      yOffset = Math.sin(t * 1.5 + p) * 0.1;
      scaleY = 1 + Math.sin(t * 1.5 + p) * 0.05;
    } else if (animationState === 'moshing') {
      yOffset = Math.sin(t * 6 + p) * 0.3 + Math.random() * 0.1;
      scaleX = 1 + Math.sin(t * 8 + p) * 0.15;
      scaleY = 1 - Math.sin(t * 8 + p) * 0.1;
    } else if (animationState === 'floating') {
      yOffset = Math.sin(t * 0.5 + p) * 0.4;
      scaleY = 1 + Math.sin(t * 0.5 + p) * 0.08;
    } else if (animationState === 'shuffling') {
      yOffset = Math.abs(Math.sin(t * 4 + p)) * 0.2;
      scaleX = 1 + Math.cos(t * 4 + p) * 0.1;
    }

    // bass-driven glow scale
    const bassScale = 1 + bassLevel * 0.3;

    meshRef.current.position.set(position[0], position[1] + yOffset, position[2]);
    meshRef.current.scale.set(scaleX * bassScale, scaleY * bassScale, scaleX * bassScale);

    // drop scatter
    if (dropActive) {
      meshRef.current.position.x += dropVel.current.x * 0.016;
      meshRef.current.position.z += dropVel.current.z * 0.016;
    }
  });

  const glowIntensity = 0.4 + bassLevel * 0.6;

  return (
    <group ref={meshRef} position={position}>
      <BeanieVoxels color={color} glowIntensity={glowIntensity} />
      {isMe && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
