"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import SauceJar from "./SauceJar";
import Steam from "./Steam";
import SpiceParticles from "./SpiceParticles";
import { jarState, pointer } from "@/lib/jarState";

const damp = THREE.MathUtils.damp;

/** Applies the scroll-driven pose + pointer parallax + idle spin to the jar. */
function JarRig({ quality, lidAnchor }: { quality: "high" | "low"; lidAnchor: React.RefObject<THREE.Object3D | null> }) {
  const outer = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useFrame((state, dt) => {
    const g = outer.current;
    const s = spin.current;
    if (!g || !s) return;
    // on portrait screens keep the jar centred and a touch smaller
    const portrait = viewport.aspect < 0.9;
    const xK = portrait ? 0.12 : Math.min(1, viewport.aspect / 1.6);
    const sK = portrait ? 0.62 : 1;
    const yOff = portrait ? -0.35 : 0;

    g.position.x = damp(g.position.x, jarState.x * xK + pointer.x * 0.12, 3.5, dt);
    g.position.y = damp(g.position.y, jarState.y + yOff + pointer.y * 0.08, 3.5, dt);
    g.position.z = damp(g.position.z, jarState.z, 3.5, dt);
    const sc = damp(g.scale.x, jarState.scale * sK, 3.5, dt);
    g.scale.setScalar(sc);
    g.rotation.x = damp(g.rotation.x, jarState.rotX - pointer.y * 0.18, 3, dt);
    g.rotation.z = damp(g.rotation.z, jarState.rotZ + pointer.x * 0.06, 3, dt);
    g.rotation.y = damp(g.rotation.y, jarState.rotY + pointer.x * 0.35, 3, dt);
    // slow idle turntable spin layered on top
    s.rotation.y += dt * 0.18;
  });

  return (
    <group ref={outer} position={[jarState.x, jarState.y, 0]}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35} floatingRange={[-0.06, 0.06]}>
        <group ref={spin}>
          <SauceJar quality={quality} />
          <object3D ref={lidAnchor} position={[0, 1.4, 0]} />
        </group>
      </Float>
      <SpiceParticles density={quality === "high" ? 1 : 0.6} />
      <Sparkles count={quality === "high" ? 60 : 30} scale={[4, 4, 3]} size={3.5} speed={0.5} color="#FF7A1A" opacity={0.9} noise={1.2} />
      <ContactShadows position={[0, -1.55, 0]} opacity={0.65} scale={6} blur={2.6} far={2.5} color="#000000" />
    </group>
  );
}

/** Key + rim lights that drift with the pointer and pulse with heat. */
function DynamicLights() {
  const key = useRef<THREE.SpotLight>(null);
  const rim = useRef<THREE.PointLight>(null);
  const fill = useRef<THREE.PointLight>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (key.current) {
      key.current.position.x = damp(key.current.position.x, 4 + pointer.x * 3, 2, dt);
      key.current.position.y = damp(key.current.position.y, 5 + pointer.y * 2, 2, dt);
      key.current.intensity = 90 * (0.75 + 0.25 * jarState.glow);
    }
    if (rim.current) {
      // gentle fire-like flicker on the orange rim
      const flicker = Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.1) * 0.05;
      rim.current.intensity = 26 * (0.6 + 0.4 * jarState.glow) * (1 + flicker);
    }
    if (fill.current) fill.current.position.x = damp(fill.current.position.x, -4 - pointer.x * 2, 2, dt);
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <spotLight ref={key} position={[4, 5, 5]} angle={0.45} penumbra={1} intensity={90} color="#fff1e0" />
      <pointLight ref={rim} position={[-2.5, 1.5, -2.5]} intensity={26} color="#ff5b00" distance={12} />
      <pointLight ref={fill} position={[-4, -1, 3]} intensity={6} color="#ffb070" distance={12} />
    </>
  );
}

/** Local studio environment built from light panels — no HDR download. */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#050403"]} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={4} color="#ffd2a8" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[1.2, 8, 1]} />
      <Lightformer form="rect" intensity={5} color="#ff6a00" position={[5, 0.5, -1]} rotation-y={-Math.PI / 2} scale={[1.5, 8, 1]} />
      <Lightformer form="ring" intensity={2} color="#ff8a3d" position={[0, 0, -6]} scale={4} />
      <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[2, -3, 4]} rotation-x={-Math.PI / 3} scale={[6, 1, 1]} />
    </Environment>
  );
}

function usePointer() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

export default function Scene() {
  usePointer();
  const lidAnchor = useRef<THREE.Object3D>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;
    if (coarse || lowCores) setQuality("low");
  }, []);

  return (
    <Canvas
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      camera={{ position: [0, 0, 9], fov: 30, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <DynamicLights />
        <JarRig quality={quality} lidAnchor={lidAnchor} />
        <Steam anchor={lidAnchor} />
      </Suspense>
    </Canvas>
  );
}
