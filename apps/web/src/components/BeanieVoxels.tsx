import { Instances, Instance } from '@react-three/drei';

const VOXEL = 0.28;
const STEP = 0.30;

type Vec3 = [number, number, number];

const EYE_POSITIONS: Vec3[] = [
  [-1 * STEP, 0 * STEP, 1 * STEP],
  [ 1 * STEP, 0 * STEP, 1 * STEP],
];

const BODY_AND_LEG_POSITIONS: Vec3[] = (() => {
  const positions: Vec3[] = [];
  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      for (let cy = 0; cy <= 1; cy++) {
        if (cy === 0 && cz === 1 && (cx === -1 || cx === 1)) continue;
        positions.push([cx * STEP, cy * STEP, cz * STEP]);
      }
    }
  }
  for (const cx of [-1, 1]) {
    for (const cy of [-1, -2]) {
      positions.push([cx * STEP, cy * STEP, 0]);
    }
  }
  return positions;
})();

interface BeanieVoxelsProps {
  color: string;
  glowIntensity: number;
}

export function BeanieVoxels({ color, glowIntensity }: BeanieVoxelsProps) {
  return (
    <>
      <Instances limit={BODY_AND_LEG_POSITIONS.length} range={BODY_AND_LEG_POSITIONS.length}>
        <boxGeometry args={[VOXEL, VOXEL, VOXEL]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glowIntensity}
          roughness={0.4}
          metalness={0}
        />
        {BODY_AND_LEG_POSITIONS.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>

      <Instances limit={EYE_POSITIONS.length} range={EYE_POSITIONS.length}>
        <boxGeometry args={[VOXEL, VOXEL, VOXEL]} />
        <meshStandardMaterial color="#000000" roughness={0.8} metalness={0} />
        {EYE_POSITIONS.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
    </>
  );
}
