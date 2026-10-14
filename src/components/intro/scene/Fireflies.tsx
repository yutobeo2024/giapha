import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { makeFireflyMaterial } from "./shaders";

function makeAttributes(count: number, top: number, ground: number, spiral: boolean) {
  const positions = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  let s = spiral ? 31 : 17;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 1.5 + Math.pow(rnd(), 0.6) * 15;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = ground + rnd() * (top - ground + 5);
    positions[i * 3 + 2] = Math.sin(a) * r;
    seed[i * 3] = rnd();
    seed[i * 3 + 1] = rnd();
    seed[i * 3 + 2] = rnd();
    size[i] = spiral ? 0.1 + rnd() * 0.14 : 0.13 + Math.pow(rnd(), 1.6) * 0.3;
    phase[i] = rnd();
    speed[i] = 0.5 + rnd() * 0.9;
  }
  return { positions, seed, size, phase, speed };
}

function Swarm({ count, top, ground, reduced, spiral }: { count: number; top: number; ground: number; reduced: boolean; spiral: boolean }) {
  const attrs = useMemo(() => makeAttributes(count, top, ground, spiral), [count, top, ground, spiral]);
  const material = useMemo(
    () =>
      makeFireflyMaterial(
        spiral
          ? { spiral: true, colorA: new THREE.Color("#ffe3a6"), colorB: new THREE.Color("#b8ffd8") }
          : { spiral: false, colorA: new THREE.Color("#ffd27a"), colorB: new THREE.Color("#ecffb4") }
      ),
    [spiral]
  );
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const ref = useRef<THREE.Points>(null);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = reduced ? 40 : state.clock.elapsedTime;
    u.uGround.value = ground;
    u.uTop.value = top;
    u.uPixelRatio.value = (gl.getPixelRatio() * size.height) / 900;
  });

  return (
    <points ref={ref} material={material} frustumCulled={false}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[attrs.positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[attrs.seed, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[attrs.size, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[attrs.phase, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attrs.speed, 1]} />
      </bufferGeometry>
    </points>
  );
}

/** Đom đóm quanh cây + dòng đom đóm xoắn ốc bay lên theo thân */
export default function Fireflies({ count, spiralCount, top, ground, reduced }: { count: number; spiralCount: number; top: number; ground: number; reduced: boolean }) {
  return (
    <>
      <Swarm count={count} top={top} ground={ground} reduced={reduced} spiral={false} />
      <Swarm count={spiralCount} top={top} ground={ground} reduced={reduced} spiral />
    </>
  );
}
