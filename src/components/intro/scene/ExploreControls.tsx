import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { TreeLayout } from "../../../lib/treeLayout3d";
import { visualCenter } from "./MemberLights";
import { easeInOutCubic, type FlyRequest } from "./constants";
import type { CameraHandoff } from "./CameraRig";

interface Props {
  layout: TreeLayout;
  handoff: React.MutableRefObject<CameraHandoff>;
  fly: FlyRequest | null;
  reduced: boolean;
  /** Danh sách người gần tâm màn hình khi camera lại gần (để hiện nhãn) */
  onNearby: (ids: string[]) => void;
  onInteract: () => void;
}

const IDLE_BEFORE_AUTOROTATE_MS = 8000;
const NEARBY_MAX = 14;
const NEARBY_DISTANCE = 15;

/** Chế độ Khám phá: xoay, phóng, kéo tự do (OrbitControls) + bay mượt tới một người hoặc một đời */
export default function ExploreControls({ layout, handoff, fly, reduced, onNearby, onInteract }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useRef<OrbitControlsImpl>(null);
  const lastInteract = useRef(Date.now());
  const flight = useRef<{ active: boolean; t: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 }>({
    active: false,
    t: 0,
    dur: 1.2,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromT: new THREE.Vector3(),
    toT: new THREE.Vector3(),
  });
  const nearbyKey = useRef("");
  const nearbyClock = useRef(0);
  const v = useMemo(() => new THREE.Vector3(), []);

  // Bắt đầu từ đúng chỗ camera hành trình đang đứng; bỏ dời tâm khung hình của hành trình
  useEffect(() => {
    camera.clearViewOffset();
    const c = controls.current;
    if (!c) return;
    const h = handoff.current;
    if (h.valid) {
      camera.position.copy(h.pos);
      c.target.copy(h.look);
    } else {
      c.target.set(0, (layout.groundY + layout.heightOf(layout.maxGen)) / 2, 0);
    }
    c.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yêu cầu bay tới người / đời
  useEffect(() => {
    const c = controls.current;
    if (!fly || !c) return;
    const f = flight.current;
    const toT = new THREE.Vector3();
    const toPos = new THREE.Vector3();
    const camDir = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    if (camDir.lengthSq() < 0.01) camDir.set(0, 0, 1);
    camDir.normalize();

    if (fly.id) {
      const n = layout.byId.get(fly.id);
      if (!n) return;
      toT.set(...visualCenter(n));
      const out = new THREE.Vector3(n.position[0], 0, n.position[2]);
      if (out.lengthSq() < 0.09) out.copy(camDir);
      out.normalize();
      const dist = n.isRoot ? Math.max(6, layout.trunk.topRadius * 5) : 3.6;
      toPos.copy(toT).addScaledVector(out, dist).add(new THREE.Vector3(0, dist * 0.3, 0));
    } else if (fly.gen != null) {
      const g = fly.gen;
      if (g === layout.minGen) {
        toT.set(0, (layout.groundY + layout.trunk.topY) / 2 + 0.5, 0);
        const dist = Math.max(10, layout.trunk.rootSpread * 2.1);
        toPos.copy(toT).addScaledVector(camDir, dist).add(new THREE.Vector3(0, dist * 0.22, 0));
      } else {
        toT.set(0, layout.heightOf(g), 0);
        const dist = Math.max(7, layout.spreadOf(g) * 2.3 + 2);
        toPos.copy(toT).addScaledVector(camDir, dist).add(new THREE.Vector3(0, dist * 0.3, 0));
      }
    } else return;

    f.fromPos.copy(camera.position);
    f.fromT.copy(c.target);
    f.toPos.copy(toPos);
    f.toT.copy(toT);
    f.t = 0;
    f.dur = reduced ? 0.01 : 1.2;
    f.active = true;
    lastInteract.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly?.seq]);

  useFrame((state, dt) => {
    const c = controls.current;
    if (!c) return;
    const f = flight.current;
    if (f.active) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeInOutCubic(f.t);
      camera.position.lerpVectors(f.fromPos, f.toPos, e);
      c.target.lerpVectors(f.fromT, f.toT, e);
      c.update();
      if (f.t >= 1) f.active = false;
    }
    c.autoRotate = !reduced && !f.active && Date.now() - lastInteract.current > IDLE_BEFORE_AUTOROTATE_MS;

    handoff.current.pos.copy(camera.position);
    handoff.current.look.copy(c.target);
    handoff.current.valid = true;

    // Người gần tâm màn hình khi camera đã lại gần (cập nhật ~3 lần/giây)
    nearbyClock.current += dt;
    if (nearbyClock.current < 0.3) return;
    nearbyClock.current = 0;
    let ids: string[] = [];
    if (camera.position.distanceTo(c.target) < NEARBY_DISTANCE) {
      const scored: { id: string; d: number }[] = [];
      for (const n of layout.nodes) {
        v.set(n.position[0], n.position[1], n.position[2]).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
        scored.push({ id: n.member.id, d: v.x * v.x + v.y * v.y * (state.size.height / state.size.width) });
      }
      scored.sort((a, b) => a.d - b.d);
      ids = scored.slice(0, NEARBY_MAX).map((s) => s.id);
    }
    const key = ids.join("|");
    if (key !== nearbyKey.current) {
      nearbyKey.current = key;
      onNearby(ids);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      panSpeed={0.7}
      minDistance={2.5}
      maxDistance={75}
      maxPolarAngle={Math.PI * 0.52}
      autoRotateSpeed={0.35}
      screenSpacePanning
      onStart={() => {
        flight.current.active = false;
        lastInteract.current = Date.now();
        onInteract();
      }}
      onChange={() => {
        lastInteract.current = Math.max(lastInteract.current, Date.now() - IDLE_BEFORE_AUTOROTATE_MS + 100);
      }}
    />
  );
}
