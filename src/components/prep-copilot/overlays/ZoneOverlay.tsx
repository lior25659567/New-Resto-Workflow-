import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useModelContext } from '../CopilotScene';
import type { ZoneId } from '../types';

const ZONE_COLORS: Record<ZoneId, string> = {
  occlusal: '#009ACE',
  buccal: '#8B5CF6',
  lingual: '#00964E',
  mesial: '#F59E0B',
  distal: '#D43F58',
};

interface ZoneOverlayProps {
  visible: boolean;
  selectedZone: ZoneId | null;
  onZoneClick?: (zone: ZoneId) => void;
  scale?: number;
  rotation?: [number, number, number];
}

export default function ZoneOverlay({ visible, selectedZone, onZoneClick, scale: scaleProp, rotation: rotationProp }: ZoneOverlayProps) {
  const ctx = useModelContext();
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = visible ? 1 : 0;
    opacityRef.current += (target - opacityRef.current) * Math.min(delta * 6, 1);
    groupRef.current.visible = opacityRef.current > 0.01;

    groupRef.current.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = opacityRef.current * (child.userData.isSelected ? 0.4 : 0.2);
      }
    });
  });

  const zones = useMemo(() => {
    if (!ctx) return [];

    const { bounds } = ctx;
    const cx = bounds.centerX;
    const cy = bounds.centerY;
    const cz = bounds.centerZ;
    const rx = (bounds.maxX - bounds.minX) * 0.4;
    const ry = (bounds.maxY - bounds.minY) * 0.4;
    const rz = (bounds.maxZ - bounds.minZ) * 0.4;

    const zonePositions: { zone: ZoneId; pos: [number, number, number] }[] = [
      { zone: 'occlusal', pos: [cx, cy + ry, cz] },
      { zone: 'buccal', pos: [cx, cy, cz + rz] },
      { zone: 'lingual', pos: [cx, cy, cz - rz] },
      { zone: 'mesial', pos: [cx + rx, cy, cz] },
      { zone: 'distal', pos: [cx - rx, cy, cz] },
    ];

    return zonePositions;
  }, [ctx]);

  if (!ctx) return null;

  const S = scaleProp ?? 0.055;
  const sphereRadius = Math.max(
    (ctx.bounds.maxX - ctx.bounds.minX),
    (ctx.bounds.maxY - ctx.bounds.minY),
    (ctx.bounds.maxZ - ctx.bounds.minZ)
  ) * 0.12;

  return (
    <group ref={groupRef} scale={S} rotation={rotationProp}>
      {zones.map(({ zone, pos }) => (
        <mesh
          key={zone}
          position={pos}
          userData={{ isSelected: selectedZone === zone }}
          onClick={(e) => {
            e.stopPropagation();
            onZoneClick?.(zone);
          }}
        >
          <sphereGeometry args={[sphereRadius, 16, 16]} />
          <meshBasicMaterial
            color={ZONE_COLORS[zone]}
            transparent
            opacity={0.2}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
