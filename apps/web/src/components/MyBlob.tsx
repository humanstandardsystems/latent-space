import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface MyBlobProps {
  color: string;
  bassLevel: number;
  dropActive: boolean;
  initialPosition: { x: number; y: number };
  onMove: (x: number, y: number) => void;
}

const SPEED = 5; // units per second
const SEND_INTERVAL_MS = 100; // throttle WS to 10Hz
const BOUNDS = { x: 12, y: 8 };

export function MyBlob({ color, bassLevel, dropActive, initialPosition, onMove }: MyBlobProps) {
  const groupRef = useRef<Group>(null);
  const pos = useRef({ x: initialPosition.x, y: initialPosition.y });
  const keys = useRef(new Set<string>());
  const lastSend = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // prevent arrow keys from scrolling the page
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      keys.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const k = keys.current;
    let dx = 0, dz = 0;

    if (k.has('ArrowUp') || k.has('w') || k.has('W')) dz -= SPEED * delta;
    if (k.has('ArrowDown') || k.has('s') || k.has('S')) dz += SPEED * delta;
    if (k.has('ArrowLeft') || k.has('a') || k.has('A')) dx -= SPEED * delta;
    if (k.has('ArrowRight') || k.has('d') || k.has('D')) dx += SPEED * delta;

    if (dx !== 0 || dz !== 0) {
      pos.current.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, pos.current.x + dx));
      pos.current.y = Math.max(-BOUNDS.y, Math.min(BOUNDS.y, pos.current.y + dz));

      const now = clock.elapsedTime * 1000;
      if (now - lastSend.current > SEND_INTERVAL_MS) {
        onMove(pos.current.x, pos.current.y);
        lastSend.current = now;
      }
    }

    const t = clock.elapsedTime;
    const yBob = Math.sin(t * 1.5) * 0.1;
    const bassScale = 1 + bassLevel * 0.3;
    const dropPop = dropActive ? 1.3 : 1;

    groupRef.current.position.set(pos.current.x, 0.5 + yBob, pos.current.y);
    groupRef.current.scale.setScalar(bassScale * dropPop);
  });

  const glowIntensity = 0.5 + bassLevel * 0.6;

  return (
    <group ref={groupRef} position={[initialPosition.x, 0.5, initialPosition.y]}>
      <mesh>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glowIntensity}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {/* "you are here" ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <ringGeometry args={[0.65, 0.8, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
