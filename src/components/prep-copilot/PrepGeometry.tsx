import React from 'react';

const PREP_BASE_SCALE = 0.1;

interface PrepGeometryProps {
  visible: boolean;
  showInsertionPath?: boolean;
  prepPosition: [number, number, number];
  prepRotation: [number, number, number];
  prepScale: number;
  insertionAzimuth?: number;
  insertionElevation?: number;
}

export default function PrepGeometry({
  visible,
  showInsertionPath = false,
  prepPosition,
  prepRotation,
  prepScale,
  insertionAzimuth = 0,
  insertionElevation = 0,
}: PrepGeometryProps) {
  if (!visible || !showInsertionPath) return null;

  return (
    <group position={prepPosition} rotation={prepRotation} scale={prepScale}>
      {/* Insertion path arrow — rotated by azimuth/elevation, with ghost optimal */}
      <group position={[0, PREP_BASE_SCALE * 1.25, 0]}>
        {/* Ghost "optimal" arrow shown when vector deviates > 3° */}
        {(Math.abs(insertionAzimuth) > 3 || Math.abs(insertionElevation) > 3) && (
          <group>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[PREP_BASE_SCALE * 0.16, PREP_BASE_SCALE * 0.3, 8]} />
              <meshBasicMaterial color="#009ACE" transparent opacity={0.18} depthWrite={false} />
            </mesh>
            <mesh position={[0, PREP_BASE_SCALE * 0.25, 0]}>
              <cylinderGeometry args={[PREP_BASE_SCALE * 0.05, PREP_BASE_SCALE * 0.05, PREP_BASE_SCALE * 0.8]} />
              <meshBasicMaterial color="#009ACE" transparent opacity={0.14} depthWrite={false} />
            </mesh>
          </group>
        )}
        {/* Active insertion vector — tilted per azimuth and elevation */}
        <group
          rotation={[
            -(insertionElevation * Math.PI) / 180,
            0,
            -(insertionAzimuth * Math.PI) / 180,
          ]}
        >
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[PREP_BASE_SCALE * 0.16, PREP_BASE_SCALE * 0.3, 8]} />
            <meshBasicMaterial color="#009ACE" />
          </mesh>
          <mesh position={[0, PREP_BASE_SCALE * 0.25, 0]}>
            <cylinderGeometry args={[PREP_BASE_SCALE * 0.05, PREP_BASE_SCALE * 0.05, PREP_BASE_SCALE * 0.8]} />
            <meshBasicMaterial color="#009ACE" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
