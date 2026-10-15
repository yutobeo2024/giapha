import * as THREE from "three";
import { WIND_GLSL, windUniforms } from "./wind";

/** Đốm sáng dạng viên ngọc: lõi sáng ở giữa, viền dịu dần (đọc được là khối cầu, không phải đĩa phẳng). Đung đưa theo gió. */
export function makeOrbMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: windUniforms,
    vertexShader: `
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vView;
      ${WIND_GLSL}
      void main() {
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.xyz += windOffset(instanceMatrix[3].xyz, 0.0);
        vec4 mv = modelViewMatrix * wp;
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

/** Nửa chiều rộng của chiếc lá theo vị trí dọc t (0 cuống, 1 mũi): dùng chung cho hình học và shader gân lá */
export const leafHalfWidth = (t: number) => 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), 0.78)), 0.9);

/**
 * Đèn lồng hình chiếc lá cho người đang sống: thân lá phát sáng xanh ngọc, gân giữa và gân xiên sáng hơn,
 * mép lá tối dần như giấy đèn lồng. Hình lá vẽ với y từ 0 (cuống) xuống -1 (mũi), uv = tọa độ hình.
 */
export function makeLeafMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: windUniforms,
    vertexShader: `
      varying vec3 vColor; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      ${WIND_GLSL}
      void main() {
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vUv = uv;
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.xyz += windOffset(instanceMatrix[3].xyz, 0.12);
        vec4 mv = modelViewMatrix * wp;
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
      float halfWidth(float t) { return 0.5 * pow(sin(3.14159265 * pow(clamp(t, 0.0, 1.0), 0.78)), 0.9); }
      void main() {
        if (vUv.y > 0.2) { gl_FragColor = vec4(vec3(0.2, 0.11, 0.06) + vColor * 0.03, 1.0); return; }
        float t = clamp(-vUv.y, 0.0, 1.0);
        float w = max(halfWidth(t), 0.02);
        float edge = clamp(1.0 - abs(vUv.x) / w, 0.0, 1.0);
        float mid = smoothstep(0.07, 0.0, abs(vUv.x)) * smoothstep(1.0, 0.86, t);
        float s = abs(fract((t - abs(vUv.x) * 1.1) * 7.0) - 0.5);
        float side = smoothstep(0.09, 0.0, s) * smoothstep(0.0, 0.14, edge) * (1.0 - mid) * smoothstep(0.02, 0.12, t);
        float f = abs(dot(normalize(vNormal), normalize(vView)));
        vec3 rim = vColor * vec3(0.2, 0.4, 0.33);
        vec3 body = mix(rim, vColor, pow(edge, 0.6) * (0.55 + 0.45 * f));
        vec3 glow = vec3(0.86, 1.0, 0.94);
        vec3 c = body + glow * (mid * 0.5 + side * 0.22) + vColor * pow(edge, 3.0) * 0.45;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/**
 * Đom đóm: mỗi hạt bay lượn theo tổng các sóng sin (đường bay tự nhiên), nhấp nháy kiểu đom đóm thật
 * (sáng ngắn, tắt dài, lệch pha), hạt gần camera to và mờ hơn (giả độ sâu trường ảnh).
 * Chế độ uSpiral: dòng đom đóm xoắn ốc bay lên quanh thân.
 */
export function makeFireflyMaterial(opts: { spiral: boolean; colorA: THREE.Color; colorB: THREE.Color }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uGround: { value: 0 },
      uTop: { value: 10 },
      uPixelRatio: { value: 1 },
      uColorA: { value: opts.colorA },
      uColorB: { value: opts.colorB },
      uOpacity: { value: 1 },
      uSpiral: { value: opts.spiral ? 1 : 0 },
    },
    vertexShader: `
      attribute vec3 aSeed; attribute float aSize; attribute float aPhase; attribute float aSpeed;
      uniform float uTime; uniform float uGround; uniform float uTop; uniform float uPixelRatio; uniform float uSpiral;
      varying float vAlpha; varying float vMix;
      void main() {
        float span = uTop - uGround + 5.0;
        vec3 p;
        if (uSpiral > 0.5) {
          float rise = fract(aSeed.z + uTime * 0.035 * aSpeed);
          float ang = aSeed.x * 6.2832 + uTime * 0.45 * aSpeed + rise * 5.0;
          float rad = 1.6 + rise * 7.5 + sin(aSeed.y * 6.2832 + uTime * 0.6) * 0.5;
          p = vec3(cos(ang) * rad, uGround + rise * span, sin(ang) * rad);
        } else {
          float t = uTime * aSpeed;
          p = position;
          p.x += sin(t * 0.7 + aSeed.x * 6.2832) * 0.7 + sin(t * 0.21 + aSeed.y * 9.0) * 1.1;
          p.z += cos(t * 0.6 + aSeed.y * 6.2832) * 0.7 + cos(t * 0.17 + aSeed.z * 7.0) * 1.1;
          p.y = uGround + mod(position.y - uGround + t * 0.35 + sin(t * 0.9 + aSeed.z * 6.2832) * 0.3, span);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float cyc = fract(uTime * 0.16 * (0.6 + aSeed.z * 0.8) + aPhase);
        float on = smoothstep(0.0, 0.07, cyc) * (1.0 - smoothstep(0.2, 0.42, cyc));
        float near = smoothstep(7.0, 1.5, -mv.z);
        vAlpha = (0.12 + on) * (1.0 - near * 0.75);
        vMix = aSeed.y;
        float size = aSize * (1.0 + near * 2.5) * (1.0 + on * 0.5);
        gl_PointSize = size * uPixelRatio * (260.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uOpacity;
      varying float vAlpha; varying float vMix;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;
        float core = exp(-r * r * 9.0);
        float halo = exp(-r * r * 2.4) * 0.45;
        vec3 col = mix(uColorA, uColorB, vMix);
        vec3 c = col * (core * 1.5 + halo) + vec3(1.0, 0.98, 0.9) * core * 0.9;
        gl_FragColor = vec4(c, (core + halo) * vAlpha * uOpacity);
      }`,
  });
}

/**
 * Vật liệu vỏ cây: màu + normal map rãnh vỏ (texture lặp, tính bằng canvas), rãnh phát sáng vàng ấm
 * và các dải sáng chạy từ gốc lên ngọn ("nhựa sống" của dòng họ). Hiệu ứng mọc dần: điểm nào có
 * đời (attribute aGen) lớn hơn uVisibleGen thì chưa vẽ.
 */
export function makeBarkMaterial(
  uniforms: { time: { value: number }; visibleGen: { value: number } },
  tex: { map: THREE.Texture; normalMap: THREE.Texture; height: THREE.Texture }
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    color: "#ffffff",
    roughness: 0.93,
    metalness: 0.03,
    emissive: "#0e0806",
    emissiveIntensity: 0.5,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.time;
    shader.uniforms.uVisibleGen = uniforms.visibleGen;
    shader.uniforms.uHeight = { value: tex.height };
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float aGen; varying float vGen; varying vec3 vWPos;\n${WIND_GLSL}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += windOffset(position, 0.0);")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vGen = aGen;
        vec4 barkWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          barkWp = instanceMatrix * barkWp;
        #endif
        vWPos = (modelMatrix * barkWp).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGen; varying vec3 vWPos; uniform float uTime; uniform float uVisibleGen; uniform sampler2D uHeight;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (vGen > uVisibleGen) discard;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float bh = texture2D(uHeight, vMapUv).r;
        float furrow = smoothstep(0.45, 0.08, bh);
        float pulse = pow(0.5 + 0.5 * sin((vWPos.y * 0.85 - uTime * 1.3) + bh * 6.0), 7.0);
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.22) * furrow * (0.1 + pulse * 1.0);`
      );
  };
  mat.customProgramCacheKey = () => "bark-wind";
  return mat;
}

/** Sương mặt đất: lớp phẳng cuộn hai tầng nhiễu, mờ dần ra mép */
export function makeMistMaterial(tex: THREE.Texture, color: THREE.Color, dir: [number, number], opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTex: { value: tex }, uTime: { value: 0 }, uDir: { value: new THREE.Vector2(...dir) }, uColor: { value: color }, uOpacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uTime; uniform vec2 uDir; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float n1 = texture2D(uTex, vUv * 2.0 + uDir * uTime).r;
        float n2 = texture2D(uTex, vUv * 1.3 - uDir.yx * uTime * 0.6 + 0.37).r;
        float n = n1 * n2 * 2.2;
        float d = length(vUv - 0.5) * 2.0;
        float fall = smoothstep(1.0, 0.3, d);
        gl_FragColor = vec4(uColor * n * 1.6, n * fall * uOpacity);
      }`,
  });
}

/** Tia sáng trời: dải mềm, sáng giữa, mờ hai đầu */
export function makeShaftMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uColor: { value: color }, uOpacity: { value: 0.1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() {
        float x = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = pow(x, 2.2) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });
}
