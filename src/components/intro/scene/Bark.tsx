import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TreeLayout, LayoutChain } from "../../../lib/treeLayout3d";
import { makeBarkMaterial } from "./shaders";
import { barkTextures } from "./textures";
import type { Quality } from "./constants";

/** Chiều dài (đơn vị thế giới) của một ô vỏ cây lặp */
const TEX_LEN = 1.1;

/** Phân số chiều dài (xấp xỉ theo dây cung) tại từng điểm điều khiển của chuỗi */
function fractions(pts: THREE.Vector3[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = acc[acc.length - 1] || 1;
  return acc.map((a) => a / total);
}

/** Nội suy mềm giữa các giá trị cho tại từng điểm điều khiển theo phân số chiều dài */
function sample(fr: number[], vals: number[], t: number): number {
  if (t <= 0) return vals[0];
  let i = 1;
  while (i < fr.length - 1 && fr[i] < t) i++;
  const a = fr[i - 1];
  const b = fr[i];
  const u = b > a ? Math.min(1, (t - a) / (b - a)) : 1;
  const s = u * u * (3 - 2 * u);
  return vals[i - 1] + (vals[i] - vals[i - 1]) * s;
}

/**
 * Một chuỗi gỗ thành một ống liền: bán kính và đời nội suy theo chiều dài, uv tỉ lệ với kích thước thật
 * để vân vỏ đều nhau trên thân to lẫn cành nhỏ; thân và rễ bạnh có gờ dọc gồ ghề.
 */
function chainTube(chain: LayoutChain, quality: Quality): THREE.BufferGeometry {
  const hi = quality === "high";
  const pts = chain.points.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const fr = fractions(pts);
  const length = curve.getLength();
  const sorted = [...chain.radii].sort((a, b) => b - a);
  const thick = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const avgR = thick.reduce((s, r) => s + r, 0) / thick.length;
  const maxR = sorted[0];
  // Twig (hơn 1.000 ống ngắn, mảnh): ít phân đoạn nhất có thể, vẫn gộp chung một mesh
  const twig = chain.kind === "twig";
  const tubular = THREE.MathUtils.clamp(Math.round(length * (hi ? 6 : 4) + (maxR > 0.6 ? 12 : 0)), twig ? (hi ? 5 : 4) : 6, 240);
  const radial = twig ? (hi ? 6 : 5) : maxR > 0.6 ? (hi ? 24 : 14) : maxR > 0.25 ? (hi ? 12 : 8) : hi ? 8 : 6;
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const gen = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  const around = Math.max(1, Math.round((2 * Math.PI * avgR) / TEX_LEN));
  const along = length / TEX_LEN;
  const uOff = (chain.id.length * 0.37) % 1;
  // Gờ vỏ dọc thân và rễ bạnh, xoắn rất chậm theo chiều dài (vỏ sồi già) chứ không vặn xoáy
  const gnarl = chain.kind === "trunk" || chain.kind === "root" ? 0.06 : 0;
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const center = curve.getPointAt(t);
    const r = sample(fr, chain.radii, t);
    const g = sample(fr, chain.gens, t);
    const twist = t * length * 0.1;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      let rr = r;
      if (gnarl && r > 0.4) {
        const ang = (j / radial) * Math.PI * 2;
        rr *= 1 + gnarl * (0.55 * Math.sin(5 * ang + twist) + 0.45 * Math.sin(9 * ang - twist * 1.4 + 1.3));
      }
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(rr).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
      uv.setXY(idx, t * along + uOff, (j / radial) * around);
      gen[idx] = g;
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.setAttribute("aGen", new THREE.BufferAttribute(gen, 1));
  geo.computeVertexNormals();
  return geo;
}

/** Thân, cành và rễ: các chuỗi gỗ liền mạch ghép thành một khối, đầu ống bịt bằng nắp cầu nhỏ, mọc dần theo đời */
export default function Bark({ layout, growth, quality }: { layout: TreeLayout; growth: React.MutableRefObject<number>; quality: Quality }) {
  const uniforms = useMemo(() => ({ time: { value: 0 }, visibleGen: { value: 999 } }), []);
  const textures = useMemo(barkTextures, []);
  const material = useMemo(() => makeBarkMaterial(uniforms, textures), [uniforms, textures]);

  const geometry = useMemo(() => {
    const parts = layout.chains.map((c) => chainTube(c, quality));
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [layout, quality]);

  // Nắp tròn ở hai đầu mọi chuỗi: ngọn thon kín, gốc cành con tròn trịa như cổ cành chứ không lộ mặt cắt.
  // Twig không nắp: gốc nằm trong gỗ cha, ngọn bị viên ngọc / đỉnh cuống lá che; nhờ vậy số nắp không tăng theo số người.
  const caps = useMemo(() => {
    const list: { pos: [number, number, number]; r: number; gen: number }[] = [];
    for (const c of layout.chains) {
      if (c.kind === "twig") continue;
      const n = c.points.length - 1;
      list.push({ pos: c.points[n], r: c.radii[n], gen: c.gens[n] });
      list.push({ pos: c.points[0], r: c.radii[0] * (c.startInside ? 1.02 : 1), gen: c.gens[0] });
    }
    return list;
  }, [layout]);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const capGeo = useMemo(() => new THREE.SphereGeometry(1, quality === "high" ? 12 : 8, quality === "high" ? 10 : 6), [quality]);
  const m = useMemo(() => new THREE.Matrix4(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      material.dispose();
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.height.dispose();
    },
    [material, textures]
  );

  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    const span = layout.maxGen - layout.minGen + 1;
    const visibleGen = layout.minGen - 1 + growth.current * span;
    uniforms.visibleGen.value = growth.current >= 1 ? 999 : visibleGen + 0.5;
    const mesh = capRef.current;
    if (!mesh) return;
    caps.forEach((c, i) => {
      const r = c.gen <= visibleGen + 0.5 || growth.current >= 1 ? c.r : 0;
      m.makeScale(r, r, r).setPosition(c.pos[0], c.pos[1], c.pos[2]);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={geometry} material={material} />
      {caps.length > 0 && <instancedMesh key={`c${caps.length}`} ref={capRef} args={[capGeo, material, caps.length]} frustumCulled={false} />}
    </>
  );
}
