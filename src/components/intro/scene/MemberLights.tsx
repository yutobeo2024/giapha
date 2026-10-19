import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FamilyMember } from "../../../types";
import { isAlive } from "../../../types";
import type { TreeLayout, LayoutNode } from "../../../lib/treeLayout3d";
import { makeOrbMaterial, makeLeafMaterial, leafHalfWidth } from "./shaders";
import { GOLD, GOLD_HIGHLIGHT, JADE, JADE_HIGHLIGHT, easeOutCubic } from "./constants";
import { windOffset, windUniforms } from "./wind";

/** Chiều dài cuống lá (đơn vị hình lá, trước khi nhân tỉ lệ) */
const PETIOLE = 0.3;
/** Tỉ lệ đèn lá */
const LEAF_SCALE = 0.7;

/** Hình chiếc lá có cuống: viền theo leafHalfWidth (trùng với shader gân lá), ép mỏng, lòng lá hơi cong; cuống nối lên nút trên cành */
function leafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const N = 26;
  shape.moveTo(0, 0);
  for (let i = 1; i <= N; i++) shape.lineTo(leafHalfWidth(i / N), -i / N);
  for (let i = N - 1; i >= 1; i--) shape.lineTo(-leafHalfWidth(i / N), -i / N);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 1 });
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = Math.min(1, Math.max(0, -pos.getY(i)));
    pos.setZ(i, pos.getZ(i) - 0.45 * x * x + 0.12 * Math.sin(Math.PI * t));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.translate(0, 0, -0.025);
  // Cuống: ống mảnh từ nút (y = PETIOLE) xuống đầu lá (y = 0), hơi cong về phía trước
  const stem = new THREE.CylinderGeometry(0.022, 0.03, PETIOLE, 6, 3, false);
  stem.translate(0, PETIOLE / 2, 0);
  const sp = stem.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const t = sp.getY(i) / PETIOLE;
    sp.setZ(i, sp.getZ(i) + 0.05 * Math.sin(Math.PI * t));
  }
  const su = stem.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < su.count; i++) su.setXY(i, 0, 0.6);
  stem.computeVertexNormals();
  // ExtrudeGeometry không có chỉ mục, cuống phải bỏ chỉ mục thì mới ghép được
  const stemFlat = stem.toNonIndexed();
  const merged = mergeGeometries([geo, stemFlat], false) ?? geo.clone();
  geo.dispose();
  stem.dispose();
  stemFlat.dispose();
  // Dịch cả lá xuống một cuống: gốc instance (= nút trên cành = ngọn twig) trùng ĐỈNH cuống,
  // nên lá đính vào cành, phóng to chỉ xòe xuống dưới và lắc quanh chỗ đính như lá thật
  merged.translate(0, -PETIOLE, 0);
  return merged;
}

/** Vị trí tâm hình ảnh của một người (đèn lá treo thấp hơn nút một chút) */
export function visualCenter(n: LayoutNode): [number, number, number] {
  return isAlive(n.member) ? [n.position[0], n.position[1] - (PETIOLE + 0.5) * LEAF_SCALE, n.position[2]] : n.position;
}

interface Props {
  layout: TreeLayout;
  highlightIds: Set<string>;
  selectedId: string | null;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  onSelect: (m: FamilyMember | null) => void;
  growth: React.MutableRefObject<number>;
  reduced: boolean;
  quality: "high" | "low";
}

/** Đốm ngọc vàng cho tiền nhân, đèn lồng lá xanh ngọc cho người đang sống, vùng chạm chung và vòng sáng người được chọn */
export default function MemberLights({ layout, highlightIds, selectedId, hoverId, setHoverId, onSelect, growth, reduced, quality }: Props) {
  const nodes = layout.nodes;
  const orbNodes = useMemo(() => nodes.filter((n) => !isAlive(n.member)), [nodes]);
  const leafNodes = useMemo(() => nodes.filter((n) => isAlive(n.member)), [nodes]);
  const orbRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, quality === "high" ? 28 : 18, quality === "high" ? 20 : 14), [quality]);
  const leafGeo = useMemo(leafGeometry, []);
  const orbMaterial = useMemo(makeOrbMaterial, []);
  const leafMaterial = useMemo(makeLeafMaterial, []);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const phaseOf = (n: LayoutNode) => (n.member.id.length * 2.399 + n.member.generation) % (Math.PI * 2);

  useEffect(() => () => {
    orbMaterial.dispose();
    leafMaterial.dispose();
    leafGeo.dispose();
  }, [orbMaterial, leafMaterial, leafGeo]);

  const emphasis = (id: string) => (highlightIds.has(id) ? 1.6 : 1) * (id === selectedId || id === hoverId ? 1.35 : 1);

  /** Kích thước và vị trí đốm ngọc: nằm trên thân/cành to thì thành viên ngọc gắn trên vỏ, Thủy tổ là trái tim lớn ở đỉnh thân */
  const orbPlacement = (n: LayoutNode): { pos: [number, number, number]; scale: number } => {
    const g = n.member.generation - layout.minGen;
    if (n.isRoot) return { pos: [n.position[0], n.position[1] + 0.3, n.position[2]], scale: layout.trunk.topRadius * 1.22 };
    if (n.woodRadius > 0) {
      // Người có con: viên ngọc gắn nửa chìm trên vỏ cành, lệch góc theo từng người để không xếp thẳng hàng
      const a = Math.atan2(n.position[2], n.position[0]) + (((n.member.id.length * 7919) % 100) / 100 - 0.5) * 1.8;
      const out = n.woodRadius * 0.95;
      return {
        pos: [n.position[0] + Math.cos(a) * out, n.position[1] + 0.03, n.position[2] + Math.sin(a) * out],
        scale: THREE.MathUtils.clamp(n.woodRadius * 0.55, 0.12, 0.34) * emphasis(n.member.id),
      };
    }
    // Đầu cành: đốm sáng như quả ở ngọn
    return { pos: n.position, scale: (0.125 + Math.min(0.04, g * 0.004)) * emphasis(n.member.id) };
  };

  // Màu từng đốm/đèn (cập nhật khi đổi chương / chọn)
  useEffect(() => {
    const c = new THREE.Color();
    const dim = highlightIds.size > 0;
    const orb = orbRef.current;
    if (orb) {
      orbNodes.forEach((n, i) => {
        const id = n.member.id;
        if (n.isRoot) c.copy(GOLD_HIGHLIGHT).multiplyScalar(1.7);
        else if (highlightIds.has(id) || id === selectedId) c.copy(GOLD_HIGHLIGHT).multiplyScalar(1.9);
        else c.copy(GOLD).multiplyScalar(dim ? 1.1 : 1.8);
        orb.setColorAt(i, c);
      });
      if (orb.instanceColor) orb.instanceColor.needsUpdate = true;
    }
    const leaf = leafRef.current;
    if (leaf) {
      leafNodes.forEach((n, i) => {
        const id = n.member.id;
        if (highlightIds.has(id) || id === selectedId) c.copy(JADE_HIGHLIGHT).multiplyScalar(2.0);
        else c.copy(JADE).multiplyScalar(dim ? 1.3 : 1.9);
        leaf.setColorAt(i, c);
      });
      if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
    }
  }, [orbNodes, leafNodes, highlightIds, selectedId]);

  // Vùng chạm lớn hơn đốm thật để dễ bấm trên điện thoại
  useEffect(() => {
    const hit = hitRef.current;
    if (!hit) return;
    nodes.forEach((n, i) => {
      dummy.position.set(...visualCenter(n));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(n.isRoot ? layout.trunk.topRadius * 1.2 : 0.5);
      dummy.updateMatrix();
      hit.setMatrixAt(i, dummy.matrix);
    });
    hit.instanceMatrix.needsUpdate = true;
    hit.computeBoundingSphere();
  }, [nodes, dummy, layout]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const span = layout.maxGen - layout.minGen + 1;
    const visibleGen = layout.minGen - 1 + growth.current * span;
    const appearOf = (n: LayoutNode) => easeOutCubic(THREE.MathUtils.clamp(visibleGen - (n.member.generation - 1) + 0.5, 0, 1));

    const orb = orbRef.current;
    if (orb) {
      orbNodes.forEach((n, i) => {
        const { pos, scale } = orbPlacement(n);
        const pulse = reduced ? 1 : n.isRoot ? 1 + 0.05 * Math.sin(t * 0.9) : 1 + 0.14 * Math.sin(t * 1.8 + phaseOf(n));
        dummy.position.set(pos[0], pos[1], pos[2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(scale * pulse * appearOf(n));
        dummy.updateMatrix();
        orb.setMatrixAt(i, dummy.matrix);
      });
      orb.instanceMatrix.needsUpdate = true;
    }

    const leaf = leafRef.current;
    if (leaf) {
      const gust = windUniforms.uGust.value;
      leafNodes.forEach((n, i) => {
        const ph = phaseOf(n);
        const s = LEAF_SCALE * emphasis(n.member.id) * (reduced ? 1 : 1 + 0.05 * Math.sin(t * 1.6 + ph)) * appearOf(n);
        dummy.position.set(n.position[0], n.position[1], n.position[2]);
        // Lá đung đưa nhẹ, gặp gió thì lật qua lật lại mạnh và nhanh hơn
        dummy.rotation.set(
          reduced ? 0 : 0.22 * gust * Math.sin(t * 2.7 + ph * 1.3),
          Math.PI / 2 - n.angle,
          reduced ? 0 : (0.1 + 0.3 * gust) * Math.sin(t * (1.25 + 1.4 * gust) + ph)
        );
        dummy.scale.set(s * 0.5, s, s);
        dummy.updateMatrix();
        leaf.setMatrixAt(i, dummy.matrix);
      });
      leaf.instanceMatrix.needsUpdate = true;
    }

    // Vòng sáng quanh người được chọn, luôn hướng về camera và xoay chậm
    const ring = ringRef.current;
    if (ring) {
      const n = selectedId ? layout.byId.get(selectedId) : undefined;
      if (n && appearOf(n) > 0.5) {
        const alive = isAlive(n.member);
        const [x, y, z] = alive ? visualCenter(n) : orbPlacement(n).pos;
        const w = windOffset(n.position, alive ? 0.12 : 0);
        const base = alive ? 0.44 : orbPlacement(n).scale;
        ring.visible = true;
        ring.position.set(x + w[0], y + w[1], z + w[2]);
        ring.quaternion.copy(camera.quaternion);
        ring.rotateZ(t * 0.6);
        ring.scale.setScalar(base * 1.9 * (1 + 0.06 * Math.sin(t * 2.4)));
        (ring.material as THREE.MeshBasicMaterial).color.copy(alive ? JADE_HIGHLIGHT : GOLD_HIGHLIGHT);
      } else ring.visible = false;
    }
  });

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId != null ? nodes[e.instanceId]?.member ?? null : null);
  // Chỉ coi là "bấm" khi con trỏ không kéo đi quá 8px (kẻo xoay cây lại mở thẻ)
  const downAt = useRef<[number, number] | null>(null);

  return (
    <>
      {orbNodes.length > 0 && (
        <instancedMesh key={`o${orbNodes.length}`} ref={orbRef} args={[sphere, orbMaterial, orbNodes.length]} frustumCulled={false} />
      )}
      {leafNodes.length > 0 && (
        <instancedMesh key={`f${leafNodes.length}`} ref={leafRef} args={[leafGeo, leafMaterial, leafNodes.length]} frustumCulled={false} />
      )}
      <mesh ref={ringRef} visible={false} renderOrder={5}>
        <ringGeometry args={[0.86, 1, 48]} />
        <meshBasicMaterial color={GOLD_HIGHLIGHT} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh
        key={`h${nodes.length}`}
        ref={hitRef}
        args={[sphere, undefined, nodes.length]}
        onPointerMove={(e) => {
          e.stopPropagation();
          const m = pick(e);
          setHoverId(m?.id ?? null);
          gl.domElement.style.cursor = m ? "pointer" : "";
        }}
        onPointerOut={() => {
          setHoverId(null);
          gl.domElement.style.cursor = "";
        }}
        onPointerDown={(e) => {
          downAt.current = [e.nativeEvent.clientX, e.nativeEvent.clientY];
        }}
        onClick={(e) => {
          e.stopPropagation();
          const d = downAt.current;
          if (d && Math.hypot(e.nativeEvent.clientX - d[0], e.nativeEvent.clientY - d[1]) > 8) return;
          onSelect(pick(e));
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
