import { useEffect, useRef, useState } from 'react';
import { OrbitControls, TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type GizmoMode = 'translate' | 'rotate' | 'scale' | null;

interface JawControlsProps {
  /**
   * Optional Object3D the move/rotate/scale gizmo attaches to.
   * G / R / S keys toggle the gizmo mode, Escape returns to plain orbit.
   * Leave null to disable the gizmo entirely.
   */
  gizmoTarget?: THREE.Object3D | null;
  /**
   * Whether to automatically fit the camera to the model bounds.
   * Set to false if the models are already positioned correctly.
   */
  autoFit?: boolean;
}

/**
 * Smooth, damped controls for the PLY jaw viewers.
 *
 * - OrbitControls with damping, screen-space pan, tuned speeds
 * - Orbit target locked to the live bounding-box center of the scene
 * - minDistance / maxDistance clamped to the bounding-sphere radius
 *   (so the camera can't clip inside the mesh or fly off into space)
 * - Cursor flips between `grab` and `grabbing` while dragging
 * - Sharp rendering on retina via setPixelRatio(devicePixelRatio)
 * - Optional TransformControls gizmo with G/R/S/Esc shortcuts; orbit
 *   is auto-disabled while the gizmo is being dragged.
 */
export default function JawControls({ gizmoTarget = null, autoFit = true }: JawControlsProps) {
  const orbitRef = useRef<any>(null);
  const tcRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const { scene, gl, camera } = useThree();
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>(null); // Hide gizmo
  const modelCenterRef = useRef<THREE.Vector3 | null>(null);
  const [isRightDragging, setIsRightDragging] = useState(false);
  const [isLeftDragging, setIsLeftDragging] = useState(false);
  const rightDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const leftDragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
  }, [gl]);

  useEffect(() => {
    const el = gl.domElement;
    const prev = el.style.cursor;
    el.style.cursor = 'grab';

    // Custom mouse handlers for model manipulation
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right mouse button - Z-axis rotation
        e.preventDefault();
        setIsRightDragging(true);
        rightDragStartRef.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = 'grabbing';
      } else if (e.button === 0 && (e.shiftKey || e.ctrlKey)) { // Left mouse + modifier - Y-axis movement
        e.preventDefault();
        setIsLeftDragging(true);
        leftDragStartRef.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      // Right-click: Z-axis rotation (blue ring behavior)
      if (isRightDragging && rightDragStartRef.current && gizmoTarget) {
        e.preventDefault();
        
        const deltaX = e.clientX - rightDragStartRef.current.x;
        
        // Rotate around Z-axis (blue ring behavior) - spin/roll rotation
        const rotationSpeed = 0.01;
        const rotation = deltaX * rotationSpeed;
        
        gizmoTarget.rotateZ(rotation);
        
        // Update the drag start position for continuous rotation
        rightDragStartRef.current = { x: e.clientX, y: e.clientY };
      }
      
      // Left-click + modifier: Y-axis movement (up/down)
      if (isLeftDragging && leftDragStartRef.current && gizmoTarget) {
        e.preventDefault();
        
        const deltaY = e.clientY - leftDragStartRef.current.y;
        
        // Move model up/down
        const moveSpeed = 0.01;
        const moveY = -deltaY * moveSpeed; // Negative because screen Y is flipped
        
        gizmoTarget.position.y += moveY;
        
        // Update the drag start position for continuous movement
        leftDragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        setIsRightDragging(false);
        rightDragStartRef.current = null;
        el.style.cursor = 'grab';
      } else if (e.button === 0) {
        setIsLeftDragging(false);
        leftDragStartRef.current = null;
        el.style.cursor = 'grab';
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu when right-clicking
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.style.cursor = prev;
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, isRightDragging, isLeftDragging, gizmoTarget]);

  useFrame(() => {
    const controls = orbitRef.current;
    if (!controls) return;

    // Call update() every frame for damping to work
    controls.update();

    // One-time setup of camera bounds - only if autoFit is enabled
    if (autoFit && !fittedRef.current) {
      const box = new THREE.Box3().setFromObject(scene);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        if (size.length() > 1e-3) {
          const center = box.getCenter(new THREE.Vector3());
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const radius = Math.max(sphere.radius, 1e-3);
          
          // Always set target to model center for consistent behavior
          controls.target.copy(center);
          controls.minDistance = radius * 0.3;
          controls.maxDistance = radius * 12;
          modelCenterRef.current = center.clone();
          fittedRef.current = true;
        }
      }
    } else if (!autoFit && !fittedRef.current) {
      // If autoFit is disabled, just mark as fitted to prevent auto-fitting
      fittedRef.current = true;
      const box = new THREE.Box3().setFromObject(scene);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        modelCenterRef.current = center.clone();
      }
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'g') setGizmoMode('translate');
      else if (k === 'r') setGizmoMode('rotate');
      else if (k === 's') setGizmoMode('scale');
      else if (k === 'escape') setGizmoMode('rotate'); // Default back to rotate gizmo
      else if (k === 'q') setGizmoMode(null); // Q to hide all gizmos
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;
    const onDragging = (event: { value: boolean }) => {
      const orbit = orbitRef.current;
      if (orbit) orbit.enabled = !event.value;
      gl.domElement.style.cursor = event.value ? 'grabbing' : 'grab';
    };
    tc.addEventListener('dragging-changed', onDragging);
    return () => tc.removeEventListener('dragging-changed', onDragging);
  }, [gizmoMode, gl]);

  const handleStart = () => {
    if (!isRightDragging && !isLeftDragging) {
      gl.domElement.style.cursor = 'grabbing';
    }
  };
  
  const handleEnd = () => {
    if (!isRightDragging && !isLeftDragging) {
      gl.domElement.style.cursor = 'grab';
    }
  };

  const gizmoActive = gizmoMode !== null && gizmoTarget !== null;

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        enablePan={false}
        enableRotate
        enableZoom
        enabled={!isRightDragging && !isLeftDragging}
        onStart={handleStart}
        onEnd={handleEnd}
      />
      
      {/* Hidden gizmo - no visible handles */}
    </>
  );
}
