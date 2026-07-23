import * as THREE from "three";

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A barrier segment the car collides against (keeps it on the street). */
export interface Wall {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface Anchor {
  x: number;
  z: number;
  /** Y-rotation so a building's front (+Z) faces the road. */
  rot: number;
}

export interface WorldResult {
  colliders: AABB[];
  walls: Wall[];
  anchors: Anchor[];
  spawn: { x: number; z: number; heading: number };
  update: (time: number) => void;
}

// Bright daytime sign accents.
export const ACCENTS = [0xe0483e, 0x3a7bd5, 0xf2b134, 0x2bb0a8, 0xe85d9c, 0x7a5cd0];
const WALLS = [0xf2ede4, 0xdfe6ec, 0xe8d5c4, 0xc9d6c0, 0xd9c2d6, 0xb6c2cf, 0xeceff2];

// --- Track definition ----------------------------------------------------
// Closed circuit centre-line (clockwise-ish loop with varied curves).
const CTRL: Array<[number, number]> = [
  [-20, -22],
  [4, -26],
  [24, -20],
  [29, -3],
  [19, 11],
  [25, 23],
  [6, 20],
  [-9, 26],
  [-24, 21],
  [-30, 3],
  [-25, -13],
];
const BASE_HALF = 4.4; // half road width on normal sections
const PLAZA_U = 0.08; // where the donut plaza balloons out
const PLAZA_AMP = 7.5;
const PLAZA_W = 0.06;
const DRIFT_U = 0.56; // a wide drift sweeper
const DRIFT_AMP = 3.5;
const DRIFT_W = 0.05;
const N = 260; // ribbon samples
const BARRIER_STEP = 2; // sample stride for barrier segments

function circDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}
function bump(u: number, center: number, width: number, amp: number): number {
  const du = circDist(u, center);
  if (du > width) return 0;
  const x = 1 - du / width;
  return amp * x * x * (3 - 2 * x); // smoothstep falloff
}
function halfWidthAt(u: number): number {
  return BASE_HALF + bump(u, PLAZA_U, PLAZA_W, PLAZA_AMP) + bump(u, DRIFT_U, DRIFT_W, DRIFT_AMP);
}

interface TrackSample {
  p: THREE.Vector3;
  normal: THREE.Vector3; // unit, left of travel
  hw: number;
}

function buildCurve(): THREE.CatmullRomCurve3 {
  const pts = CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  return curve;
}

// --- Facade texture (daytime windows painted onto the wall colour) -------
function makeWallTexture(wall: number): THREE.CanvasTexture {
  const cols = 5;
  const rows = 6;
  const cell = 16;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `#${wall.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random() < 0.12;
      ctx.fillStyle = lit ? "#ffe6a8" : Math.random() < 0.5 ? "#41525f" : "#586b78";
      ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function makeSignTexture(color: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1a1f";
  ctx.fillRect(0, 0, 48, 96);
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  const glyphs = 2 + ((Math.random() * 2) | 0);
  for (let i = 0; i < glyphs; i++) {
    const gy = 10 + i * 28;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, gy, 24, 20);
    ctx.fillRect(16, gy + 8, 16, 3);
    ctx.fillRect(22, gy, 3, 20);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const wallTexCache = new Map<number, THREE.CanvasTexture>();
function wallTexture(wall: number): THREE.CanvasTexture {
  let tex = wallTexCache.get(wall);
  if (!tex) {
    tex = makeWallTexture(wall);
    wallTexCache.set(wall, tex);
  }
  return tex;
}

// --- Building ------------------------------------------------------------
export function makeBuilding(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const wall = WALLS[(Math.random() * WALLS.length) | 0];
  const tex = wallTexture(wall).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 1.6)));

  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  body.position.y = h / 2;
  group.add(body);

  const store = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.05, 1.1, d + 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2f333b, roughness: 0.7 }),
  );
  store.position.y = 0.55;
  group.add(store);

  const accent = ACCENTS[(Math.random() * ACCENTS.length) | 0];
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 }),
  );
  awning.position.set(0, 1.15, d / 2 + 0.25);
  group.add(awning);

  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.3, 0.6, d * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }),
  );
  tank.position.set(w * 0.18, h + 0.3, -d * 0.18);
  group.add(tank);

  if (Math.random() < 0.7 && h > 3) {
    const signColor = ACCENTS[(Math.random() * ACCENTS.length) | 0];
    const signMat = new THREE.MeshStandardMaterial({
      map: makeSignTexture(signColor),
      emissive: signColor,
      emissiveIntensity: 0.25,
    });
    const signH = Math.min(2.4, h * 0.5);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signH * 0.5, signH), signMat);
    sign.position.set(w / 2 + 0.04, h * 0.55, d * 0.2);
    sign.rotation.y = Math.PI / 2;
    group.add(sign);
  }
  return group;
}

function placeBuilding(
  scene: THREE.Scene,
  colliders: AABB[],
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  const b = makeBuilding(w, h, d);
  b.position.set(x, 0, z);
  scene.add(b);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

// --- Props ---------------------------------------------------------------
function makeStreetLamp(): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 1 }),
  );
  pole.position.y = 1.6;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x33373e, roughness: 1 }),
  );
  head.position.set(0.25, 3.2, 0);
  group.add(pole, head);
  return group;
}

function makeTree(): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 1 }),
  );
  trunk.position.y = 0.45;
  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ color: 0x4f9e54, flatShading: true, roughness: 1 }),
  );
  leaves.position.y = 1.3;
  tree.add(trunk, leaves);
  return tree;
}

// --- Track surface + barriers -------------------------------------------
function buildTrack(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  walls: Wall[],
): { samples: TrackSample[]; centroid: THREE.Vector2 } {
  const samples: TrackSample[] = [];
  const tangent = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tangent);
    tangent.y = 0;
    tangent.normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x); // left of travel
    samples.push({ p, normal, hw: halfWidthAt(u) });
  }

  // Road ribbon geometry (two edges → triangle strip, wrapping closed).
  const positions: number[] = [];
  const uvs: number[] = [];
  const y = 0.02;
  for (let i = 0; i < N; i++) {
    const s = samples[i];
    const l = s.p.clone().addScaledVector(s.normal, s.hw);
    const r = s.p.clone().addScaledVector(s.normal, -s.hw);
    positions.push(l.x, y, l.z, r.x, y, r.z);
    uvs.push(0, i, 1, i);
  }
  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const j = ((i + 1) % N) * 2;
    const k = ((i + 1) % N) * 2 + 1;
    indices.push(a, b, j, b, k, j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.9, side: THREE.DoubleSide }),
  );
  scene.add(road);

  // Dashed centre line following the curve.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2e28a, roughness: 1 });
  const spaced = curve.getSpacedPoints(120);
  for (let i = 0; i < spaced.length - 1; i += 2) {
    const a = spaced[i];
    const b = spaced[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.16), dashMat);
    dash.position.set(mid.x, 0.05, mid.z);
    dash.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    scene.add(dash);
  }

  // Guardrail barriers + wall colliders along both edges.
  const railWhite = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, roughness: 0.6 });
  const railRed = new THREE.MeshStandardMaterial({ color: 0xd6503f, roughness: 0.6 });
  const buildEdge = (side: 1 | -1) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i += BARRIER_STEP) {
      const s = samples[i];
      pts.push(s.p.clone().addScaledVector(s.normal, side * (s.hw + 0.5)));
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      walls.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.22), i % 2 ? railRed : railWhite);
      rail.position.set((a.x + b.x) / 2, 0.32, (a.z + b.z) / 2);
      rail.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      scene.add(rail);
    }
  };
  buildEdge(1);
  buildEdge(-1);

  let cx = 0;
  let cz = 0;
  for (const [x, z] of CTRL) {
    cx += x;
    cz += z;
  }
  return { samples, centroid: new THREE.Vector2(cx / CTRL.length, cz / CTRL.length) };
}

// --- Donut plaza / drift skidpad ----------------------------------------
function buildSkidpad(scene: THREE.Scene, curve: THREE.CatmullRomCurve3): void {
  const c = curve.getPointAt(PLAZA_U);
  for (const radius of [3.2, 4.8]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.18, radius, 48),
      new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.04, c.z);
    scene.add(ring);
  }
  // "DRIFT" sign board on posts.
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1c2026";
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = "#f2c14e";
  ctx.font = "bold 26px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DRIFT ↺", 64, 26);
  const tex = new THREE.CanvasTexture(canvas);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1.1),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xf2c14e, emissiveIntensity: 0.2 }),
  );
  board.position.set(c.x, 2.4, c.z - 6);
  scene.add(board);
}

// --- Infield park --------------------------------------------------------
function buildPark(scene: THREE.Scene, centroid: THREE.Vector2): void {
  const g = new THREE.Group();
  g.position.set(centroid.x, 0, centroid.y);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshStandardMaterial({ color: 0x4f9e54, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.01;
  g.add(grass);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a90c2, roughness: 0.3, metalness: 0.2 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(2, 0.03, -1);
  g.add(pond);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rad = 5 + Math.random() * 3;
    const tree = makeTree();
    tree.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad + (Math.random() - 0.5) * 2);
    tree.scale.setScalar(0.9 + Math.random() * 0.5);
    g.add(tree);
  }

  // Low picket fence ring (decorative — inner barrier already blocks access).
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, roughness: 0.8 });
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), fenceMat);
    post.position.set(Math.cos(a) * 9, 0.3, Math.sin(a) * 9);
    g.add(post);
  }
  scene.add(g);
}

// --- Roadside anchors for landmarks -------------------------------------
function buildAnchors(samples: TrackSample[], centroid: THREE.Vector2): Anchor[] {
  const us = [0.14, 0.3, 0.44, 0.68, 0.86]; // spread around the loop, avoiding the plaza
  const anchors: Anchor[] = [];
  for (const u of us) {
    const i = Math.round(u * N) % N;
    const s = samples[i];
    // Outward = the normal direction pointing away from the infield centroid.
    const toC = new THREE.Vector3(centroid.x - s.p.x, 0, centroid.y - s.p.z);
    const outward = s.normal.dot(toC) > 0 ? s.normal.clone().negate() : s.normal.clone();
    const pos = s.p.clone().addScaledVector(outward, s.hw + 3.2);
    const inward = outward.clone().negate();
    anchors.push({ x: pos.x, z: pos.z, rot: Math.atan2(inward.x, inward.z) });
  }
  return anchors;
}

// --- Assembly ------------------------------------------------------------
export function createWorld(scene: THREE.Scene): WorldResult {
  const colliders: AABB[] = [];
  const walls: Wall[] = [];
  const curve = buildCurve();

  // Ground base.
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x565a61, roughness: 1 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.02;
  scene.add(base);

  const { samples, centroid } = buildTrack(scene, curve, walls);
  buildSkidpad(scene, curve);
  buildPark(scene, centroid);
  const anchors = buildAnchors(samples, centroid);

  // Scenery buildings scattered in the outer ring (beyond the track).
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.2;
    const rad = 38 + Math.random() * 10;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const w = 3 + Math.random() * 3;
    placeBuilding(scene, colliders, x, z, w, 3 + Math.random() * 4, w);
  }

  // Street lamps + trees dotted just outside the barriers.
  for (let i = 0; i < 14; i++) {
    const u = i / 14;
    const s = samples[Math.round(u * N) % N];
    const outward = s.normal.dot(new THREE.Vector3(centroid.x - s.p.x, 0, centroid.y - s.p.z)) > 0
      ? s.normal.clone().negate()
      : s.normal.clone();
    const spot = s.p.clone().addScaledVector(outward, s.hw + 1.4);
    const prop = i % 2 ? makeStreetLamp() : makeTree();
    prop.position.set(spot.x, 0, spot.z);
    scene.add(prop);
  }

  // Spawn on a straight-ish part of the track.
  const su = 0.72;
  const sp = curve.getPointAt(su);
  const st = curve.getTangentAt(su);
  const spawn = { x: sp.x, z: sp.z, heading: Math.atan2(st.x, st.z) };

  return { colliders, walls, anchors, spawn, update: () => {} };
}
