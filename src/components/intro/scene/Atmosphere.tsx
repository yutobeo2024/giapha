import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import type { TreeLayout } from "../../../lib/treeLayout3d";
import { noiseTexture, sealTextures } from "./textures";
import { makeMistMaterial, makeShaftMaterial } from "./shaders";
import type { Quality } from "./constants";

/** Vòm trời: xanh đêm trên cao, tím ở giữa, đỏ trầm dưới chân, kèm dải sáng mờ ở đường chân trời */
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#070b1c") },
          mid: { value: new THREE.Color("#120c1d") },
          bottom: { value: new THREE.Color("#2b0b10") },
          glow: { value: new THREE.Color("#4a2a6a") },
        },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 glow; varying vec3 vPos;
          void main(){ float h = vPos.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bottom, smoothstep(0.0, 0.5, -h));
          c += glow * exp(-abs(h - 0.05) * 9.0) * 0.5;
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    []
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[150, 32, 16]} />
    </mesh>
  );
}

/** Ấn triện 阮 dưới gốc, vòng hoa văn xoay chậm, luôn hướng chân chữ về người xem */
function Seal({ y, reduced }: { y: number; reduced: boolean }) {
  const { ring, glyph } = useMemo(sealTextures, []);
  const ringRef = useRef<THREE.Mesh>(null);
  const faceRef = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!reduced && ringRef.current) ringRef.current.rotation.z += dt * 0.08;
    if (faceRef.current) faceRef.current.rotation.y = Math.atan2(state.camera.position.x, state.camera.position.z);
  });
  return (
    <group ref={faceRef} position={[0, y + 0.02, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <circleGeometry args={[12, 64]} />
          <meshBasicMaterial color="#1a0c10" transparent opacity={0.6} depthWrite={false} />
        </mesh>
        <mesh ref={ringRef} position={[0, 0, 0.01]}>
          <planeGeometry args={[9, 9]} />
          <meshBasicMaterial map={ring} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[5.4, 5.4]} />
          <meshBasicMaterial map={glyph} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Sương là đà trên mặt đất quanh rễ: vài lớp phẳng cuộn chậm, cộng sáng mờ */
function GroundMist({ y, quality, reduced }: { y: number; quality: Quality; reduced: boolean }) {
  const tex = useMemo(() => noiseTexture(), []);
  const layers = useMemo(() => {
    const specs: { dy: number; dir: [number, number]; color: string; opacity: number; size: number }[] = [
      { dy: 0.12, dir: [0.011, 0.006], color: "#7a4e5e", opacity: 0.34, size: 46 },
      { dy: 0.42, dir: [-0.008, 0.012], color: "#4e3f78", opacity: 0.24, size: 40 },
      { dy: 0.78, dir: [0.006, -0.01], color: "#6b4a52", opacity: 0.16, size: 36 },
    ];
    return (quality === "high" ? specs : specs.slice(0, 2)).map((s) => ({ ...s, mat: makeMistMaterial(tex, new THREE.Color(s.color), s.dir, s.opacity) }));
  }, [tex, quality]);
  useFrame((state) => {
    const t = reduced ? 12 : state.clock.elapsedTime;
    for (const l of layers) l.mat.uniforms.uTime.value = t;
  });
  return (
    <>
      {layers.map((l, i) => (
        <mesh key={i} material={l.mat} position={[0, y + l.dy, 0]} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 5]} renderOrder={2}>
          <planeGeometry args={[l.size, l.size]} />
        </mesh>
      ))}
    </>
  );
}

/** Tia sáng từ trời rọi xuống phía sau cây; nhóm luôn xoay theo camera nên lúc nào cũng thấy dải sáng chéo */
function LightShafts({ ground, top, reduced }: { ground: number; top: number; reduced: boolean }) {
  const faceRef = useRef<THREE.Group>(null);
  const mats = useMemo(() => [0, 1, 2].map((i) => makeShaftMaterial(new THREE.Color(i === 1 ? "#ffd9a0" : "#b9c6ff"))), []);
  const h = top - ground + 22;
  const cy = (top + ground) / 2 + 5;
  useFrame((state) => {
    if (faceRef.current) faceRef.current.rotation.y = Math.atan2(state.camera.position.x, state.camera.position.z);
    const t = reduced ? 0 : state.clock.elapsedTime;
    mats.forEach((m, i) => (m.uniforms.uOpacity.value = 0.075 + 0.035 * Math.sin(t * 0.23 + i * 2.1)));
  });
  const specs: { x: number; w: number; tilt: number }[] = [
    { x: -8.5, w: 5.5, tilt: 0.22 },
    { x: -1.5, w: 3.2, tilt: 0.12 },
    { x: 6.5, w: 6.5, tilt: -0.2 },
  ];
  return (
    <group ref={faceRef}>
      {specs.map((s, i) => (
        <mesh key={i} material={mats[i]} position={[s.x, cy, -9]} rotation={[0, 0, s.tilt]} renderOrder={1}>
          <planeGeometry args={[s.w, h]} />
        </mesh>
      ))}
    </group>
  );
}

/** Đèn cảnh: đèn "trái tim" ấm tại chỗ thân chia cành (phập phồng), đèn gốc, đèn viền xanh lam cho chiều sâu */
function SceneLights({ layout, reduced }: { layout: TreeLayout; reduced: boolean }) {
  const heart = useRef<THREE.PointLight>(null);
  const top = layout.heightOf(layout.maxGen);
  useFrame((state) => {
    if (heart.current) heart.current.intensity = reduced ? 70 : 70 + 12 * Math.sin(state.clock.elapsedTime * 1.1);
  });
  return (
    <>
      <ambientLight intensity={0.45} color="#ffd9a8" />
      <hemisphereLight args={["#7b8cff", "#6a2414", 0.6]} />
      <pointLight ref={heart} position={[0, layout.trunk.topY + 0.4, 0]} intensity={70} distance={30} decay={2} color="#ffb04a" />
      <pointLight position={[0, layout.groundY + 1.3, 0]} intensity={42} distance={16} decay={2} color="#ff9a3c" />
      <directionalLight position={[10, top + 8, 6]} intensity={0.85} color="#c9d4ff" />
      <directionalLight position={[-12, top * 0.5, -14]} intensity={0.55} color="#5a7bff" />
    </>
  );
}

export default function Atmosphere({ layout, quality, reduced }: { layout: TreeLayout; quality: Quality; reduced: boolean }) {
  const top = layout.heightOf(layout.maxGen);
  return (
    <>
      <SkyDome />
      <fogExp2 attach="fog" args={["#1a1020", 0.0085]} />
      <SceneLights layout={layout} reduced={reduced} />
      <Stars radius={110} depth={40} count={quality === "high" ? 2200 : 900} factor={3.2} saturation={0} fade speed={reduced ? 0 : 0.35} />
      <Seal y={layout.groundY} reduced={reduced} />
      <GroundMist y={layout.groundY} quality={quality} reduced={reduced} />
      <LightShafts ground={layout.groundY} top={top} reduced={reduced} />
    </>
  );
}
