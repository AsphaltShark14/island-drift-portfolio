import * as THREE from "three";
import { LANDMARKS, type LandmarkData } from "./PortfolioData";

const TRIGGER_RADIUS = 6;
const PIN_HEIGHT = 4;

interface IslandMarker {
  data: LandmarkData;
  position: THREE.Vector3;
  ring: THREE.Mesh;
  pin: THREE.Group;
}

/** Scan the island for drivable ground and spread N points across it. */
function pickSpreadPoints(
  sample: (x: number, z: number) => number | null,
  radius: number,
  count: number,
): THREE.Vector3[] {
  const valid: THREE.Vector3[] = [];
  const step = Math.max(2, (radius * 2) / 60);
  for (let x = -radius; x <= radius; x += step) {
    for (let z = -radius; z <= radius; z += step) {
      const y = sample(x, z);
      if (y !== null && y > -1 && y < 0.9) valid.push(new THREE.Vector3(x, y, z));
    }
  }
  if (valid.length === 0) return [];

  // Farthest-point sampling for an even spread across the islands.
  const chosen: THREE.Vector3[] = [];
  let seed = valid[0];
  for (const p of valid) if (p.x < seed.x) seed = p; // start at the far end
  chosen.push(seed);
  while (chosen.length < count && chosen.length < valid.length) {
    let best: THREE.Vector3 | null = null;
    let bestDist = -1;
    for (const p of valid) {
      let nearest = Infinity;
      for (const c of chosen) nearest = Math.min(nearest, p.distanceToSquared(c));
      if (nearest > bestDist) {
        bestDist = nearest;
        best = p;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
}

export class IslandMarkers {
  private markers: IslandMarker[] = [];

  constructor(
    scene: THREE.Scene,
    sample: (x: number, z: number) => number | null,
    radius: number,
  ) {
    const points = pickSpreadPoints(sample, radius, LANDMARKS.length);
    LANDMARKS.forEach((data, i) => {
      const p = points[i] ?? points[points.length - 1];
      if (!p) return;

      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3, 44),
        new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);

      // Floating beacon: a tall pillar of light + a downward pin.
      const pin = new THREE.Group();
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, PIN_HEIGHT, 8),
        new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.35 }),
      );
      pillar.position.y = PIN_HEIGHT / 2;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 1.1, 4),
        new THREE.MeshStandardMaterial({ color: data.color, emissive: data.color, emissiveIntensity: 0.6 }),
      );
      cone.rotation.x = Math.PI;
      cone.position.y = PIN_HEIGHT + 0.6;
      pin.add(pillar, cone);
      group.add(pin);

      scene.add(group);
      this.markers.push({ data, position: new THREE.Vector3(p.x, p.y, p.z), ring, pin });
    });
  }

  update(time: number, carPosition: THREE.Vector3): { data: LandmarkData } | null {
    let nearest: IslandMarker | null = null;
    let nearestDist = Infinity;
    for (const m of this.markers) {
      // Bob + spin the beacon.
      m.pin.rotation.y = time * 1.2;
      m.ring.scale.setScalar(1 + Math.sin(time * 2.4) * 0.06);
      const dist = Math.hypot(m.position.x - carPosition.x, m.position.z - carPosition.z);
      if (dist < TRIGGER_RADIUS && dist < nearestDist) {
        nearest = m;
        nearestDist = dist;
      }
    }
    return nearest;
  }
}
