import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TreeLayout } from "../../../lib/treeLayout3d";
import { isAlive } from "../../../types";
import { glowTexture } from "./textures";
import type { Quality } from "./constants";
import { withWind } from "./wind";

/** Quầng sáng mềm quanh mỗi đốm (vàng cho tiền nhân, xanh ngọc cho người sống) + lớp "lá sáng" lấp lánh trên tán */
export default function Glow({
  layout,
  highlightIds,
  quality,
  growth,
  reduced,
}: {
  layout: TreeLayout;
  highlightIds: Set<string>;
  quality: Quality;
  growth: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  const warm = useMemo(() => glowTexture("warm"), []);
  const heartRef = useRef<THREE.SpriteMaterial>(null);
  const heart = useMemo(() => layout.nodes.find((n) => n.isRoot), [layout]);
  const cool = useMemo(() => glowTexture("cool"), []);
  const normalRef = useRef<THREE.PointsMaterial>(null);
  const aliveRef = useRef<THREE.PointsMaterial>(null);
  const hiRef = useRef<THREE.PointsMaterial>(null);
  const leafRef = useRef<THREE.PointsMaterial>(null);

  const { normal, alive, hi } = useMemo(() => {
    const n: number[] = [];
    const a: number[] = [];
    const h: number[] = [];
    for (const node of layout.nodes) {
      const target = highlightIds.has(node.member.id) ? h : isAlive(node.member) ? a : n;
      target.push(node.position[0], node.position[1] - (isAlive(node.member) ? 0.55 : 0), node.position[2]);
    }
    return { normal: new Float32Array(n), alive: new Float32Array(a), hi: new Float32Array(h) };
  }, [layout, highlightIds]);

  const leaves = useMemo(() => {
    const per = quality === "high" ? 16 : 7;
    const pos: number[] = [];
    const col: number[] = [];
    const warmPalette = ["#ffd27a", "#ffb347", "#fff1c2", "#f6c35b", "#ffcf9e"].map((c) => new THREE.Color(c));
    const coolPalette = ["#9dffd0", "#c4ffe3", "#7ff0b8"].map((c) => new THREE.Color(c));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const node of layout.nodes) {
      if (node.member.generation - layout.minGen < 3) continue;
      const palette = isAlive(node.member) ? coolPalette : warmPalette;
      for (let i = 0; i < per; i++) {
        const u = rnd() * Math.PI * 2;
        const v = Math.acos(2 * rnd() - 1);
        const r = 0.25 + rnd() * 0.8;
        pos.push(
          node.position[0] + Math.sin(v) * Math.cos(u) * r,
          node.position[1] + Math.abs(Math.cos(v)) * r * 0.8 + 0.1,
          node.position[2] + Math.sin(v) * Math.sin(u) * r
        );
        const c = palette[Math.floor(rnd() * palette.length)];
        col.push(c.r, c.g, c.b);
      }
    }
    return { pos: new Float32Array(pos), col: new Float32Array(col) };
  }, [layout, quality]);

  useFrame((state) => {
    const g = growth.current;
    const t = state.clock.elapsedTime;
    if (normalRef.current) normalRef.current.opacity = 0.42 * g;
    if (heartRef.current) heartRef.current.opacity = 0.55 * g * (reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 0.9));
    if (aliveRef.current) aliveRef.current.opacity = 0.6 * g * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 1.6));
    if (hiRef.current) hiRef.current.opacity = 0.9 * g * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2));
    if (leafRef.current) {
      leafRef.current.opacity = Math.max(0, g - 0.35) * 1.4 * (reduced ? 0.8 : 0.7 + 0.3 * Math.sin(t * 0.9));
      leafRef.current.size = reduced ? 0.32 : 0.3 + 0.07 * Math.sin(t * 1.3);
    }
  });

  // Vật liệu điểm sáng có gió (cùng trường dịch chuyển với cành và đèn lá để quầng sáng bám theo)
  const mats = useMemo(() => {
    const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true, opacity: 0 };
    return {
      normal: withWind(new THREE.PointsMaterial({ ...common, map: warm, size: 2.6, color: "#ffb84d" })),
      alive: withWind(new THREE.PointsMaterial({ ...common, map: cool, size: 3.4, color: "#8af5c4" }), 0.12),
      hi: withWind(new THREE.PointsMaterial({ ...common, map: warm, size: 6, color: "#ffe2a0" })),
      leaf: withWind(new THREE.PointsMaterial({ ...common, map: warm, size: 0.1, vertexColors: true }), 0.08),
    };
  }, [warm, cool]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  normalRef.current = mats.normal;
  aliveRef.current = mats.alive;
  hiRef.current = mats.hi;
  leafRef.current = mats.leaf;

  return (
    <>
      {heart && (
        <sprite position={[heart.position[0], heart.position[1] + 0.3, heart.position[2]]} scale={layout.trunk.topRadius * 5.2} renderOrder={3}>
          <spriteMaterial ref={heartRef} map={warm} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} color="#ffb850" opacity={0} />
        </sprite>
      )}
      <points key={`n${normal.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[normal, 3]} />
        </bufferGeometry>
        <primitive object={mats.normal} attach="material" />
      </points>
      {alive.length > 0 && (
        <points key={`a${alive.length}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[alive, 3]} />
          </bufferGeometry>
          <primitive object={mats.alive} attach="material" />
        </points>
      )}
      {hi.length > 0 && (
        <points key={`h${hi.length}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[hi, 3]} />
          </bufferGeometry>
          <primitive object={mats.hi} attach="material" />
        </points>
      )}
      <points key={`l${leaves.pos.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[leaves.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[leaves.col, 3]} />
        </bufferGeometry>
        <primitive object={mats.leaf} attach="material" />
      </points>
    </>
  );
}
