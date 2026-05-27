---
name: 3d-jaw
description: "Canonical settings and reference for all 3D jaw model viewers in this project — camera position, OrbitControls config, model scale/rotation, undo clipping, useFrame patterns, and how to adjust movement feel. Use when touching JawPlyViewer, JawModelScene, JawControls, MultiLayerView Canvas, or any R3F jaw scene."
---

# 3D Model Movement — iTero Jaw Viewer Skill

This skill covers the canonical movement settings used across all jaw viewers in this project, how the interactive jaw model works, how to adjust feel, and the technical reference for `useFrame` and `OrbitControls`.

---

## Canonical Settings (apply to every jaw viewer)

### Canvas / Camera

```tsx
<Canvas
  camera={{ position: [0, -2, 4.5], fov: 40, near: 0.01, far: 1000, up: [0, 1, 0] }}
  gl={{
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 0.7,
    localClippingEnabled: true,  // required when any material uses clippingPlanes
  }}
  dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
  style={{ touchAction: 'none' }}  // prevents page scroll while dragging
>
```

### Model Scale & Rotation

```tsx
<mesh geometry={centeredGeometry} scale={0.035} rotation={[Math.PI * 0.6, 0, Math.PI]} />
```

| Value | Purpose |
|-------|---------|
| `scale={0.035}` | PLY units are large; fits the arch inside the default camera frame |
| `rotation={[Math.PI * 0.6, 0, Math.PI]}` | Tilts jaw into the familiar chair-side occlusal angle |
| `geometry.center()` (in loader) | Centers vertices so the arch sits on the orbit target `[0,0,0]` |

### OrbitControls

```tsx
import { OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

const orbitRef = useRef<any>(null);

// REQUIRED when enableDamping={true} — drives the inertia animation each frame
useFrame(() => { orbitRef.current?.update(); });

<OrbitControls
  ref={orbitRef}
  makeDefault
  enableDamping
  dampingFactor={0.08}        // lower = more glide; higher = snappier stop
  rotateSpeed={1.5}
  zoomSpeed={1.2}
  panSpeed={1.2}
  enablePan={true}
  enableRotate={true}
  enableZoom={true}
  minDistance={0.5}
  maxDistance={10}
  minPolarAngle={0.1}         // prevents flipping completely under the arch
  maxPolarAngle={Math.PI - 0.1}
  target={[0, 0, 0]}
/>
```

| Input | Effect |
|-------|--------|
| Left drag | Rotate (orbit around the arch) |
| Right drag | Pan |
| Scroll / pinch | Zoom in/out |

---

## File Map (this project)

| File | Role |
|------|------|
| `src/components/jaw-viewer/JawControls.tsx` | OrbitControls wrapper — all movement feel |
| `src/components/jaw-viewer/JawPlyViewer.tsx` | Standalone undo-tool viewer (Canvas + lights + JawControls) |
| `src/components/jaw-viewer/JawModelScene.tsx` | Multi-jaw scene for View page (Canvas-less — used inside MultiLayerView) |
| `src/components/jaw-viewer/JawMesh.tsx` | Single jaw mesh with material/opacity |
| `src/flow/MultiLayerView.tsx` | View page — owns the Canvas that wraps JawModelScene |
| `src/components/scan-guidance/ScanGuidanceViewer.tsx` | Scan guidance — separate Canvas, mouse-follow rotation, coverage tracking |

---

## 1. Where the model lives

```
MultiLayerView.tsx                         <- owns the Canvas
 +-- JawModelScene                         <- multi-jaw scene with layers
       +-- JawMesh (upper treatment)
       +-- JawMesh (upper pre-treatment)
       +-- JawMesh (lower treatment)
       +-- JawMesh (lower pre-treatment)

JawPlyViewer.tsx (undo tool)               <- its own Canvas
 +-- SceneContent
       +-- ClippedPlyMesh / PlyMesh        <- single jaw, clipped for undo steps
```

All four jaw meshes in JawModelScene are **always mounted**. Visibility is toggled by props, so switching upper/lower/both is instant with no reload.

---

## 2. What moves

| Kind | What moves | How you trigger it |
|------|------------|-------------------|
| Orbit / zoom / pan | Camera | Mouse / trackpad on the model |
| Margin line zoom | Camera position (animated) | View toolbar - Margin Line button |
| Undo clip | Clip plane constant | Undo/redo in undo panel |

No idle sway on PLY jaw models. Mouse-follow rotation only exists in `ScanGuidanceViewer`.

---

## 3. Margin Line Zoom (View page)

On View, Margin Line animates the camera closer without disabling orbit afterward.

```
Default position:  [0, -2, 4.5]
Zoomed position:   [0, -1.2, 2.5]
Duration:          300ms ease-out cubic
```

OrbitControls resumes normally from the new position after the animation.

---

## 4. Undo Tool Clipping (JawPlyViewer)

The undo panel progressively clips the jaw model to reveal scan layers.

- `TOTAL_STEPS = 10` — 9 active cut steps + full reveal
- Clip plane normal `(0, 0, -1)` in **world space** — clips from the front edges inward ("trim from edges" effect)
- World-space Z bounds computed via `THREE.Box3.setFromObject(mesh)` on the first frame, after `mesh.updateWorldMatrix(true, false)`

```tsx
const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000));
const animatedConstant = useRef(1000);
const worldBounds = useRef<{ minZ: number; maxZ: number } | null>(null);

useFrame((_, delta) => {
  const mesh = meshRef.current;
  if (!mesh) return;

  if (!worldBounds.current) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    worldBounds.current = { minZ: box.min.z, maxZ: box.max.z };
    const init = getClipConstantForStep(revealStep, box.min.z, box.max.z);
    animatedConstant.current = init;
    clipPlaneRef.current.constant = init;
    return;
  }

  const { minZ, maxZ } = worldBounds.current;
  const target = getClipConstantForStep(revealStep, minZ, maxZ);
  const diff = target - animatedConstant.current;
  if (Math.abs(diff) > 0.001) {
    animatedConstant.current += diff * Math.min(4.0 * delta * 3, 1);
    clipPlaneRef.current.constant = animatedConstant.current;
  }
});
```

**Why world space, not local space?**
The mesh has `scale={0.035}`. PLY local Z range is ~+/-12mm, which becomes ~+/-0.42 world units. If you use raw local-space values as world-space clip plane constants, the constant (~35) far exceeds the world extent (~0.42) and nothing ever clips.

**Why `localClippingEnabled: true` is always set unconditionally?**
This flag is frozen at `Canvas` creation time. If it's conditional and evaluates to `false` on mount, clipping can never be enabled for that Canvas instance — even after re-renders.

---

## 5. Toolbar -> Model Behavior

| Toolbar button | Scan page | View page | Effect |
|----------------|-----------|-----------|--------|
| `0` | Monochrome | Monochrome | Gray `meshPhysicalMaterial` (no vertex colors) |
| `1` | Feedback | — | Blue vertex patches for missing scan area |
| `2` | — | Occlusogram | Heatmap overlay |
| `3` | Undo tool | Margin line | `revealStep` control / camera zoom |
| `4` | — | Prep QC | Heatmap variant |

---

## 6. Tech Stack

| Layer | Library |
|-------|---------|
| Engine | Three.js 0.170 |
| React | `@react-three/fiber` 8.18 (`Canvas`, `useFrame`, `useThree`) |
| Helpers | `@react-three/drei` 9.122 (`OrbitControls`, `Center`, `Environment`) |
| Loader | `PLYLoader` from `three-stdlib` |

```tsx
import upperJawUrl from '@/assets/3d-models/Upper Jaw .ply?url';
```

---

## `useFrame` Reference

`useFrame` runs a callback every render frame (~60 fps). Must be called inside a `<Canvas>` component.

```tsx
import { useFrame } from '@react-three/fiber';

useFrame((state, delta) => {
  // state.clock.elapsedTime — total seconds since scene start
  // delta — seconds since last frame (use for frame-rate-independent math)
  // state.camera, state.scene, state.gl, state.pointer — full R3F state

  meshRef.current.rotation.x += delta * 0.5; // frame-rate independent
});
```

**Rules:**
- Use `useRef` + direct mutation — **never** call `setState` inside `useFrame` (causes cascade re-renders and performance issues)
- Use `delta` for speeds — the same code runs correctly at 30 fps and 120 fps
- Use `state.clock.elapsedTime` for time-based oscillation (e.g. `Math.sin(elapsed * 0.2)`)
- The hook must be inside `<Canvas>` — calling it outside throws an error

**Damping update pattern (this project):**
```tsx
// OrbitControls with enableDamping requires .update() every frame
const orbitRef = useRef<any>(null);
useFrame(() => { orbitRef.current?.update(); });
```

---

## Full OrbitControls Props Reference

All props come from `three-stdlib/controls/OrbitControls`. Drei's `<OrbitControls>` wraps the same class and adds `makeDefault` and `onChange`.

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `enabled` | boolean | true | Master on/off for all interaction |
| `target` | Vector3 / [x,y,z] | [0,0,0] | Orbit pivot point |
| `minDistance` | number | 0 | Minimum zoom distance |
| `maxDistance` | number | Infinity | Maximum zoom distance |
| `minZoom` | number | 0 | (orthographic cameras only) |
| `maxZoom` | number | Infinity | (orthographic cameras only) |
| `minPolarAngle` | number (rad) | 0 | How far up you can rotate (0 = top) |
| `maxPolarAngle` | number (rad) | Math.PI | How far down (PI = bottom) |
| `minAzimuthAngle` | number (rad) | -Infinity | Left horizontal limit |
| `maxAzimuthAngle` | number (rad) | Infinity | Right horizontal limit |
| `enableDamping` | boolean | false | Smooth inertia after release — **needs `update()` each frame** |
| `dampingFactor` | number | 0.05 | Inertia amount (0.08 = smooth glide, 0.15 = snappy) |
| `enableZoom` | boolean | true | Scroll/pinch zoom |
| `zoomSpeed` | number | 1 | Zoom sensitivity |
| `enableRotate` | boolean | true | Left-drag rotate |
| `rotateSpeed` | number | 1 | Rotation sensitivity |
| `enablePan` | boolean | true | Right-drag pan |
| `panSpeed` | number | 1 | Pan sensitivity |
| `screenSpacePanning` | boolean | true | Pan in screen plane vs. horizontal ground plane |
| `autoRotate` | boolean | false | Idle spin |
| `autoRotateSpeed` | number | 2 | Idle spin speed |
| `reverseOrbit` | boolean | false | Inverts orbit direction |
| `reverseHorizontalOrbit` | boolean | false | Inverts horizontal orbit only |
| `reverseVerticalOrbit` | boolean | false | Inverts vertical orbit only |
| `zoomToCursor` | boolean | false | Zoom toward cursor instead of target |
| `makeDefault` | boolean | false | **(drei only)** Registers as `useThree().controls` |
| `onChange` | function | — | **(drei only)** Fires on every change event |

---

## Adjusting Movement Feel

| Goal | Change |
|------|--------|
| Faster orbit | Increase `rotateSpeed` (1.5 is current) |
| More inertia / glide | Decrease `dampingFactor` (try 0.04) |
| Snappier stop | Increase `dampingFactor` (try 0.15) |
| Zoom range | `minDistance` / `maxDistance` |
| Prevent flipping overhead | Tighten `minPolarAngle` toward `Math.PI / 2` |
| Change default framing | `camera.position` on `<Canvas>` |
| Change model angle | `rotation` on the mesh group |
| Fit a different size model | `scale` on the mesh |

---

## Adding a New Camera Move

1. Add a boolean prop on the scene component (e.g. `focusMode`).
2. Inside Canvas, add a `CameraController` that uses `useThree().camera` and a `useEffect` to lerp `camera.position`.
3. Wire the prop from toolbar state in the parent.

```tsx
function CameraController({ active }: { active: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const to = active ? [0, -1.2, 2.5] : [0, -2, 4.5];
    // lerp camera.position toward `to` over 300ms with requestAnimationFrame
  }, [active]);
  return null;
}
```

OrbitControls remains active after the animation — users can orbit from the new position.

---

## Appendix: Other 3D Pages (different viewers)

| Page | File | Movement style |
|------|------|----------------|
| Scan Guidance | `scan-guidance/ScanGuidanceViewer.tsx` | Orbit + mouse-follow rotation + scan coverage raycasting; camera at `[0, -1.5, 3.5]` |
| Prep Copilot | `prep-copilot/CopilotScene.tsx` + `useCopilotCamera.ts` | Orbit with animated camera presets per analysis view |

Do not copy patterns from these into the main jaw viewers — they are intentionally isolated.

---

## Further Reading

- [R3F useFrame docs](https://r3f.docs.pmnd.rs/tutorials/basic-animations)
- [drei OrbitControls](https://github.com/pmndrs/drei#controls)
- [three-stdlib OrbitControls source](https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts)
