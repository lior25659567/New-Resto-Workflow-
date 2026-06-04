import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MarginLineOverlayProps {
  visible: boolean;
}

// Lower first molar crown prep margin — matches the PLY jaw model coordinates
// The margin sits at the cervical boundary of the prep tooth
const MOLAR_CENTER: [number, number, number] = [0.4, -0.08, -0.15];
const MOLAR_RADIUS_X = 0.082; // Mesial-distal spread (slightly wider)
const MOLAR_RADIUS_Z = 0.068; // Buccal-lingual spread

export default function MarginLineOverlay({ visible }: MarginLineOverlayProps) {
  const coreRef = useRef<THREE.Line>(null);
  const glowRef = useRef<THREE.Line>(null);
  const outerGlowRef = useRef<THREE.Line>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  const { geometry, totalPoints } = useMemo(() => {
    const cx = MOLAR_CENTER[0];
    const cy = MOLAR_CENTER[1];
    const cz = MOLAR_CENTER[2];

    const segments = 64;
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Anatomical margin — slightly irregular oval to mimic chamfer/shoulder
      const wobble = 1 + Math.sin(angle * 4) * 0.04 + Math.sin(angle * 2 + 0.8) * 0.025;
      // Small vertical undulation to follow the tooth's cervical contour
      const vy = Math.sin(angle * 2) * 0.008 + Math.sin(angle * 3 + 1.2) * 0.005;

      pts.push(new THREE.Vector3(
        cx + Math.cos(angle) * MOLAR_RADIUS_X * wobble,
        cy + vy,
        cz + Math.sin(angle) * MOLAR_RADIUS_Z * wobble,
      ));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return { geometry: geo, totalPoints: pts.length };
  }, []);

  useFrame(() => {
    if (!visible) {
      progressRef.current = 0;
      startTimeRef.current = null;
      if (coreRef.current) coreRef.current.geometry.setDrawRange(0, 0);
      if (glowRef.current) glowRef.current.geometry.setDrawRange(0, 0);
      if (outerGlowRef.current) outerGlowRef.current.geometry.setDrawRange(0, 0);
      return;
    }

    if (startTimeRef.current === null) startTimeRef.current = performance.now();
    const elapsed = performance.now() - startTimeRef.current;
    progressRef.current = Math.min(elapsed / 1200, 1);

    const count = Math.floor(progressRef.current * totalPoints);
    if (coreRef.current) coreRef.current.geometry.setDrawRange(0, count);
    if (glowRef.current) glowRef.current.geometry.setDrawRange(0, count);
    if (outerGlowRef.current) outerGlowRef.current.geometry.setDrawRange(0, count);
  });

  if (!geometry) return null;

  return (
    <group>
      {/* Outer soft glow */}
      <line ref={outerGlowRef as any} geometry={geometry}>
        <lineBasicMaterial color="#00C6FF" transparent opacity={0.15} linewidth={1} depthTest={false} />
      </line>
      {/* Mid glow */}
      <line ref={glowRef as any} geometry={geometry}>
        <lineBasicMaterial color="#00D8B0" transparent opacity={0.45} linewidth={1} depthTest={false} />
      </line>
      {/* Core line — crisp and solid */}
      <line ref={coreRef as any} geometry={geometry}>
        <lineBasicMaterial color="#00FFD0" transparent opacity={0.95} linewidth={1} depthTest={false} />
      </line>
    </group>
  );
}
