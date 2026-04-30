import { Canvas } from '@react-three/fiber';
import { Room } from './Room.tsx';

export function ClubCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 8, 16], fov: 60 }}
      style={{ background: '#0a0010', width: '100%', height: '100%' }}
    >
      <Room />
    </Canvas>
  );
}
