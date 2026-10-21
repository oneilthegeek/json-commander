import * as THREE from "three";

function fontFamily(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return v || fallback;
}

/**
 * Paints the wrap-around label on a canvas so it stays crisp without
 * shipping image assets. Redrawn once web fonts are ready.
 */
export function drawLabel(canvas: HTMLCanvasElement) {
  const W = canvas.width;
  const Hh = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const display = fontFamily("--font-display", "Impact");
  const serif = fontFamily("--font-serif", "Georgia");
  const sans = fontFamily("--font-sans", "Arial");

  // matte black paper with fibre noise
  ctx.fillStyle = "#0d0b0a";
  ctx.fillRect(0, 0, W, Hh);
  const img = ctx.getImageData(0, 0, W, Hh);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // orange borders
  ctx.fillStyle = "#FF5B00";
  ctx.fillRect(0, 26, W, 10);
  ctx.fillRect(0, Hh - 36, W, 10);
  ctx.fillRect(0, 48, W, 3);
  ctx.fillRect(0, Hh - 51, W, 3);

  // the front of the label sits at the centre of the canvas
  const cx = W / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#FFC48A";
  ctx.font = `600 34px ${sans}`;
  ctx.letterSpacing = "14px";
  ctx.fillText("SMALL BATCH · EST. 2019", cx, 150);

  ctx.fillStyle = "#FF5B00";
  ctx.letterSpacing = "0px";
  ctx.font = `400 300px ${display}`;
  ctx.fillText("FUEGO", cx, 450);

  ctx.fillStyle = "#F4EBDD";
  ctx.font = `italic 400 150px ${serif}`;
  ctx.fillText("Noir", cx, 600);

  ctx.strokeStyle = "#FF5B00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 360, 660);
  ctx.lineTo(cx - 60, 660);
  ctx.moveTo(cx + 60, 660);
  ctx.lineTo(cx + 360, 660);
  ctx.stroke();
  // flame glyph
  ctx.fillStyle = "#FF5B00";
  ctx.beginPath();
  ctx.moveTo(cx, 630);
  ctx.bezierCurveTo(cx + 30, 660, cx + 26, 690, cx, 696);
  ctx.bezierCurveTo(cx - 26, 690, cx - 30, 660, cx, 630);
  ctx.fill();

  ctx.fillStyle = "#F4EBDD";
  ctx.font = `600 38px ${sans}`;
  ctx.letterSpacing = "10px";
  ctx.fillText("SMOKED HABANERO SAUCE", cx, 770);
  ctx.fillStyle = "#FFA04D";
  ctx.font = `500 28px ${sans}`;
  ctx.fillText("HEAT ●●●●○   ·   250 ML", cx, 830);

  // side panels: nutrition / story copy wrapping around the jar
  ctx.textAlign = "left";
  ctx.letterSpacing = "4px";
  ctx.fillStyle = "#8a7d70";
  ctx.font = `500 24px ${sans}`;
  const lines = [
    "INGREDIENTS: HABANERO, BLACK GARLIC,",
    "AGED MOLASSES, APPLE CIDER VINEGAR,",
    "SMOKED SEA SALT, CHARRED ONION.",
    "",
    "HAND-CRAFTED IN SMALL BATCHES.",
    "REFRIGERATE AFTER OPENING.",
  ];
  lines.forEach((l, i) => ctx.fillText(l, 120, 330 + i * 42));
  ctx.textAlign = "right";
  ["NO. 001 / NOIR EMBER", "BATCH 24-117", "", "FIRE WITHIN.", "FLAVOUR BEYOND."].forEach((l, i) =>
    ctx.fillText(l, W - 120, 330 + i * 42),
  );

  ctx.letterSpacing = "0px";
}

export function createLabelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 900;
  drawLabel(canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // redraw once fonts are actually available
  document.fonts?.ready.then(() => {
    drawLabel(canvas);
    tex.needsUpdate = true;
  });
  return tex;
}

export function createLidTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const draw = () => {
    const display = fontFamily("--font-display", "Impact");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 512, 512);
    // brushed-metal radial strokes
    for (let i = 0; i < 1400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 256;
      ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.beginPath();
      ctx.arc(256, 256, r, a, a + 0.4);
      ctx.stroke();
    }
    ctx.strokeStyle = "#FF5B00";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#FF5B00";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 150px ${display}`;
    ctx.fillText("FN", 256, 266);
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  document.fonts?.ready.then(() => {
    draw();
    tex.needsUpdate = true;
  });
  return tex;
}
