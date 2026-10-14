import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TreeLayout, LayoutBranch } from "../../../lib/treeLayout3d";
import { makeBarkMaterial } from "./shaders";
import type { Quality } from "./constants";

/** Số đoạn dọc/quanh ống theo loại gỗ và chất lượng */
function segmentsFor(b: LayoutBranch, quality: Quality): [number, number] {
  const hi = quality === "high";
  switch (b.kind) {
    case "trunk":
      return [40, hi ? 22 : 16];
    case "buttress":
      return [26, hi ? 13 : 9];
    case "rootlet":
      return [12, hi ? 8 : 6];
    case "aerial":
      return [16, hi ? 7 : 5];
    default:
      return [hi ? 22 : 14, hi ? 9 : 6];
  }
}

/** Bán kính theo vị trí dọc ống: thân loe mạnh ở gốc, rễ bạnh giữ to một đoạn rồi mới thon, cành thon nhanh ở đầu */
function radiusProfile(b: LayoutBranch, t: number): number {
  const { radiusStart: s, radiusEnd: e } = b;
  switch (b.kind) {
    case "trunk":
      return e + (s - e) * Math.pow(1 - t, 2.2);
    case "buttress":
      return THREE.MathUtils.lerp(s, e, Math.pow(t, 0.9));
    case "rootlet":
    case "aerial":
      return THREE.MathUtils.lerp(s, e, t);
    default:
      return THREE.MathUtils.lerp(s, e, Math.pow(t, 0.7));
  }
}

/** Ống cong thuôn dần; thân và rễ bạnh có gờ dọc gồ ghề như vỏ cây cổ thụ */
function taperedTube(b: LayoutBranch, quality: Quality): THREE.BufferGeometry {
  const [tubular, radial] = segmentsFor(b, quality);
  const curve = new THREE.CatmullRomCurve3(b.points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const gnarl = b.kind === "trunk" ? 0.1 : b.kind === "buttress" ? 0.14 : 0;
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const center = curve.getPointAt(t);
    const base = radiusProfile(b, t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      let r = base;
      if (gnarl) {
        const ang = (j / radial) * Math.PI * 2;
        const ridge = 0.55 * Math.sin(5 * ang + i * 0.23) + 0.45 * Math.sin(9 * ang - i * 0.37 + 1.3);
        r *= 1 + gnarl * ridge;
      }
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Thân, rễ, cành và mắt gỗ: một khối hình học ghép, hiệu ứng "mọc" bằng drawRange theo đời */
export default function Bark({ layout, growth, quality }: { layout: TreeLayout; growth: React.MutableRefObject<number>; quality: Quality }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const material = useMemo(() => makeBarkMaterial(time), [time]);

  const { geometry, countsByGen } = useMemo(() => {
    const all = [...layout.roots, ...layout.branches].sort((a, b) => a.generation - b.generation);
    const parts = all.map((b) => taperedTube(b, quality));
    const merged = mergeGeometries(parts, false)!;
    const countsByGen = new Map<number, number>();
    let acc = 0;
    all.forEach((b, i) => {
      acc += parts[i].index ? parts[i].index!.count : 0;
      countsByGen.set(b.generation, acc);
    });
    parts.forEach((p) => p.dispose());
    return { geometry: merged, countsByGen };
  }, [layout, quality]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const knots = useMemo(() => layout.nodes.filter((n) => n.woodRadius > 0), [layout]);
  const knotRef = useRef<THREE.InstancedMesh>(null);
  const knotGeo = useMemo(() => new THREE.SphereGeometry(1, quality === "high" ? 20 : 12, quality === "high" ? 16 : 10), [quality]);
  const m = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state) => {
    time.value = state.clock.elapsedTime;
    const span = layout.maxGen - layout.minGen + 1;
    const visibleGen = layout.minGen - 1 + growth.current * span;
    let count = 0;
    for (const [g, c] of countsByGen) if (g <= visibleGen + 0.5) count = Math.max(count, c);
    geometry.setDrawRange(0, growth.current >= 1 ? Infinity : count);

    const mesh = knotRef.current;
    if (!mesh) return;
    knots.forEach((n, i) => {
      const r = n.member.generation <= visibleGen + 0.5 ? n.woodRadius * 0.98 : 0;
      m.makeScale(r, r, r).setPosition(n.position[0], n.position[1], n.position[2]);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={geometry} material={material} />
      {knots.length > 0 && <instancedMesh key={`k${knots.length}`} ref={knotRef} args={[knotGeo, material, knots.length]} frustumCulled={false} />}
    </>
  );
}
