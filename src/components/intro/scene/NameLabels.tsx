import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { TreeLayout } from "../../../lib/treeLayout3d";
import { isAlive } from "../../../types";

/** Nhãn tên trên đốm sáng: chiếu lên màn hình mỗi khung hình, dời lên/xuống để tránh chồng nhau, hết chỗ thì ẩn */
export default function NameLabels({ layout, ids }: { layout: TreeLayout; ids: string[] }) {
  const refs = useRef(new Map<string, HTMLDivElement>());
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  // Hiện nhiều nhãn trên màn hẹp: thu gọn để xếp đủ
  const compact = ids.length > 8 && size.width < 700;
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    ids.forEach((id) => {
      const el = refs.current.get(id);
      const n = layout.byId.get(id);
      if (!el || !n) return;
      v.set(n.position[0], n.position[1], n.position[2]).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const w = el.offsetWidth || 120;
      const h = el.offsetHeight || 34;
      let chosen: [number, number] | null = null;
      const tries: [number, number][] = [
        [0, 0], [0, -h - 6], [0, h + 22], [-w * 0.62, -h / 2 - 2], [w * 0.62, -h / 2 - 2],
        [-w * 0.62, h / 2 + 16], [w * 0.62, h / 2 + 16], [0, -2 * h - 12], [0, 2 * h + 28],
      ];
      for (const [dx, dy] of tries) {
        const box = { x0: x - w / 2 + dx, x1: x + w / 2 + dx, y0: y - h - 14 + dy, y1: y - 14 + dy };
        if (!placed.some((b) => box.x0 < b.x1 + 4 && box.x1 > b.x0 - 4 && box.y0 < b.y1 + 4 && box.y1 > b.y0 - 4)) {
          placed.push(box);
          chosen = [dx, dy];
          break;
        }
      }
      const behind = v.z > 1;
      el.style.opacity = chosen === null || behind ? "0" : "1";
      el.style.transform = `translate(calc(-50% + ${chosen?.[0] ?? 0}px), calc(-100% - 14px + ${chosen?.[1] ?? 0}px))`;
    });
  });

  return (
    <>
      {ids.map((id) => {
        const n = layout.byId.get(id);
        if (!n) return null;
        return (
          <Html key={id} position={n.position} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div
              ref={(el) => {
                if (el) refs.current.set(id, el);
                else refs.current.delete(id);
              }}
              className={`intro-label ${isAlive(n.member) ? "intro-label-alive" : ""} ${compact ? "intro-label-compact" : ""}`}
              style={{ position: "absolute", left: 0, top: 0, transition: "opacity .25s" }}
            >
              <span className="intro-label-name">{n.member.name}</span>
              <span className="intro-label-gen">Đời {n.member.generation}</span>
            </div>
          </Html>
        );
      })}
    </>
  );
}
