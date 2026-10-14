import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Stars, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FamilyMember } from "../../types";
import { GEN_HEIGHT, type TreeLayout, type LayoutBranch, type Vec3 } from "../../lib/treeLayout3d";
import type { IntroChapter } from "../../data/introChapters";

export type Quality = "high" | "low";

interface SceneProps {
  layout: TreeLayout;
  chapter: IntroChapter;
  highlightIds: Set<string>;
  quality: Quality;
  reducedMotion: boolean;
  /** Vùng màn hình bị chữ/menu che (px), đo từ DOM để cây nằm gọn trong phần còn trống */
  insets: { top: number; left: number; bottom: number };
  selectedId: string | null;
  onSelect: (m: FamilyMember | null) => void;
}

const GOLD = new THREE.Color("#f6c35b");
const GOLD_ALIVE = new THREE.Color("#fff1c2");
const GOLD_HIGHLIGHT = new THREE.Color("#ffd98a");

// ---------------------------------------------------------------- helpers

/** Ống cong thuôn dần từ radiusStart → radiusEnd (TubeGeometry có bán kính cố định nên co lại từng vòng). */
function taperedTube(b: LayoutBranch, tubular: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(b.points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const base = 1;
  const geo = new THREE.TubeGeometry(curve, tubular, base, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const center = curve.getPointAt(t);
    // thuôn nhanh ở đầu, chậm ở cuối cho giống cành thật
    const r = THREE.MathUtils.lerp(b.radiusStart, b.radiusEnd, Math.pow(t, 0.7));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(r / base).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,240,200,1)");
  grd.addColorStop(0.35, "rgba(255,200,110,0.55)");
  grd.addColorStop(1, "rgba(255,180,80,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sealTextures(): { ring: THREE.Texture; glyph: THREE.Texture } {
  const size = 512;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  // Vòng hoa văn xoay
  const rc = mk();
  const r = rc.getContext("2d")!;
  r.translate(size / 2, size / 2);
  r.strokeStyle = "rgba(246,195,91,0.9)";
  r.lineWidth = 6;
  r.beginPath();
  r.arc(0, 0, 236, 0, Math.PI * 2);
  r.stroke();
  r.lineWidth = 2;
  r.beginPath();
  r.arc(0, 0, 214, 0, Math.PI * 2);
  r.stroke();
  for (let i = 0; i < 48; i++) {
    r.save();
    r.rotate((i / 48) * Math.PI * 2);
    r.fillStyle = i % 4 === 0 ? "rgba(255,226,150,0.95)" : "rgba(246,195,91,0.55)";
    r.fillRect(-2, -232, 4, i % 4 === 0 ? 16 : 9);
    r.restore();
  }
  // Chữ 阮
  const gc = mk();
  const g = gc.getContext("2d")!;
  g.translate(size / 2, size / 2);
  const grd = g.createRadialGradient(0, 0, 10, 0, 0, 190);
  grd.addColorStop(0, "rgba(139,35,35,0.85)");
  grd.addColorStop(1, "rgba(139,35,35,0)");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, 200, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,230,170,1)";
  g.font = "bold 220px 'Noto Serif CJK SC','Noto Serif SC','SimSun','Songti SC',serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("阮", 0, 10);
  const toTex = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { ring: toTex(rc), glyph: toTex(gc) };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Đốm sáng dạng viên ngọc: lõi sáng ở giữa, viền dịu dần (đọc được là khối cầu, không phải đĩa phẳng). */
function makeOrbMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    vertexShader: `
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vView;
      void main() {
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vView;
      void main() {
        float f = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        float core = pow(f, 2.2);
        vec3 rim = vColor * vec3(0.55, 0.32, 0.12);
        vec3 c = mix(rim, vColor * 1.15, core) + vec3(1.0, 0.95, 0.85) * pow(f, 12.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- background

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
        },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = vPos.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bottom, smoothstep(0.0, 0.5, -h));
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

function Fireflies({ count, top, ground, reduced }: { count: number; top: number; ground: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(glowTexture, []);
  const { positions, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.pow(Math.random(), 0.6) * 15;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = ground + Math.random() * (top - ground + 4);
      positions[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 0.12 + Math.random() * 0.35;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, [count, top, ground]);

  useFrame((state, dt) => {
    if (reduced || !ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const t = state.clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * d;
      arr[i * 3] += Math.sin(t * 0.6 + phases[i]) * 0.004;
      arr[i * 3 + 2] += Math.cos(t * 0.5 + phases[i]) * 0.004;
      if (arr[i * 3 + 1] > top + 4) arr[i * 3 + 1] = ground;
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={tex}
        size={0.18}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#ffd27a"
        toneMapped={false}
      />
    </points>
  );
}

function Seal({ y, reduced }: { y: number; reduced: boolean }) {
  const { ring, glyph } = useMemo(sealTextures, []);
  const ringRef = useRef<THREE.Mesh>(null);
  const faceRef = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!reduced && ringRef.current) ringRef.current.rotation.z += dt * 0.08;
    // Xoay cả ấn quanh trục đứng để chân chữ 阮 luôn hướng về người xem
    if (faceRef.current) faceRef.current.rotation.y = Math.atan2(state.camera.position.x, state.camera.position.z);
  });
  return (
    <group ref={faceRef} position={[0, y + 0.02, 0]}>
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[9, 64]} />
        <meshBasicMaterial color="#1a0c10" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[6.4, 6.4]} />
        <meshBasicMaterial map={ring} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[4.2, 4.2]} />
        <meshBasicMaterial map={glyph} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
    </group>
  );
}

// ---------------------------------------------------------------- tree

function Branches({ layout, growth }: { layout: TreeLayout; growth: React.MutableRefObject<number> }) {
  const quality = useThree((s) => s.viewport.dpr) > 1.5 ? 1 : 0;
  const { geometry, countsByGen } = useMemo(() => {
    const all = [...layout.roots, ...layout.branches].sort((a, b) => a.generation - b.generation);
    const tubular = quality ? 22 : 14;
    const radial = quality ? 9 : 6;
    const parts = all.map((b) => taperedTube(b, b.generation <= layout.minGen + 1 ? 28 : tubular, b.generation <= layout.minGen + 2 ? 14 : radial));
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    // Số index tích lũy theo đời để hiệu ứng "mọc" bằng drawRange
    const countsByGen = new Map<number, number>();
    let acc = 0;
    all.forEach((b, i) => {
      acc += parts[i].index ? parts[i].index!.count : 0;
      countsByGen.set(b.generation, acc);
    });
    return { geometry: merged, countsByGen };
  }, [layout, quality]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const visibleGen = layout.minGen - 1 + growth.current * (layout.maxGen - layout.minGen + 1);
    let count = 0;
    for (const [g, c] of countsByGen) if (g <= visibleGen + 0.5) count = Math.max(count, c);
    geometry.setDrawRange(0, growth.current >= 1 ? Infinity : count);
  });

  // Mắt gỗ: khối cầu ở mỗi chỗ nối để thân liền mạch, không thành đốt tre
  const knots = useMemo(() => layout.nodes.filter((n) => n.woodRadius > 0), [layout]);
  const knotRef = useRef<THREE.InstancedMesh>(null);
  const knotGeo = useMemo(() => new THREE.SphereGeometry(1, quality ? 18 : 12, quality ? 14 : 10), [quality]);
  useFrame(() => {
    const mesh = knotRef.current;
    if (!mesh) return;
    const visibleGen = layout.minGen - 1 + growth.current * (layout.maxGen - layout.minGen + 1);
    const m = new THREE.Matrix4();
    knots.forEach((n, i) => {
      const r = n.member.generation <= visibleGen + 0.5 ? n.woodRadius * 0.98 : 0;
      m.makeScale(r, r, r).setPosition(...n.position);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const wood = <meshStandardMaterial color="#7a4c2c" roughness={0.7} metalness={0.3} emissive="#6a300c" emissiveIntensity={0.55} />;
  return (
    <>
      <mesh geometry={geometry}>{wood}</mesh>
      {knots.length > 0 && (
        <instancedMesh key={`k${knots.length}`} ref={knotRef} args={[knotGeo, undefined, knots.length]} frustumCulled={false}>
          {wood}
        </instancedMesh>
      )}
    </>
  );
}

function MemberLights({
  layout,
  highlightIds,
  selectedId,
  hoverId,
  setHoverId,
  onSelect,
  growth,
  reduced,
}: {
  layout: TreeLayout;
  highlightIds: Set<string>;
  selectedId: string | null;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  onSelect: (m: FamilyMember | null) => void;
  growth: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  const nodes = layout.nodes;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phases = useMemo(() => nodes.map((_, i) => (i * 2.399) % (Math.PI * 2)), [nodes]);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 28, 20), []);
  const orbMaterial = useMemo(makeOrbMaterial, []);
  const gl = useThree((s) => s.gl);

  // Kích thước cơ sở: gần gốc nhỏ hơn (thân), người nổi bật to hơn
  const baseScale = (i: number) => {
    const n = nodes[i];
    const id = n.member.id;
    const g = n.member.generation - layout.minGen;
    let s = 0.1 + Math.min(0.04, g * 0.004);
    if (highlightIds.has(id)) s *= 1.65;
    if (id === selectedId || id === hoverId) s *= 1.4;
    // Người nằm trên thân/cành to: đốm phải to hơn gỗ để thành vòng sáng quanh thân
    return Math.max(s, n.woodRadius * 1.14);
  };

  // Màu từng đốm (cập nhật khi đổi chương / chọn)
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    nodes.forEach((n, i) => {
      const id = n.member.id;
      if (highlightIds.has(id) || id === selectedId) c.copy(GOLD_HIGHLIGHT).multiplyScalar(1.9);
      else if (n.member.status === "Alive") c.copy(GOLD_ALIVE).multiplyScalar(1.8);
      else c.copy(GOLD).multiplyScalar(highlightIds.size ? 1.1 : 1.8);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, highlightIds, selectedId]);

  // Vùng chạm lớn hơn đốm thật để dễ bấm trên điện thoại
  useEffect(() => {
    const hit = hitRef.current;
    if (!hit) return;
    nodes.forEach((n, i) => {
      dummy.position.set(...n.position);
      dummy.scale.setScalar(0.45);
      dummy.updateMatrix();
      hit.setMatrixAt(i, dummy.matrix);
    });
    hit.instanceMatrix.needsUpdate = true;
    hit.computeBoundingSphere();
  }, [nodes, dummy]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const span = layout.maxGen - layout.minGen + 1;
    const visibleGen = layout.minGen - 1 + growth.current * span;
    nodes.forEach((n, i) => {
      const appear = THREE.MathUtils.clamp(visibleGen - (n.member.generation - 1) + 0.5, 0, 1);
      const pulse = reduced ? 1 : 1 + 0.14 * Math.sin(t * 1.8 + phases[i]);
      dummy.position.set(...n.position);
      dummy.scale.setScalar(baseScale(i) * pulse * easeOutCubic(appear));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId != null ? nodes[e.instanceId]?.member ?? null : null);

  return (
    <>
      <instancedMesh key={`v${nodes.length}`} ref={meshRef} args={[sphere, orbMaterial, nodes.length]} frustumCulled={false} />
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
        onClick={(e) => {
          e.stopPropagation();
          onSelect(pick(e));
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/** Quầng sáng mềm quanh mỗi đốm + lớp "lá sáng" lấp lánh trên tán (đời thứ 4 trở lên). */
function Glow({
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
  const tex = useMemo(glowTexture, []);
  const normalRef = useRef<THREE.PointsMaterial>(null);
  const hiRef = useRef<THREE.PointsMaterial>(null);
  const leafRef = useRef<THREE.PointsMaterial>(null);

  const { normal, hi } = useMemo(() => {
    const n: number[] = [];
    const h: number[] = [];
    for (const node of layout.nodes) (highlightIds.has(node.member.id) ? h : n).push(...node.position);
    return { normal: new Float32Array(n), hi: new Float32Array(h) };
  }, [layout, highlightIds]);

  const leaves = useMemo(() => {
    const per = quality === "high" ? 16 : 7;
    const pos: number[] = [];
    const col: number[] = [];
    const palette = ["#ffd27a", "#ffb347", "#fff1c2", "#f6c35b", "#ffcf9e"].map((c) => new THREE.Color(c));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const node of layout.nodes) {
      if (node.member.generation - layout.minGen < 3) continue;
      for (let i = 0; i < per; i++) {
        const u = rnd() * Math.PI * 2;
        const v = Math.acos(2 * rnd() - 1);
        const r = 0.25 + rnd() * 0.75;
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
    if (hiRef.current) hiRef.current.opacity = 0.9 * g * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2));
    if (leafRef.current) {
      leafRef.current.opacity = Math.max(0, g - 0.35) * 1.4 * (reduced ? 0.8 : 0.7 + 0.3 * Math.sin(t * 0.9));
      leafRef.current.size = reduced ? 0.32 : 0.3 + 0.07 * Math.sin(t * 1.3);
    }
  });

  const common = { map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true } as const;
  return (
    <>
      <points key={`n${normal.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[normal, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={normalRef} {...common} size={2.6} color="#ffb84d" opacity={0} />
      </points>
      {hi.length > 0 && (
        <points key={`h${hi.length}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[hi, 3]} />
          </bufferGeometry>
          <pointsMaterial ref={hiRef} {...common} size={6} color="#ffe2a0" opacity={0} />
        </points>
      )}
      <points key={`l${leaves.pos.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[leaves.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[leaves.col, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={leafRef} {...common} size={0.1} vertexColors opacity={0} />
      </points>
    </>
  );
}

function NameLabels({ layout, ids }: { layout: TreeLayout; ids: string[] }) {
  const refs = useRef(new Map<string, HTMLDivElement>());
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const v = useMemo(() => new THREE.Vector3(), []);

  // Mỗi khung hình: chiếu vị trí lên màn hình, đặt nhãn theo thứ tự ưu tiên,
  // nhãn nào đụng nhãn đã đặt thì thử dời lên/xuống, không còn chỗ thì ẩn.
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
      let chosen: number | null = null;
      for (const dy of [0, -h - 6, h + 22, -2 * h - 12, 2 * h + 28]) {
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h - 14 + dy, y1: y - 14 + dy };
        if (!placed.some((b) => box.x0 < b.x1 + 4 && box.x1 > b.x0 - 4 && box.y0 < b.y1 + 4 && box.y1 > b.y0 - 4)) {
          placed.push(box);
          chosen = dy;
          break;
        }
      }
      const behind = v.z > 1;
      el.style.opacity = chosen === null || behind ? "0" : "1";
      el.style.transform = `translate(-50%, calc(-100% - 14px + ${chosen ?? 0}px))`;
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
              className="intro-label"
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

// ---------------------------------------------------------------- camera

function CameraRig({
  layout,
  chapter,
  reduced,
  insets,
}: {
  layout: TreeLayout;
  chapter: IntroChapter;
  reduced: boolean;
  insets: { top: number; left: number; bottom: number };
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const pos = useRef(new THREE.Vector3(0, 6, 40));
  const look = useRef(new THREE.Vector3(0, 6, 0));
  const first = useRef(true);
  const orbit = useRef(0);

  const target = useMemo(() => {
    const { minGen, maxGen, heightOf, spreadOf, groundY } = layout;
    let from: number, to: number;
    if (chapter.focus === "all") [from, to] = [minGen, maxGen];
    else if (chapter.focus === "latest") [from, to] = [Math.max(minGen, maxGen - 1), maxGen];
    else [from, to] = [Math.max(minGen, chapter.focus.from), Math.min(maxGen, Math.max(chapter.focus.to, chapter.focus.from))];

    const bottom = chapter.focus === "all" ? groundY : heightOf(from) - GEN_HEIGHT * 0.6;
    const topY = heightOf(to) + GEN_HEIGHT * 0.6;
    let spread = 0;
    for (let g = from; g <= to; g++) spread = Math.max(spread, spreadOf(g));
    const height = Math.max(2.5, topY - bottom);
    const width = Math.max(2.5, spread * 2 + 1.2);
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

  useFrame((state, dt) => {
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
    const az = target.az + orbit.current;
    const desired = new THREE.Vector3(Math.cos(az) * dist, target.centerY + dist * 0.16, Math.sin(az) * dist);
    const desiredLook = new THREE.Vector3(0, target.centerY, 0);

    if (first.current || reduced) {
      // Lần đầu: bắt đầu từ xa, thấp, để cảnh bay vào
      if (first.current && !reduced) {
        pos.current.set(Math.cos(az) * dist * 1.8, layout.groundY + 1, Math.sin(az) * dist * 1.8);
        look.current.set(0, layout.groundY + 2, 0);
      } else {
        pos.current.copy(desired);
        look.current.copy(desiredLook);
      }
      first.current = false;
    }
    const k = 1 - Math.exp(-d * 1.15);
    pos.current.lerp(desired, k);
    look.current.lerp(desiredLook, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);

    // Dời tâm cảnh vào giữa vùng còn trống
    const w = size.width;
    const h = size.height;
    camera.setViewOffset(w, h, -insets.left / 2, (insets.bottom - insets.top) / 2, w, h);
  });

  useEffect(() => () => camera.clearViewOffset(), [camera]);
  return null;
}

// ---------------------------------------------------------------- root

function SceneContent(props: SceneProps & { lowPerf: boolean }) {
  const { layout, chapter, highlightIds, quality, reducedMotion, insets, selectedId, onSelect, lowPerf } = props;
  const growth = useRef(reducedMotion ? 1 : 0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useFrame((_, dt) => {
    if (growth.current < 1) growth.current = Math.min(1, growth.current + dt / 4.2);
  });

  const top = layout.heightOf(layout.maxGen);
  const labels = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) ids.add(selectedId);
    if (hoverId) ids.add(hoverId);
    highlightIds.forEach((id) => ids.add(id));
    return [...ids].slice(0, 10);
  }, [highlightIds, hoverId, selectedId]);

  return (
    <>
      <SkyDome />
      <fogExp2 attach="fog" args={["#140c18", 0.018]} />
      <ambientLight intensity={0.35} color="#ffd9a8" />
      <hemisphereLight args={["#7b8cff", "#5a1a10", 0.45]} />
      <pointLight position={[0, layout.groundY + 2.5, 0]} intensity={40} distance={18} color="#ffb04a" />
      <directionalLight position={[10, top + 8, 6]} intensity={0.9} color="#c9d4ff" />

      <Stars radius={110} depth={40} count={quality === "high" ? 2200 : 900} factor={3.2} saturation={0} fade speed={reducedMotion ? 0 : 0.35} />
      <Seal y={layout.groundY} reduced={reducedMotion} />
      <Branches layout={layout} growth={growth} />
      <MemberLights
        layout={layout}
        highlightIds={highlightIds}
        selectedId={selectedId}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onSelect={onSelect}
        growth={growth}
        reduced={reducedMotion}
      />
      <Glow layout={layout} highlightIds={highlightIds} quality={quality} growth={growth} reduced={reducedMotion} />
      <Fireflies count={quality === "high" ? 650 : 240} top={top} ground={layout.groundY} reduced={reducedMotion} />
      <NameLabels layout={layout} ids={labels} />
      <CameraRig layout={layout} chapter={chapter} reduced={reducedMotion} insets={insets} />

      {!lowPerf && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={quality === "high" ? 1.25 : 0.9} luminanceThreshold={0.62} luminanceSmoothing={0.25} radius={0.72} />
          <Vignette eskil={false} offset={0.22} darkness={0.72} />
        </EffectComposer>
      )}
    </>
  );
}

export default function TreeScene(props: SceneProps) {
  const [lowPerf, setLowPerf] = useState(false);
  const [dpr, setDpr] = useState<number>(() => Math.min(window.devicePixelRatio || 1, props.quality === "high" ? 1.75 : 1.25));

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: props.quality === "high", powerPreference: "high-performance", alpha: false }}
      camera={{ fov: 42, near: 0.1, far: 400, position: [0, 6, 40] }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ touchAction: "none" }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr((d) => Math.max(1, d - 0.25));
          if (dpr <= 1.01) setLowPerf(true);
        }}
      />
      <SceneContent {...props} lowPerf={lowPerf} />
    </Canvas>
  );
}

export type { Vec3 };
