import * as THREE from "three";
import type { Vec3 } from "../../../lib/treeLayout3d";

/**
 * Gió trên tán cây: một trường dịch chuyển mượt theo vị trí thế giới, dùng chung cho vỏ cây, đốm ngọc,
 * đèn lá, quầng sáng và nhãn tên nên mọi thứ gắn trên cành đung đưa cùng nhau, không rời nhau.
 * Phần thấp và gần thân cứng (không động), càng lên cao và ra xa càng mềm. Có gió nhẹ thường xuyên
 * và thỉnh thoảng một cơn gió mạnh (uGust tăng rồi dịu dần).
 */
export const windUniforms = {
  uWindTime: { value: 0 },
  uGust: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uWindOn: { value: 1 },
  uCrownBase: { value: 0 },
  uCrownTop: { value: 10 },
  uCrownR: { value: 10 },
};

export const WIND_GLSL = `
uniform float uWindTime; uniform float uGust; uniform vec2 uWindDir; uniform float uWindOn;
uniform float uCrownBase; uniform float uCrownTop; uniform float uCrownR;
vec3 windOffset(vec3 p, float bonus) {
  float h = clamp((p.y - uCrownBase) / max(1.0, uCrownTop - uCrownBase), 0.0, 1.0);
  float o = clamp(length(p.xz) / max(1.0, uCrownR), 0.0, 1.0);
  float flex = (pow(h, 1.3) * (0.3 + 0.7 * o) + bonus) * uWindOn;
  float ph = dot(p.xz, uWindDir) * 0.2 + p.y * 0.08;
  float sway = sin(uWindTime * 1.05 - ph) * 0.65 + sin(uWindTime * 1.85 - ph * 1.7 + 1.3) * 0.35;
  float flutter = sin(uWindTime * 6.3 + p.x * 2.9 + p.z * 3.3 + p.y * 1.7);
  float amp = flex * (0.03 + 0.4 * uGust);
  vec3 w = vec3(uWindDir.x, 0.0, uWindDir.y) * sway * amp;
  w.y -= (0.5 + 0.5 * sway) * amp * 0.3;
  w += vec3(-uWindDir.y, 0.4, uWindDir.x) * flutter * amp * (0.1 + 0.3 * uGust);
  return w;
}
`;

/** Bản JS của windOffset (cho nhãn tên, vòng chọn): phải cho cùng kết quả với GLSL */
export function windOffset(p: Vec3, bonus = 0): Vec3 {
  const u = windUniforms;
  const t = u.uWindTime.value;
  const dir = u.uWindDir.value;
  const h = Math.min(1, Math.max(0, (p[1] - u.uCrownBase.value) / Math.max(1, u.uCrownTop.value - u.uCrownBase.value)));
  const o = Math.min(1, Math.max(0, Math.hypot(p[0], p[2]) / Math.max(1, u.uCrownR.value)));
  const flex = (Math.pow(h, 1.3) * (0.3 + 0.7 * o) + bonus) * u.uWindOn.value;
  const ph = (p[0] * dir.x + p[2] * dir.y) * 0.2 + p[1] * 0.08;
  const sway = Math.sin(t * 1.05 - ph) * 0.65 + Math.sin(t * 1.85 - ph * 1.7 + 1.3) * 0.35;
  const flutter = Math.sin(t * 6.3 + p[0] * 2.9 + p[2] * 3.3 + p[1] * 1.7);
  const amp = flex * (0.03 + 0.4 * u.uGust.value);
  const f = amp * (0.1 + 0.3 * u.uGust.value) * flutter;
  return [dir.x * sway * amp - dir.y * f, -(0.5 + 0.5 * sway) * amp * 0.3 + 0.4 * f, dir.y * sway * amp + dir.x * f];
}

/** Đồng hồ gió đang chạy (StrictMode có thể tạo hai bản, chỉ bản được cập nhật mới là thật) */
let activeClock: WindClock | null = null;
// Bản chạy thử: cho script kiểm tra nổi một cơn gió ngay (window.__blow()) và đọc uniform gió
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  const w = window as unknown as { __blow?: (peak?: number) => void; __wind?: typeof windUniforms };
  w.__blow = (peak = 1) => activeClock?.blow(peak);
  w.__wind = windUniforms;
}

/** Lịch gió: lặng một lúc rồi nổi một cơn, lên rồi dịu dần; hướng gió xoay chậm */
export class WindClock {
  private t = 0;
  private nextAt = 5;
  private start = -1;
  private dur = 4;
  private peak = 0.8;
  private target = 0;
  private az = Math.random() * Math.PI * 2;
  gust = 0;

  /** Nổi một cơn gió ngay bây giờ */
  blow(peak = 1) {
    this.nextAt = this.t;
    this.start = -1;
    this.peak = peak;
  }

  update(dt: number, enabled: boolean) {
    activeClock = this;
    this.t += dt;
    if (!enabled) {
      this.gust = 0;
      return;
    }
    if (this.start < 0 && this.t >= this.nextAt) {
      this.start = this.t;
      this.dur = 3.5 + Math.random() * 3.5;
      this.peak = 0.55 + Math.random() * 0.45;
      this.az += (Math.random() - 0.5) * 1.2;
    }
    if (this.start >= 0) {
      const u = (this.t - this.start) / this.dur;
      if (u >= 1) {
        this.start = -1;
        this.nextAt = this.t + 7 + Math.random() * 13;
        this.target = 0;
      } else this.target = this.peak * Math.pow(Math.sin(Math.PI * u), 1.4);
    }
    this.gust += (this.target - this.gust) * Math.min(1, dt * 2.2);
    windUniforms.uGust.value = this.gust;
    windUniforms.uWindDir.value.set(Math.cos(this.az), Math.sin(this.az));
    windUniforms.uWindTime.value = this.t;
  }
}

/** Thêm dịch chuyển gió vào vật liệu dựng sẵn của three (Standard, Points...) */
export function withWind<T extends THREE.Material>(mat: T, bonus = 0): T {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${WIND_GLSL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n transformed += windOffset(position, ${bonus.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => `wind${bonus}`;
  return mat;
}
