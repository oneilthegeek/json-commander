import * as THREE from "three";

/** Push points of a quarter arc (for rounded corners in lathe profiles). */
function arc(
  out: THREE.Vector2[],
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  steps = 8,
) {
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

const H = Math.PI / 2;

export const JAR = {
  radius: 0.86,
  wall: 0.035,
  bottom: -1.2,
  shoulder: 0.82,
  neckRadius: 0.7,
  neckTop: 1.16,
};

/**
 * Closed profile for a thick-walled glass jar: outer wall up, over the
 * lip, inner wall down. Lathing a closed outline gives real glass
 * thickness so the transmission material refracts convincingly.
 */
export function createJarGlassGeometry() {
  const { radius: R, wall: t, bottom: b, shoulder: s, neckRadius: n, neckTop: top } = JAR;
  const p: THREE.Vector2[] = [];
  const cr = 0.14; // base corner radius

  p.push(new THREE.Vector2(0, b));
  arc(p, R - cr, b + cr, cr, -H, 0);
  p.push(new THREE.Vector2(R, s));
  // shoulder curve into the neck
  arc(p, n, s, R - n, 0, H * 0.75, 10);
  p.push(new THREE.Vector2(n, top - 0.12));
  p.push(new THREE.Vector2(n, top - 0.02));
  arc(p, n - 0.02, top - 0.02, 0.02, 0, H, 3);
  // inner wall back down
  p.push(new THREE.Vector2(n - t, top - 0.02));
  p.push(new THREE.Vector2(n - t, top - 0.12));
  arc(p, n, s, R - n - t, H * 0.75, 0, 10);
  p.push(new THREE.Vector2(R - t, b + cr));
  arc(p, R - cr, b + cr + t * 0.6, cr - t, 0, -H);
  p.push(new THREE.Vector2(0, b + t * 1.6));

  return new THREE.LatheGeometry(p, 96);
}

/** Sauce volume sitting inside the glass, with a gentle meniscus on top. */
export function createSauceGeometry(fill = 0.62) {
  const { radius: R, wall: t, bottom: b } = JAR;
  const r = R - t - 0.008;
  const p: THREE.Vector2[] = [];
  const cr = 0.1;
  p.push(new THREE.Vector2(0, b + t * 1.7));
  arc(p, r - cr, b + t * 1.7 + cr, cr, -H, 0, 6);
  p.push(new THREE.Vector2(r, fill));
  // meniscus: climbs the wall slightly then dips toward the centre
  p.push(new THREE.Vector2(r - 0.02, fill + 0.025));
  p.push(new THREE.Vector2(r - 0.08, fill + 0.01));
  p.push(new THREE.Vector2(r * 0.5, fill));
  p.push(new THREE.Vector2(0, fill - 0.005));
  return new THREE.LatheGeometry(p, 96);
}

/** Knurled metal lid: a lathe body with vertical grip ridges displaced in. */
export function createLidGeometry() {
  const { neckRadius: n, neckTop: top } = JAR;
  const R = n + 0.06;
  const y0 = top - 0.2;
  const y1 = top + 0.2;
  const p: THREE.Vector2[] = [];
  p.push(new THREE.Vector2(R - 0.01, y0));
  arc(p, R - 0.02, y0 + 0.02, 0.02, -H, 0, 3);
  p.push(new THREE.Vector2(R, y1 - 0.05));
  arc(p, R - 0.05, y1 - 0.05, 0.05, 0, H, 6);
  p.push(new THREE.Vector2(R * 0.6, y1 + 0.01));
  p.push(new THREE.Vector2(0, y1 + 0.015));

  const geo = new THREE.LatheGeometry(p, 240);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    // only knurl the vertical wall
    if (r > R - 0.012 && v.y > y0 + 0.03 && v.y < y1 - 0.06) {
      const a = Math.atan2(v.z, v.x);
      const ridge = Math.pow(Math.abs(Math.cos(a * 60)), 6) * 0.012;
      const k = (r - ridge) / r;
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
