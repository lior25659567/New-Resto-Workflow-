import { Suspense, useState } from 'react';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import JawMesh from './JawMesh';
import JawControls from './JawControls';
import OcclusogramHeatmapOverlay from './OcclusogramHeatmapOverlay';
import { jawModels, jawTextures } from './jawModelPaths';
import hdrUrl from '@/assets/lebombo_1k.hdr?url';

interface LayerState {
  upper: number;
  lower: number;
  upperVisible: boolean;
  lowerVisible: boolean;
}

interface JawModelSceneProps {
  selectedView: number;
  layerStates: {
    pretreatment?: LayerState;
    treatment?: LayerState;
    additional?: LayerState;
  };
  isToolActive: boolean;
  isPrepQCActive: boolean;
  isTrimActive: boolean;
  trimSelectedLayer: 'pre-treatment' | 'treatment';
  monochrome?: boolean;
  isOcclusogramActive?: boolean;
  bothUpperPos?: [number, number, number];
  bothLowerPos?: [number, number, number];
  singleUpperPos?: [number, number, number];
}

const SCALE = 0.055;

const UPPER_ROT: [number, number, number] = [0.1, -0.4, 0];
const LOWER_ROT: [number, number, number] = [0, -0.4, 0];

export const DEFAULT_BOTH_UPPER_POS: [number, number, number] = [-0.35, -0.10, 0.75];
export const DEFAULT_BOTH_LOWER_POS: [number, number, number] = [0.25, 0.00, -0.40];
const SINGLE_POS: [number, number, number] = [0, 0, 0];

export default function JawModelScene({
  selectedView,
  layerStates,
  isToolActive,
  isPrepQCActive,
  isTrimActive,
  trimSelectedLayer,
  monochrome = false,
  isOcclusogramActive = false,
  bothUpperPos = DEFAULT_BOTH_UPPER_POS,
  bothLowerPos = DEFAULT_BOTH_LOWER_POS,
  singleUpperPos = SINGLE_POS,
}: JawModelSceneProps) {
  const isBoth   = selectedView === 2;
  const showUpper = selectedView === 0 || isBoth;
  const showLower = selectedView === 1 || isBoth;

  function getLayerProps(layer: 'pretreatment' | 'treatment', jaw: 'upper' | 'lower') {
    const state = layerStates[layer];
    if (!state) return { opacity: 0, visible: false };
    const isVisible = jaw === 'upper' ? state.upperVisible : state.lowerVisible;
    const sliderOpacity = (jaw === 'upper' ? state.upper : state.lower) / 100;
    if (!isVisible) return { opacity: 0, visible: false };
    if (isToolActive && !isPrepQCActive && !isTrimActive) {
      return layer === 'treatment'
        ? { opacity: 1, visible: true }
        : { opacity: 0, visible: false };
    }
    if (isTrimActive) {
      const trimLayer = trimSelectedLayer === 'pre-treatment' ? 'pretreatment' : 'treatment';
      return layer === trimLayer
        ? { opacity: 1, visible: true }
        : { opacity: 0, visible: false };
    }
    return { opacity: sliderOpacity, visible: sliderOpacity > 0 };
  }

  const uPre = getLayerProps('pretreatment', 'upper');
  const uTrt = getLayerProps('treatment', 'upper');
  const lPre = getLayerProps('pretreatment', 'lower');
  const lTrt = getLayerProps('treatment', 'lower');

  // Combine view visibility with layer visibility — keeps all components mounted for instant switching
  const uTrtVisible = showUpper && uTrt.visible;
  const uPreVisible = showUpper && uPre.visible;
  const lTrtVisible = showLower && lTrt.visible;
  const lPreVisible = showLower && lPre.visible;

  const upperPos = isBoth ? bothUpperPos : singleUpperPos;
  const lowerPos = isBoth ? bothLowerPos : SINGLE_POS;

  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} castShadow color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#f0f5ff" />
      <directionalLight position={[0, -3, 5]} intensity={0.3} />
      <directionalLight position={[0, 5, -5]} intensity={0.2} />
      <pointLight position={[0, 10, 0]} intensity={0.2} color="#ffffff" />
      <pointLight position={[3, 0, 3]} intensity={0.15} color="#e6f0ff" />
      <Environment files={hdrUrl} background={false} />

      {/* Wrapping group lets the optional transform gizmo attach to the whole jaw assembly */}
      <group ref={setModelGroup}>
        {/* Upper jaw — always mounted; position shifts for both-view */}
        <group position={upperPos}>
          <JawMesh url={jawModels.upper_treatment}    textureUrl={jawTextures.upper_treatment}    opacity={uTrt.opacity} visible={uTrtVisible} rotation={UPPER_ROT} scale={SCALE} monochrome={monochrome} />
          <JawMesh url={jawModels.upper_pretreatment} textureUrl={jawTextures.upper_pretreatment} opacity={uPre.opacity} visible={uPreVisible} rotation={UPPER_ROT} scale={SCALE} monochrome={monochrome} />
          <Suspense fallback={null}>
            <OcclusogramHeatmapOverlay url={jawModels.upper_treatment} textureUrl={jawTextures.upper_treatment} jawType="upper" rotation={UPPER_ROT} scale={SCALE} active={isOcclusogramActive && showUpper} />
          </Suspense>
        </group>

        {/* Lower jaw — always mounted; position shifts for both-view */}
        <group position={lowerPos}>
          <JawMesh url={jawModels.lower_treatment}    textureUrl={jawTextures.lower_treatment}    opacity={lTrt.opacity} visible={lTrtVisible} rotation={LOWER_ROT} scale={SCALE} monochrome={monochrome} />
          <JawMesh url={jawModels.lower_pretreatment} textureUrl={jawTextures.lower_pretreatment} opacity={lPre.opacity} visible={lPreVisible} rotation={LOWER_ROT} scale={SCALE} monochrome={monochrome} />
          <Suspense fallback={null}>
            <OcclusogramHeatmapOverlay url={jawModels.lower_treatment} textureUrl={jawTextures.lower_treatment} jawType="lower" rotation={LOWER_ROT} scale={SCALE} active={isOcclusogramActive && showLower} />
          </Suspense>
        </group>
      </group>

      <JawControls gizmoTarget={modelGroup} autoFit={false} />
    </>
  );
}
