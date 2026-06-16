import { useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Ghost → solid reveal driven by the per-vertex `aReveal` attribute painted by
 * the 3D surface brush (see useBrushReveal). Unscanned surface reads as a cooled,
 * translucent ghost; brushing fills it back to the full natural color.
 */
export default function RevealMaterial() {
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute float aReveal;
        varying float vReveal;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vReveal = aReveal;
        `
      );

      shader.fragmentShader = `
        varying float vReveal;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        float reveal = smoothstep(0.02, 0.6, vReveal);

        // Ghost (unscanned): same natural model, lightly cooled + translucent.
        vec3 ghostColor = mix(gl_FragColor.rgb, vec3(0.74, 0.82, 0.93), 0.30);
        // Solid (scanned): full natural color.
        vec3 solidColor = gl_FragColor.rgb;

        gl_FragColor.rgb = mix(ghostColor, solidColor, reveal);
        gl_FragColor.a = mix(0.55, 1.0, reveal);
        `
      );
    };

    mat.needsUpdate = true;
  }, []);

  return (
    <meshPhysicalMaterial
      ref={matRef}
      vertexColors={true}
      roughness={0.2}
      metalness={0.0}
      side={THREE.DoubleSide}
      clearcoat={0.5}
      clearcoatRoughness={0.12}
      reflectivity={0.45}
      envMapIntensity={1.0}
      ior={1.52}
      sheen={0.28}
      sheenRoughness={0.65}
      sheenColor={new THREE.Color(0xffeee6)}
      transparent={true}
      depthWrite={true}
    />
  );
}
