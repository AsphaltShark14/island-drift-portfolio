import * as THREE from "three";

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldResult {
  colliders: AABB[];
  update: (time: number) => void;
}

// Bright daytime sign accents (used on shopfronts / landmark trim).
export const ACCENTS = [0xe0483e, 0x3a7bd5, 0xf2b134, 0x2bb0a8, 0xe85d9c, 0x7a5cd0];
// Building wall colours — clean pastels + a few bolder ones.
const WALLS = [0xf2ede4, 0xdfe6ec, 0xe8d5c4, 0xc9d6c0, 0xd9c2d6, 0xb6c2cf, 0xeceff2];

// Ring-road geometry. A square loop of width ROAD_W, drivable; buildings
// sit in the outer blocks and the (short) centre block.
export const ROAD_CENTER = 14;
const ROAD_W = 6;
const OUTER = ROAD_CENTER + ROAD_W / 2; // 17

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
      // Mostly cool glass; a few warm-lit windows for life.
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

// Cache one facade texture per wall colour.
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

  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  body.position.y = h / 2;
  group.add(body);

  // Ground-floor storefront band.
  const store = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.05, 1.1, d + 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2f333b, roughness: 0.7 }),
  );
  store.position.y = 0.55;
  group.add(store);

  // Awning in an accent colour.
  const accent = ACCENTS[(Math.random() * ACCENTS.length) | 0];
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 }),
  );
  awning.position.set(0, 1.15, d / 2 + 0.25);
  group.add(awning);

  // Rooftop water tank.
  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.3, 0.6, d * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }),
  );
  tank.position.set(w * 0.18, h + 0.3, -d * 0.18);
  group.add(tank);

  // Vertical projecting sign (very common on Tokyo backstreets).
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
  b.position.set(x, 0, z); // axis-aligned so the AABB collider matches the mesh
  scene.add(b);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

// --- Roads ---------------------------------------------------------------
function buildRoads(scene: THREE.Scene): void {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x40444b, roughness: 0.85 });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 1 });

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ color: 0x5c6067, roughness: 1 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.02;
  scene.add(base);

  const roadLen = OUTER * 2;
  const strip = (w: number, d: number, x: number, z: number, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
  };

  strip(roadLen + 2, ROAD_W + 2, 0, ROAD_CENTER, sidewalk, -0.005);
  strip(roadLen + 2, ROAD_W + 2, 0, -ROAD_CENTER, sidewalk, -0.005);
  strip(ROAD_W + 2, roadLen + 2, ROAD_CENTER, 0, sidewalk, -0.005);
  strip(ROAD_W + 2, roadLen + 2, -ROAD_CENTER, 0, sidewalk, -0.005);

  strip(roadLen + ROAD_W, ROAD_W, 0, ROAD_CENTER, asphalt);
  strip(roadLen + ROAD_W, ROAD_W, 0, -ROAD_CENTER, asphalt);
  strip(ROAD_W, roadLen + ROAD_W, ROAD_CENTER, 0, asphalt);
  strip(ROAD_W, roadLen + ROAD_W, -ROAD_CENTER, 0, asphalt);

  // Dashed centre lines.
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2e28a, roughness: 1 });
  const dash = () => new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.16), lineMat);
  for (let i = -OUTER; i <= OUTER; i += 2.2) {
    for (const z of [ROAD_CENTER, -ROAD_CENTER]) {
      const d1 = dash();
      d1.position.set(i, 0.03, z);
      scene.add(d1);
    }
    for (const x of [ROAD_CENTER, -ROAD_CENTER]) {
      const d2 = dash();
      d2.rotation.y = Math.PI / 2;
      d2.position.set(x, 0.03, i);
      scene.add(d2);
    }
  }
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

function makeVendingMachine(): THREE.Group {
  const group = new THREE.Group();
  const color = ACCENTS[(Math.random() * ACCENTS.length) | 0];
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.7, 0.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  box.position.y = 0.85;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.4 }),
  );
  face.position.set(0, 0.9, 0.31);
  group.add(box, face);
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

// --- Assembly ------------------------------------------------------------
export function createWorld(scene: THREE.Scene): WorldResult {
  const colliders: AABB[] = [];

  buildRoads(scene);

  // Center block: a cluster of short buildings (kept low so they never
  // obstruct the isometric view of the car).
  const centerSpots: Array<[number, number, number]> = [
    [-5, -5, 3.2], [5, -5, 3.6], [-5, 5, 3.4], [5, 5, 3.0], [0, 0, 4],
  ];
  for (const [x, z, w] of centerSpots) {
    placeBuilding(scene, colliders, x, z, w, 3.5 + Math.random() * 2.5, w);
  }

  // Outer perimeter buildings lining the far side of the ring road.
  const perim = OUTER + 4;
  for (const off of [-9, 9]) {
    placeBuilding(scene, colliders, off, perim, 4 + Math.random() * 2, 3 + Math.random() * 2.5, 4);
    placeBuilding(scene, colliders, off, -perim, 4 + Math.random() * 2, 3 + Math.random() * 2.5, 4);
    placeBuilding(scene, colliders, perim, off, 4, 3 + Math.random() * 2.5, 4 + Math.random() * 2);
    placeBuilding(scene, colliders, -perim, off, 4, 3 + Math.random() * 2.5, 4 + Math.random() * 2);
  }

  // Street lamps at the ring's inner corners + side midpoints.
  const inner = ROAD_CENTER - ROAD_W / 2 - 0.5;
  const lampSpots: Array<[number, number]> = [
    [inner, inner], [-inner, inner], [inner, -inner], [-inner, -inner],
    [0, inner], [0, -inner], [inner, 0], [-inner, 0],
  ];
  for (const [x, z] of lampSpots) {
    const lamp = makeStreetLamp();
    lamp.position.set(x, 0, z);
    scene.add(lamp);
  }

  // Vending machines + street trees for daytime colour.
  for (const [x, z] of [[inner - 1, inner - 1], [-(inner - 1), -(inner - 1)]] as const) {
    const vm = makeVendingMachine();
    vm.position.set(x, 0, z);
    vm.rotation.y = Math.random() * Math.PI;
    scene.add(vm);
  }
  for (const [x, z] of [[inner, -2], [-inner, 2], [2, inner], [-2, -inner]] as const) {
    const tree = makeTree();
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  return { colliders, update: () => {} };
}
