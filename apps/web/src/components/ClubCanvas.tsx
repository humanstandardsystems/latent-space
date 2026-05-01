import { Canvas } from '@react-three/fiber';
import { Room } from './Room.tsx';

export function ClubCanvas({ myAccountId }: { myAccountId: string | null }) {
  return (
    <Canvas
      camera={{ position: [0, 6, 14], fov: 65 }}
      style={{ background: '#000814', width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <fog attach="fog" args={['#000814', 20, 60]} />
      <Room myAccountId={myAccountId} />
    </Canvas>
  );
}
