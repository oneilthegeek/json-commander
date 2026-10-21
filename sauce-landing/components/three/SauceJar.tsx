"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import { createJarGlassGeometry, createLidGeometry, createSauceGeometry, JAR } from "./geometry";
import { createLabelTexture, createLidTexture } from "./labelTexture";
import { flavorState } from "@/lib/jarState";

type Props = { quality: "high" | "low" };

export default function SauceJar({ quality }: Props) {
  const glassGeo = useMemo(createJarGlassGeometry, []);
  const sauceGeo = useMemo(() => createSauceGeometry(0.62), []);
  const lidGeo = useMemo(createLidGeometry, []);
  const labelTex = useMemo(createLabelTexture, []);
  const lidTex = useMemo(createLidTexture, []);

  const sauceMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const target = useMemo(() => new THREE.Color(flavorState.color), []);

  // chilli seeds + herb flecks suspended against the inside of the glass
  const flecks = useMemo(() => {
    const count = 160;
    const data: { pos: THREE.Vector3; rot: THREE.Euler; s: number; seed: boolean }[] = [];
    const r = JAR.radius - JAR.wall - 0.006;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = JAR.bottom + 0.12 + Math.random() * 1.55;
      data.push({
        pos: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r),
        rot: new THREE.Euler(Math.random() * 3, a, Math.random() * 3),
        s: 0.012 + Math.random() * 0.02,
        seed: Math.random() > 0.45,
      });
    }
    return data;
  }, []);
  const seedRef = useRef<THREE.InstancedMesh>(null);
  const flakeRef = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => flecks.filter((f) => f.seed), [flecks]);
  const flakes = useMemo(() => flecks.filter((f) => !f.seed), [flecks]);

  useLayoutEffect(() => {
    {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      [
        [seedRef.current, seeds, new THREE.Vector3(1, 0.35, 0.7)] as const,
        [flakeRef.current, flakes, new THREE.Vector3(1.4, 0.2, 1)] as const,
      ].forEach(([mesh, list, shape]) => {
        if (!mesh) return;
        list.forEach((f, i) => {
          q.setFromEuler(f.rot);
          m.compose(f.pos, q, shape.clone().multiplyScalar(f.s));
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }, [seeds, flakes]);

  useFrame((_, dt) => {
    if (!sauceMat.current) return;
    target.set(flavorState.color);
    sauceMat.current.color.lerp(target, 1 - Math.exp(-dt * 4));
    sauceMat.current.emissive.copy(sauceMat.current.color).multiplyScalar(0.18);
  });

  return (
    <group>
      {/* glass */}
      <mesh geometry={glassGeo} renderOrder={2}>
        {quality === "high" ? (
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.35}
            roughness={0.04}
            ior={1.5}
            chromaticAberration={0.06}
            anisotropicBlur={0.15}
            distortion={0.08}
            distortionScale={0.4}
            temporalDistortion={0.05}
            clearcoat={1}
            clearcoatRoughness={0.05}
            attenuationDistance={2.5}
            attenuationColor="#fff4ea"
            color="#ffffff"
            samples={6}
            resolution={768}
            backside
            backsideThickness={0.2}
          />
        ) : (
          <meshPhysicalMaterial
            transmission={1}
            thickness={0.35}
            roughness={0.05}
            ior={1.5}
            clearcoat={1}
            transparent
            opacity={0.9}
          />
        )}
      </mesh>

      {/* sauce */}
      <mesh geometry={sauceGeo} renderOrder={1}>
        <meshPhysicalMaterial
          ref={sauceMat}
          color={flavorState.color}
          roughness={0.32}
          clearcoat={1}
          clearcoatRoughness={0.15}
          sheen={0.6}
          sheenColor="#ff8a3d"
          sheenRoughness={0.4}
        />
      </mesh>

      <instancedMesh ref={seedRef} args={[undefined, undefined, seeds.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f3d9a0" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={flakeRef} args={[undefined, undefined, flakes.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3a0a02" roughness={0.6} />
      </instancedMesh>

      {/* wrap-around label with a gap so the sauce shows through the back */}
      <mesh position={[0, -0.27, 0]}>
        <cylinderGeometry
          args={[JAR.radius + 0.004, JAR.radius + 0.004, 1.05, 128, 1, true, -Math.PI * 0.85, Math.PI * 1.7]}
        />
        <meshStandardMaterial map={labelTex} roughness={0.75} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* knurled lid */}
      <mesh geometry={lidGeo}>
        <meshPhysicalMaterial
          color="#121212"
          metalness={0.95}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </mesh>
      <mesh position={[0, JAR.neckTop + 0.2 + 0.017, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[(JAR.neckRadius + 0.06) * 0.62, 64]} />
        <meshPhysicalMaterial map={lidTex} metalness={0.8} roughness={0.35} clearcoat={0.5} />
      </mesh>
    </group>
  );
}
