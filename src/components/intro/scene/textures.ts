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
