"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { jarState } from "@/lib/jarState";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.22 + uSeed * 10.0;
    // sway the column sideways as it rises
    uv.x += (fbm(vec2(uv.y * 2.0 - t, uSeed)) - 0.5) * 0.55 * uv.y;
    float n = fbm(vec2(uv.x * 3.0, uv.y * 2.2 - t * 1.6));
    float wisps = smoothstep(0.32, 0.8, n);
    // narrow at the base, widen and fade with height
    float width = mix(0.16, 0.5, uv.y);
    float column = smoothstep(width, 0.0, abs(uv.x - 0.5));
    float fade = smoothstep(0.0, 0.18, uv.y) * smoothstep(1.0, 0.45, uv.y);
    float a = wisps * column * fade * uIntensity;
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.9), a * 0.5);
  }
`;

function Wisp({ seed, x, scale }: { seed: number; x: number; scale: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: 1 } }),
    [seed],
  );
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      mat.current.uniforms.uIntensity.value,
      jarState.heat,
      0.05,
    );
  });
  return (
    <mesh position={[x, scale * 0.5, 0]} scale={[scale * 0.7, scale, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Soft, procedural steam rising from the lid. Lives outside the jar's
 * rotating groups and follows an anchor, so the planes always face the
 * (fixed, front-on) camera instead of turning edge-on with the jar.
 */
export default function Steam({ anchor }: { anchor: React.RefObject<THREE.Object3D | null> }) {
  const group = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const a = anchor.current;
    const g = group.current;
    if (!a || !g) return;
    a.getWorldPosition(g.position);
    a.getWorldScale(tmp);
    g.scale.setScalar(tmp.x);
  });
  return (
    <group ref={group}>
      <Wisp seed={0.13} x={-0.14} scale={2.2} />
      <Wisp seed={0.57} x={0.16} scale={2.6} />
      <Wisp seed={0.91} x={0} scale={1.9} />
    </group>
  );
}
