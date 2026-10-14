import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GEN_HEIGHT, type TreeLayout } from "../../../lib/treeLayout3d";
import type { IntroChapter } from "../../../data/introChapters";
import type { SpinState } from "./constants";

/** Vị trí camera chia sẻ giữa hành trình và Khám phá để chuyển chế độ không giật */
export interface CameraHandoff {
  valid: boolean;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export const createHandoff = (): CameraHandoff => ({ valid: false, pos: new THREE.Vector3(0, 6, 40), look: new THREE.Vector3(0, 6, 0) });

interface Props {
  layout: TreeLayout;
  chapter: IntroChapter;
  reduced: boolean;
  insets: { top: number; left: number; bottom: number };
  spin: React.MutableRefObject<SpinState>;
  handoff: React.MutableRefObject<CameraHandoff>;
}

/** Camera hành trình: bay mượt tới khung hình của chương, xoay chậm quanh cây, cộng thêm góc người xem kéo (có quán tính) */
export default function CameraRig({ layout, chapter, reduced, insets, spin, handoff }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const pos = useRef(new THREE.Vector3(0, 6, 40));
  const look = useRef(new THREE.Vector3(0, 6, 0));
  const first = useRef(true);
  const orbit = useRef(0);

  const target = useMemo(() => {
    const { minGen, maxGen, heightOf, spreadOf, groundY, trunk } = layout;
    let from: number, to: number;
    if (chapter.focus === "all") [from, to] = [minGen, maxGen];
    else if (chapter.focus === "latest") [from, to] = [Math.max(minGen, maxGen - 1), maxGen];
    else [from, to] = [Math.max(minGen, chapter.focus.from), Math.min(maxGen, Math.max(chapter.focus.to, chapter.focus.from))];

    // Chương có Thủy tổ: lấy cả thân và bộ rễ vào khung
    const showsTrunk = chapter.focus === "all" || from === minGen;
    const bottom = showsTrunk ? groundY - 0.4 : heightOf(from) - GEN_HEIGHT * 0.6;
    const topY = heightOf(to) + GEN_HEIGHT * 0.6;
    let spread = 0;
    for (let g = from; g <= to; g++) spread = Math.max(spread, spreadOf(g));
    const height = Math.max(2.5, topY - bottom);
    let width = Math.max(2.5, spread * 2 + 1.2);
    if (showsTrunk) width = Math.max(width, trunk.rootSpread * 1.7);
    const centerY = (bottom + topY) / 2;

    // Hướng camera: về phía những người được nhắc (trung bình góc), nếu không thì theo cấu hình chương
    let az = THREE.MathUtils.degToRad(chapter.azimuth);
    const hl = (chapter.highlight || []).map((id) => layout.byId.get(id)).filter(Boolean);
    if (hl.length && chapter.focus !== "all") {
      const sx = hl.reduce((s, n) => s + Math.cos(n!.angle), 0);
      const sz = hl.reduce((s, n) => s + Math.sin(n!.angle), 0);
      if (Math.hypot(sx, sz) > 0.2 * hl.length) az = Math.atan2(sz, sx);
    }
    return { centerY, height, width, az, zoom: chapter.zoom ?? 1 };
  }, [layout, chapter]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const aspect = size.width / Math.max(1, size.height);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    // Phần màn hình còn trống sau khi trừ menu và khung chữ (đo từ DOM), chừa lề 6%
    const usableH = Math.max(0.3, (size.height - insets.top - insets.bottom) / size.height) * 0.94;
    const usableW = Math.max(0.3, (size.width - insets.left) / size.width) * 0.94;
    const distH = target.height / (2 * Math.tan(vfov / 2) * usableH);
    const distW = target.width / (2 * Math.tan(vfov / 2) * aspect * usableW);
    const dist = Math.max(8, Math.max(distH, distW) * target.zoom);

    if (!reduced) orbit.current += d * 0.045;
    const sp = spin.current;
    if (!sp.dragging) {
      sp.offset += sp.velocity * d;
      sp.velocity *= Math.exp(-d * 2.6);
    }
    const az = target.az + orbit.current + sp.offset;
    const desired = new THREE.Vector3(Math.cos(az) * dist, target.centerY + dist * 0.16, Math.sin(az) * dist);
    const desiredLook = new THREE.Vector3(0, target.centerY, 0);

    if (first.current || reduced) {
      if (first.current && handoff.current.valid) {
        // Quay về từ Khám phá: tiếp tục từ chỗ camera đang đứng
        pos.current.copy(handoff.current.pos);
        look.current.copy(handoff.current.look);
      } else if (first.current && !reduced) {
        // Lần đầu: bắt đầu từ xa, thấp, để cảnh bay vào
        pos.current.set(Math.cos(az) * dist * 1.8, layout.groundY + 1, Math.sin(az) * dist * 1.8);
        look.current.set(0, layout.groundY + 2, 0);
      } else {
        pos.current.copy(desired);
        look.current.copy(desiredLook);
      }
      first.current = false;
    }
    const k = 1 - Math.exp(-d * (sp.dragging || Math.abs(sp.velocity) > 0.05 ? 4 : 1.15));
    pos.current.lerp(desired, k);
    look.current.lerp(desiredLook, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    handoff.current.pos.copy(pos.current);
    handoff.current.look.copy(look.current);
    handoff.current.valid = true;

    // Dời tâm cảnh vào giữa vùng còn trống
    const w = size.width;
    const h = size.height;
    camera.setViewOffset(w, h, -insets.left / 2, (insets.bottom - insets.top) / 2, w, h);
  });

  useEffect(() => () => camera.clearViewOffset(), [camera]);
  return null;
}
