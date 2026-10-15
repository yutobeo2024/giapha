import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { FamilyMember } from "../../types";
import type { TreeLayout } from "../../lib/treeLayout3d";
import type { IntroChapter } from "../../data/introChapters";
import Atmosphere from "./scene/Atmosphere";
import Bark from "./scene/Bark";
import MemberLights from "./scene/MemberLights";
import Glow from "./scene/Glow";
import Fireflies from "./scene/Fireflies";
import NameLabels from "./scene/NameLabels";
import CameraRig, { createHandoff } from "./scene/CameraRig";
import ExploreControls from "./scene/ExploreControls";
import type { Quality, SceneMode, SpinState, FlyRequest } from "./scene/constants";
import { WindClock, windUniforms } from "./scene/wind";

export type { Quality, SceneMode, SpinState, FlyRequest };

export interface SceneProps {
  layout: TreeLayout;
  chapter: IntroChapter;
  highlightIds: Set<string>;
  quality: Quality;
  reducedMotion: boolean;
  /** Vùng màn hình bị chữ/menu che (px), đo từ DOM để cây nằm gọn trong phần còn trống */
  insets: { top: number; left: number; bottom: number };
  selectedId: string | null;
  onSelect: (m: FamilyMember | null) => void;
  mode: SceneMode;
  /** Góc xoay do người xem kéo ở chế độ hành trình */
  spin: React.MutableRefObject<SpinState>;
  /** Yêu cầu bay camera (Khám phá) */
  fly: FlyRequest | null;
  /** Đời đang chọn bằng chip (Khám phá): hiện nhãn cả đời */
  activeGen: number | null;
  onInteract: () => void;
}

const MAX_LABELS = 16;

function SceneContent(props: SceneProps & { lowPerf: boolean }) {
  const { layout, chapter, highlightIds, quality, reducedMotion, insets, selectedId, onSelect, mode, spin, fly, activeGen, onInteract, lowPerf } = props;
  const growth = useRef(reducedMotion ? 1 : 0);
  const handoff = useRef(createHandoff());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<string[]>([]);
  const onNearby = useCallback((ids: string[]) => setNearby(ids), []);

  const wind = useMemo(() => new WindClock(), []);
  useEffect(() => {
    windUniforms.uCrownBase.value = layout.trunk.topY + 1;
    windUniforms.uCrownTop.value = layout.heightOf(layout.maxGen);
    windUniforms.uCrownR.value = layout.crown.radius;
    windUniforms.uWindOn.value = reducedMotion ? 0 : 1;
  }, [layout, reducedMotion]);

  useFrame((_, dt) => {
    if (growth.current < 1) growth.current = Math.min(1, growth.current + dt / 4.2);
    // Gió chỉ nổi khi cây đã mọc xong
    wind.update(Math.min(dt, 0.1), !reducedMotion && growth.current >= 1);
  });

  const top = layout.heightOf(layout.maxGen);
  const labels = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId) ids.add(selectedId);
    if (hoverId) ids.add(hoverId);
    if (mode === "story") highlightIds.forEach((id) => ids.add(id));
    else if (activeGen != null) layout.nodes.filter((n) => n.member.generation === activeGen).forEach((n) => ids.add(n.member.id));
    else nearby.forEach((id) => ids.add(id));
    return [...ids].slice(0, activeGen != null ? 80 : MAX_LABELS);
  }, [highlightIds, hoverId, selectedId, mode, activeGen, nearby, layout]);

  return (
    <>
      <Atmosphere layout={layout} quality={quality} reduced={reducedMotion} />
      <Bark layout={layout} growth={growth} quality={quality} />
      <MemberLights
        layout={layout}
        highlightIds={highlightIds}
        selectedId={selectedId}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onSelect={onSelect}
        growth={growth}
        reduced={reducedMotion}
        quality={quality}
      />
      <Glow layout={layout} highlightIds={highlightIds} quality={quality} growth={growth} reduced={reducedMotion} />
      <Fireflies count={quality === "high" ? 650 : 260} spiralCount={quality === "high" ? 160 : 60} top={top} ground={layout.groundY} reduced={reducedMotion} />
      <NameLabels layout={layout} ids={labels} />
      {mode === "story" ? (
        <CameraRig layout={layout} chapter={chapter} reduced={reducedMotion} insets={insets} spin={spin} handoff={handoff} />
      ) : (
        <ExploreControls layout={layout} handoff={handoff} fly={fly} reduced={reducedMotion} onNearby={onNearby} onInteract={onInteract} />
      )}

      {!lowPerf && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={quality === "high" ? 1.3 : 0.95} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.72} />
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
