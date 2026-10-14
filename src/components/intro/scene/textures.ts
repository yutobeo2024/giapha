import * as THREE from "three";

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Quầng sáng mềm (sprite) cho đốm người, quầng, lá lấp lánh */
export function glowTexture(tone: "warm" | "cool" = "warm"): THREE.Texture {
  const [c, g] = canvas(64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (tone === "warm") {
    grd.addColorStop(0, "rgba(255,240,200,1)");
    grd.addColorStop(0.35, "rgba(255,200,110,0.55)");
    grd.addColorStop(1, "rgba(255,180,80,0)");
  } else {
    grd.addColorStop(0, "rgba(220,255,240,1)");
    grd.addColorStop(0.35, "rgba(140,240,190,0.55)");
    grd.addColorStop(1, "rgba(90,220,160,0)");
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

/** Nhiễu mềm lặp được (tileable) cho sương mặt đất: vẽ nhiều đốm mờ, lặp 9 lần quanh mép để không có đường nối */
export function noiseTexture(size = 256): THREE.Texture {
  const [c, g] = canvas(size);
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 150; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 18 + rnd() * 60;
    const a = 0.06 + rnd() * 0.16;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cx = x + ox * size;
        const cy = y + oy * size;
        if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0, `rgba(255,255,255,${a})`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Vòng hoa văn xoay và chữ 阮 cho ấn triện dưới gốc */
export function sealTextures(): { ring: THREE.Texture; glyph: THREE.Texture } {
  const size = 512;
  const [rc, r] = canvas(size);
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
  const [gc, g] = canvas(size);
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
  const ring = toTexture(rc);
  const glyph = toTexture(gc);
  ring.anisotropy = glyph.anisotropy = 4;
  return { ring, glyph };
}

/**
 * Vỏ cây lặp được (tileable): độ cao có rãnh chạy dọc theo chiều dài cành (trục u), màu nâu sẫm trong rãnh,
 * sáng hơn trên gờ, và normal map tính từ độ cao để ánh sáng ăn vào rãnh.
 */
export function barkTextures(size = 256): { map: THREE.Texture; normalMap: THREE.Texture; height: THREE.Texture } {
  // Value noise tuần hoàn trên lưới nx×ny ô: ảnh lặp không có đường nối
  const lattice = (nx: number, ny: number, seed: number) => {
    const grid = new Float32Array(nx * ny);
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const g = (i: number, j: number) => grid[(((j % ny) + ny) % ny) * nx + (((i % nx) + nx) % nx)];
    return (u: number, v: number) => {
      const x = u * nx;
      const y = v * ny;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const top = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
      const bot = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
      return top + (bot - top) * sy;
    };
  };
  const n1 = lattice(2, 20, 101);
  const n2 = lattice(4, 40, 202);
  const n3 = lattice(10, 80, 303);
  const n4 = lattice(24, 24, 404);
  const h = new Float32Array(size * size);
  let mn = 1;
  let mx = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = (n4(u, v) - 0.5) * 0.04;
      const val = Math.pow(0.5 * n1(u, v + warp) + 0.3 * n2(u, v + warp) + 0.15 * n3(u, v) + 0.05 * n4(u * 2, v * 2), 1.15);
      h[y * size + x] = val;
      mn = Math.min(mn, val);
      mx = Math.max(mx, val);
    }
  }
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - mn) / (mx - mn || 1);

  const image = (fill: (x: number, y: number, out: number[]) => void) => {
    const [c, g] = canvas(size);
    const data = g.createImageData(size, size);
    const out = [0, 0, 0];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        fill(x, y, out);
        const i = (y * size + x) * 4;
        data.data[i] = out[0];
        data.data[i + 1] = out[1];
        data.data[i + 2] = out[2];
        data.data[i + 3] = 255;
      }
    }
    g.putImageData(data, 0, 0);
    return c;
  };
  const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const mapC = image((x, y, o) => {
    const t = Math.pow(h[y * size + x], 1.1);
    const speck = (n3((x + 13) / size, (y + 7) / size) - 0.5) * 14;
    o[0] = clamp255(64 + 60 * t + speck);
    o[1] = clamp255(41 + 38 * t + speck * 0.8);
    o[2] = clamp255(26 + 20 * t + speck * 0.6);
  });
  const strength = 2.8;
  const normalC = image((x, y, o) => {
    const hl = h[y * size + ((x - 1 + size) % size)];
    const hr = h[y * size + ((x + 1) % size)];
    const hd = h[((y - 1 + size) % size) * size + x];
    const hu = h[((y + 1) % size) * size + x];
    const dx = (hr - hl) * strength;
    const dy = (hu - hd) * strength;
    const len = Math.hypot(dx, dy, 1);
    o[0] = clamp255(((-dx / len) * 0.5 + 0.5) * 255);
    o[1] = clamp255(((-dy / len) * 0.5 + 0.5) * 255);
    o[2] = clamp255(((1 / len) * 0.5 + 0.5) * 255);
  });
  const heightC = image((x, y, o) => {
    o[0] = o[1] = o[2] = clamp255(h[y * size + x] * 255);
  });
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(mapC, true), normalMap: tex(normalC, false), height: tex(heightC, false) };
}
