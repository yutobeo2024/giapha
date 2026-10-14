import * as THREE from "three";

export type Quality = "high" | "low";
export type SceneMode = "story" | "explore";

/** Người đã khuất: đốm ngọc vàng */
export const GOLD = new THREE.Color("#f6c35b");
export const GOLD_HIGHLIGHT = new THREE.Color("#ffd98a");
/** Người đang sống: đèn lá xanh ngọc */
export const JADE = new THREE.Color("#7ff0b8");
export const JADE_HIGHLIGHT = new THREE.Color("#c4ffe3");

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Trạng thái xoay do người xem kéo trong chế độ hành trình (ref chia sẻ giữa trang và camera) */
export interface SpinState {
  offset: number;
  velocity: number;
  dragging: boolean;
}

/** Yêu cầu bay camera trong chế độ Khám phá: tới một người hoặc một đời */
export interface FlyRequest {
  seq: number;
  id?: string;
  gen?: number;
}
