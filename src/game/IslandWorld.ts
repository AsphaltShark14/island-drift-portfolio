import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

// Accelerate raycasts against the (large) island mesh with a BVH.
/* eslint-disable @typescript-eslint/no-explicit-any */
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;
/* eslint-enable @typescript-eslint/no-explicit-any */

// The GLB is ~1132 units wide at its authored scale; shrink it to a
// workable size relative to the car. Larger = roomier roads / more
// overpass clearance and a proportionally smaller car.
const ISLAND_SCALE = 0.24;
// BASE_URL accounts for deployments served from a subpath (e.g. GitHub Pages
// project sites at username.github.io/repo-name/).
const MODEL_URL = `${import.meta.env.BASE_URL}models/pier-island/pier-island.glb`;

export interface IslandWorld {
  /**
   * Ground height under (x,z), or null if off the island (over water/void).
   * Pass `refY` (the car's current height) so overhead structures — billboards,
   * the elevated interchange — are skipped and the road below is returned.
   */
  sampleGround: (x: number, z: number, refY?: number) => number | null;
  /**
   * True if a vertical surface (building wall, railing, etc.) blocks travel
   * from (x, y, z) toward (dx, dz) within `dist`. `y` should sit just above
   * the road so flat ground/curbs/ramps aren't mistaken for a wall.
   */
  checkWall: (x: number, y: number, z: number, dx: number, dz: number, dist: number) => boolean;
  spawn: { x: number; z: number; heading: number };
  /** Horizontal radius of the map from origin (for fog/limits). */
  radius: number;
}

// How far above the car's current height a surface may be and still count as
// "the ground here" — bigger than curbs/ramps, smaller than overpass clearance.
const SURFACE_CEIL = 1.3;

export async function createIslandWorld(scene: THREE.Scene): Promise<IslandWorld> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  const root = gltf.scene;
  root.scale.multiplyScalar(ISLAND_SCALE);
  root.updateMatrixWorld(true);

  // The glTF mesh has many primitives → GLTFLoader makes many child meshes.
  // BVH every one and raycast against all of them for ground/wall queries —
  // except decorative overhead structures (solar-panel parking canopies and
  // their ceiling underside), which have no gameplay floor of their own and
  // would otherwise let the car climb their sloped edge onto the roof deck
  // instead of driving underneath. They still render normally via `root`;
  // they're just invisible to the driving raycasts.
  const NON_TRAVERSABLE = /solar panel|panelgen|grid ceiling/i;
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const matName = (m.material as THREE.Material)?.name ?? "";
    if (NON_TRAVERSABLE.test(matName)) return; // renders via `root`, skipped by raycasts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m.geometry as any).computeBoundsTree();
    meshes.push(m);
  });
  if (meshes.length === 0) throw new Error("Pier Island meshes not found in GLB");

  // Recenter the map horizontally on the origin.
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);

  scene.add(root);

  // Spawn from the author's "avatar-here" marker node.
  const avatar = root.getObjectByName("avatar-here");
  const spawnPos = new THREE.Vector3();
  if (avatar) avatar.getWorldPosition(spawnPos);

  // Ground raycaster (top-down), BVH-accelerated. We need ALL hits (not just
  // the first) so we can skip overhead structures, so firstHitOnly stays off.
  const raycaster = new THREE.Raycaster();
  raycaster.far = 600;
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const resolveAt = (x: number, z: number, refY: number): number | null => {
    origin.set(x, 250, z);
    raycaster.set(origin, down);
    const hits = raycaster.intersectObjects(meshes, false); // sorted top → bottom
    if (hits.length === 0) return null;
    if (refY === Infinity) return hits[0].point.y; // open-sky context (spawn, etc.)
    // Highest surface that isn't well above the car → the road under an overpass.
    for (const h of hits) {
      if (h.point.y <= refY + SURFACE_CEIL) return h.point.y;
    }
    return hits[hits.length - 1].point.y; // everything is overhead → lowest surface
  };

  // Sampling a small cluster (not just the exact point) and taking the
  // lowest resolved height makes this robust against thin vertical spikes —
  // a lamp post or canopy support pole caught by a single ray — which would
  // otherwise register as a moment of "ground" well above the real pavement.
  // A genuinely raised, walkable area (ramp, roof deck) reads elevated at
  // every offset, so it's unaffected.
  const CLUSTER_OFFSETS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0.35, 0],
    [-0.35, 0],
    [0, 0.35],
    [0, -0.35],
  ];
  const sampleGround = (x: number, z: number, refY = Infinity): number | null => {
    if (refY === Infinity) return resolveAt(x, z, refY);
    let best: number | null = null;
    for (const [dx, dz] of CLUSTER_OFFSETS) {
      const h = resolveAt(x + dx, z + dz, refY);
      if (h !== null && (best === null || h < best)) best = h;
    }
    return best;
  };

  // Horizontal raycaster for wall detection — a separate instance/vectors so
  // it never interferes with the vertical ground raycaster above.
  const wallRaycaster = new THREE.Raycaster();
  const wallOrigin = new THREE.Vector3();
  const wallDir = new THREE.Vector3();
  const checkWall = (x: number, y: number, z: number, dx: number, dz: number, dist: number): boolean => {
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return false;
    wallOrigin.set(x, y, z);
    wallDir.set(dx / len, 0, dz / len);
    wallRaycaster.set(wallOrigin, wallDir);
    wallRaycaster.far = dist;
    const hits = wallRaycaster.intersectObjects(meshes, false);
    return hits.length > 0;
  };

  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) / 2;

  return {
    sampleGround,
    checkWall,
    spawn: { x: spawnPos.x, z: spawnPos.z, heading: Math.PI },
    radius,
  };
}
