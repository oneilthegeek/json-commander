"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { jarState } from "@/lib/jarState";

type Spice = {
  radius: number;
  angle: number;
  y: number;
  speed: number;
  bob: number;
  phase: number;
  spin: THREE.Vector3;
  scale: THREE.Vector3;
};

function makeSpices(count: number, shape: [number, number, number], size: [number, number]): Spice[] {
  return Array.from({ length: count }, () => {
    const s = size[0] + Math.random() * (size[1] - size[0]);
    return {
      radius: 1.35 + Math.random() * 1.6,
      angle: Math.random() * Math.PI * 2,
      y: -1.4 + Math.random() * 3.4,
      speed: (0.08 + Math.random() * 0.16) * (Math.random() > 0.5 ? 1 : 0.8),
      bob: 0.05 + Math.random() * 0.15,
      phase: Math.random() * Math.PI * 2,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2),
      scale: new THREE.Vector3(shape[0] * s, shape[1] * s, shape[2] * s),
    };
  });
}

function SpiceField({
  count,
  shape,
  size,
  geometry,
  material,
}: {
  count: number;
  shape: [number, number, number];
  size: [number, number];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spices = useMemo(() => makeSpices(count, shape, size), [count, shape, size]);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );

  useLayoutEffect(() => {
    ref.current!.frustumCulled = false;
  }, []);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const heat = jarState.heat;
    spices.forEach((sp, i) => {
      const a = sp.angle + t * sp.speed * (0.4 + heat);
      tmp.p.set(
        Math.cos(a) * sp.radius,
        sp.y + Math.sin(t * 0.7 + sp.phase) * sp.bob * 3,
        Math.sin(a) * sp.radius * 0.7,
      );
      tmp.e.set(t * sp.spin.x, t * sp.spin.y, t * sp.spin.z);
      tmp.q.setFromEuler(tmp.e);
      tmp.s.copy(sp.scale).multiplyScalar(0.3 + 0.7 * heat);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} />;
}

/** Chilli flakes, peppercorns and seeds orbiting the jar. */
export default function SpiceParticles({ density = 1 }: { density?: number }) {
  const geos = useMemo(
    () => ({
      flake: new THREE.DodecahedronGeometry(1, 0),
      corn: new THREE.IcosahedronGeometry(1, 2),
      seed: new THREE.SphereGeometry(1, 10, 8),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      flake: new THREE.MeshStandardMaterial({ color: "#d42a00", roughness: 0.55, emissive: "#3a0800" }),
      corn: new THREE.MeshStandardMaterial({ color: "#1a1210", roughness: 0.85 }),
      seed: new THREE.MeshStandardMaterial({ color: "#f2d48f", roughness: 0.45 }),
    }),
    [],
  );
  const flakeShape = useMemo<[number, number, number]>(() => [1.2, 0.18, 0.9], []);
  const cornShape = useMemo<[number, number, number]>(() => [1, 1, 1], []);
  const seedShape = useMemo<[number, number, number]>(() => [1, 0.3, 0.75], []);
  const s1 = useMemo<[number, number]>(() => [0.04, 0.09], []);
  const s2 = useMemo<[number, number]>(() => [0.025, 0.045], []);
  const s3 = useMemo<[number, number]>(() => [0.02, 0.035], []);

  return (
    <group>
      <SpiceField count={Math.round(46 * density)} shape={flakeShape} size={s1} geometry={geos.flake} material={mats.flake} />
      <SpiceField count={Math.round(30 * density)} shape={cornShape} size={s2} geometry={geos.corn} material={mats.corn} />
      <SpiceField count={Math.round(34 * density)} shape={seedShape} size={s3} geometry={geos.seed} material={mats.seed} />
    </group>
  );
}
