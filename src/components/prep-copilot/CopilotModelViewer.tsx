import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import CopilotScene from './CopilotScene';

interface CopilotModelViewerProps {
  children?: React.ReactNode;
  disableRotate?: boolean;
}

export default function CopilotModelViewer({ children, disableRotate = false }: CopilotModelViewerProps) {
  return (
    <div className="relative w-full h-full min-h-0">
      <Canvas
        camera={{ position: [0, -2, 4.5], fov: 40, near: 0.01, far: 1000, up: [0, 1, 0] }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.7,
        }}
        style={{ width: '100%', height: '100%', background: '#d6e7f1', touchAction: 'none', cursor: disableRotate ? 'crosshair' : 'grab' }}
        dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
      >
        <Suspense fallback={null}>
          <CopilotScene disableRotate={disableRotate}>{children}</CopilotScene>
        </Suspense>
      </Canvas>
    </div>
  );
}
