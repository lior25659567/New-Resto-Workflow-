import '@react-three/fiber';
import { Suspense, useState } from 'react';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import JawMesh from './JawMesh';
import JawControls from './JawControls';
import OcclusogramHeatmapOverlay from './OcclusogramHeatmapOverlay';
import ToothHeatmapOverlay from './ToothHeatmapOverlay';
import ToothMarkers from './ToothMarkers';
import { jawModels } from './jawModelPaths';
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
  occlusogramSelectedLayer?: 'pre-treatment' | 'treatment' | 'additional';
  isPrepReductionActive?: boolean;
  bothUpperPos?: [number, number, number];
  bothLowerPos?: [number, number, number];
  singleUpperPos?: [number, number, number];
  showToothMarkers?: boolean;
}

const SCALE = 0.035;

const UPPER_ROT: [number, number, number] = [Math.PI * 0.6, 0, Math.PI];
const LOWER_ROT: [number, number, number] = [Math.PI * 0.6, Math.PI, Math.PI];

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
  occlusogramSelectedLayer = 'treatment',
  isPrepReductionActive = false,
  singleUpperPos = SINGLE_POS,
  showToothMarkers = false,
}: JawModelSceneProps) {
  const isBoth    = selectedView === 2;
  const showUpper = selectedView === 0;
  const showLower = selectedView === 1;

  function getLayerProps(layer: 'pretreatment' | 'treatment', jaw: 'upper' | 'lower') {
    const state = layerStates[layer];
    if (!state) return { opacity: 0, visible: false };
    const isVisible = jaw === 'upper' ? state.upperVisible : state.lowerVisible;
    const sliderOpacity = (jaw === 'upper' ? state.upper : state.lower) / 100;
    if (!isVisible) return { opacity: 0, visible: false };
    if (isOcclusogramActive) {
      const occLayer = occlusogramSelectedLayer === 'pre-treatment' ? 'pretreatment' : 'treatment';
      return layer === occLayer
        ? { opacity: 1, visible: true }
        : { opacity: 0, visible: false };
    }
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

  const upperPos = singleUpperPos;

  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

  // Generate heatmap data based on active tool
  const getHeatmapMode = () => {
    if (isOcclusogramActive) return 'occlusgram';
    if (isPrepReductionActive) return 'prep-reduction';
    return 'none';
  };

  const generateOcclusogramData = (jawType: 'upper' | 'lower') => {
    const data: Record<number, number> = {};
    const teeth = jawType === 'upper' ? 
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : 
      [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32];
    
    teeth.forEach(ada => {
      // Per-tooth presence flag (0–1.2 scale applied in overlay per vertex)
      data[ada] = 0.6 + Math.sin(ada * 0.5) * 0.1;
    });
    
    return data;
  };

  const generatePrepReductionData = (jawType: 'upper' | 'lower') => {
    const data: Record<number, number> = {};
    const teeth = jawType === 'upper' ? 
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : 
      [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32];
    
    teeth.forEach(ada => {
      // Simulate material reduction: varied by tooth position and type
      const isPosterior = (ada >= 1 && ada <= 5) || (ada >= 12 && ada <= 15) || 
                          (ada >= 17 && ada <= 21) || (ada >= 28 && ada <= 32);
      const baseReduction = isPosterior ? 1.2 : 0.8; // More reduction needed on posterior teeth
      const noise = (Math.sin(ada * 0.5 + 2.1) + Math.cos(ada * 0.3 + 1.8)) * 0.3;
      data[ada] = Math.max(0.3, Math.min(2.2, baseReduction + noise));
    });
    
    return data;
  };

  const heatmapMode = getHeatmapMode();

  const upperHeatmapData = heatmapMode === 'occlusgram' ?
    generateOcclusogramData('upper') :
    heatmapMode === 'prep-reduction' ?
    generatePrepReductionData('upper') : {};
  const lowerHeatmapData = heatmapMode === 'occlusgram' ?
    generateOcclusogramData('lower') :
    heatmapMode === 'prep-reduction' ?
    generatePrepReductionData('lower') : {};

  // Which PLY to use for occlusogram heatmap overlay based on selected layer
  const occUpperUrl = occlusogramSelectedLayer === 'pre-treatment'
    ? jawModels.upper_pretreatment
    : jawModels.upper_treatment;
  const occLowerUrl = occlusogramSelectedLayer === 'pre-treatment'
    ? jawModels.lower_pretreatment
    : jawModels.lower_treatment;

  return (
    <>
      <ambientLight intensity={0.22} color="#f8f5f2" />
      <directionalLight position={[4, 7, 5]} intensity={1.05} castShadow color="#fff8f2" />
      <directionalLight position={[-5, 3, 2]} intensity={0.45} color="#eaf0ff" />
      <directionalLight position={[0, -4, 4]} intensity={0.22} color="#fff0e8" />
      <directionalLight position={[0, 2, -5]} intensity={0.18} color="#f0f4ff" />
      <pointLight position={[0, 8, 0]} intensity={0.15} color="#ffffff" />
      <Environment files={hdrUrl} background={false} />

      <group ref={setModelGroup}>
        {/* Both arches — single combined model shown only in both-view */}
        <Suspense fallback={null}>
          <JawMesh url={jawModels.both_arches} opacity={1} visible={isBoth} rotation={LOWER_ROT} scale={SCALE} monochrome={monochrome} />
          {/* Heatmap overlay for both-arches model */}
          {heatmapMode !== 'none' && isBoth && (
            <ToothHeatmapOverlay
              url={jawModels.both_arches}
              jawType="bite"
              rotation={LOWER_ROT}
              scale={SCALE}
              active={true}
              mode={heatmapMode === 'occlusgram' ? 'occlusgram' : 'prep-reduction'}
              toothData={{ ...upperHeatmapData, ...lowerHeatmapData }}
              position={[0, 0, 0]}
              useBothTeeth
            />
          )}
        </Suspense>
        {/* Upper jaw — single-jaw view only */}
        <group position={upperPos}>
          <JawMesh url={jawModels.upper_treatment}    opacity={uTrt.opacity} visible={!isBoth && uTrtVisible} rotation={UPPER_ROT} scale={SCALE} monochrome={monochrome} />
          <JawMesh url={jawModels.upper_pretreatment} opacity={uPre.opacity} visible={!isBoth && uPreVisible} rotation={UPPER_ROT} scale={SCALE} monochrome={monochrome} />
          <Suspense fallback={null}>
            {/* Temporarily disabled to avoid conflicts with ToothHeatmapOverlay
            <OcclusogramHeatmapOverlay url={jawModels.upper_treatment} jawType="upper" rotation={UPPER_ROT} scale={SCALE} active={isOcclusogramActive && showUpper && !isBoth} />
            */}
          </Suspense>
          {/* Per-tooth heatmap overlay for active tools (single-jaw view only) */}
          {heatmapMode !== 'none' && showUpper && !isBoth && (
            <Suspense fallback={null}>
              <ToothHeatmapOverlay
                url={heatmapMode === 'occlusgram' ? occUpperUrl : jawModels.upper_treatment}
                jawType="lower"
                rotation={UPPER_ROT}
                scale={SCALE}
                active={true}
                mode={heatmapMode === 'occlusgram' ? 'occlusgram' : 'prep-reduction'}
                toothData={lowerHeatmapData}
                position={[0, 0, 0]}
              />
            </Suspense>
          )}
          {/* LOWER_TEETH derived from upper_treatment PLY (Lower.ply displayed as the upper slot) */}
          {(showUpper || isBoth) && showToothMarkers && (
            <Suspense fallback={null}>
              <ToothMarkers 
                plyUrl={jawModels.upper_treatment} 
                scale={SCALE} 
                rotation={UPPER_ROT} 
                jawType="lower" 
                visible
                heatmapMode={heatmapMode}
                toothHeatmapData={lowerHeatmapData}
              />
            </Suspense>
          )}
        </group>

        {/* Lower jaw — single-jaw view only */}
        <group position={SINGLE_POS}>
          <JawMesh url={jawModels.lower_treatment}    opacity={lTrt.opacity} visible={!isBoth && lTrtVisible} rotation={LOWER_ROT} scale={SCALE} monochrome={monochrome} />
          <JawMesh url={jawModels.lower_pretreatment} opacity={lPre.opacity} visible={!isBoth && lPreVisible} rotation={LOWER_ROT} scale={SCALE} monochrome={monochrome} />
          <Suspense fallback={null}>
            {/* Temporarily disabled to avoid conflicts with ToothHeatmapOverlay
            <OcclusogramHeatmapOverlay url={jawModels.lower_treatment} jawType="lower" rotation={LOWER_ROT} scale={SCALE} active={isOcclusogramActive && showLower && !isBoth} />
            */}
          </Suspense>
          {/* Per-tooth heatmap overlay for active tools (single-jaw view only) */}
          {heatmapMode !== 'none' && showLower && !isBoth && (
            <Suspense fallback={null}>
              <ToothHeatmapOverlay
                url={heatmapMode === 'occlusgram' ? occLowerUrl : jawModels.lower_treatment}
                jawType="upper"
                rotation={LOWER_ROT}
                scale={SCALE}
                active={true}
                mode={heatmapMode === 'occlusgram' ? 'occlusgram' : 'prep-reduction'}
                toothData={upperHeatmapData}
                position={[0, 0, 0]}
              />
            </Suspense>
          )}
          {/* lower_treatment = Upper.ply (model swap) → label ADA #1-15 (upper arch) */}
          {(showLower || isBoth) && showToothMarkers && (
            <Suspense fallback={null}>
              <ToothMarkers 
                plyUrl={jawModels.lower_treatment} 
                scale={SCALE} 
                rotation={LOWER_ROT} 
                jawType="upper" 
                visible
                heatmapMode={heatmapMode}
                toothHeatmapData={upperHeatmapData}
              />
            </Suspense>
          )}
        </group>
      </group>

      <JawControls gizmoTarget={modelGroup} />
    </>
  );
}
