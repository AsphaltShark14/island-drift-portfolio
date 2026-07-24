import * as THREE from "three";
import { LANDMARKS, type LandmarkData, type LandmarkKind } from "./PortfolioData";
import type { Anchor } from "./World";
import type { CompassTarget } from "./Compass";

// --- Themed building builders -------------------------------------------
// Each builds a themed building around the local origin, with its front
// (+Z) facing the road; the Landmark places/rotates it at a track anchor.

interface Built {
  group: THREE.Group;
}

// Daytime: mostly solid colour with just a hint of emissive so signage
// catches the light bloom without glowing like night neon.
function emissive(color: number, intensity = 0.25): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
}

function concrete(color = 0x4a4d55): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
}

function marquee(color: number, w: number, h: number): THREE.Mesh {
  // A flat glowing sign panel.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), emissive(color, 0.35));
  return mesh;
}

function buildCafe(data: LandmarkData): Built {
  const g = new THREE.Group();
  const [w, d] = data.footprint;
  const h = 4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete(0x8a5a3c));
  body.position.y = h / 2;
  g.add(body);

  // Warm shopfront windows.
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, 1.6), emissive(0xffcf87, 0.3));
  front.position.set(0, 1.1, d / 2 + 0.02);
  g.add(front);

  // Striped awning.
  const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.15, 1.1), emissive(data.color, 0.25));
  awning.position.set(0, 2.2, d / 2 + 0.45);
  awning.rotation.x = 0.25;
  g.add(awning);

  const sign = marquee(data.color, 2.4, 0.8);
  sign.position.set(0, 3.4, d / 2 + 0.03);
  g.add(sign);

  return { group: g };
}

function buildArcade(data: LandmarkData): Built {
  const g = new THREE.Group();
  const [w, d] = data.footprint;
  const h = 6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete(0x2f3548));
  body.position.y = h / 2;
  g.add(body);

  // Stacked signs up the facade.
  const colors = [0x2ee6ff, 0xff2e88, 0xffe14d, 0x8b5cff];
  for (let i = 0; i < 3; i++) {
    const sign = marquee(colors[i % colors.length], w * 0.7, 1.1);
    sign.position.set(0, 1.4 + i * 1.7, d / 2 + 0.03);
    g.add(sign);
    const side = marquee(colors[(i + 1) % colors.length], d * 0.6, 0.9);
    side.position.set(w / 2 + 0.03, 1.6 + i * 1.7, 0);
    side.rotation.y = Math.PI / 2;
    g.add(side);
  }
  return { group: g };
}

function buildWorkshop(data: LandmarkData): Built {
  const g = new THREE.Group();
  const [w, d] = data.footprint;
  const h = 3.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete(0x585c64));
  body.position.y = h / 2;
  g.add(body);

  // Roll-up door outlined in accent colour.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 2.6), concrete(0x0a0a0e));
  door.position.set(0, 1.3, d / 2 + 0.02);
  g.add(door);
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.5 + 0.2, 2.8),
    emissive(data.color, 0.4),
  );
  frame.position.set(0, 1.4, d / 2 + 0.01);
  g.add(frame);

  // Tyre stacks outside.
  const tyreMat = concrete(0x0c0c0c);
  for (const sx of [-w / 2 - 0.5, w / 2 + 0.5]) {
    for (let i = 0; i < 3; i++) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.16, 6, 10), tyreMat);
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(sx, 0.18 + i * 0.34, d / 2 - 0.5);
      g.add(tyre);
    }
  }

  const sign = marquee(data.color, 2.6, 0.7);
  sign.position.set(0, 3.4, d / 2 + 0.03);
  g.add(sign);
  return { group: g };
}

function buildGasStation(data: LandmarkData): Built {
  const g = new THREE.Group();
  const [w, d] = data.footprint;

  // Small shop box at the back (the only solid part — forecourt is drivable).
  const shopW = w * 0.5;
  const shopD = 2.2;
  const shop = new THREE.Mesh(new THREE.BoxGeometry(shopW, 3, shopD), concrete(0xdfe4ea));
  shop.position.set(0, 1.5, -d / 2 + shopD / 2);
  g.add(shop);
  const shopGlow = new THREE.Mesh(new THREE.PlaneGeometry(shopW * 0.85, 1.4), emissive(0xfff2cc, 0.25));
  shopGlow.position.set(0, 1.3, -d / 2 + shopD + 0.02);
  g.add(shopGlow);

  // Canopy on pillars over the forecourt.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d * 0.7), concrete(0xc4cad2));
  canopy.position.set(0, 3.4, d * 0.05);
  g.add(canopy);
  const strip = marquee(data.color, w, 0.3);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 3.28, d * 0.05);
  g.add(strip);
  const pillarMat = concrete(0x24242c);
  for (const px of [-w / 2 + 0.4, w / 2 - 0.4]) {
    for (const pz of [-d * 0.25, d * 0.35]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 6), pillarMat);
      pillar.position.set(px, 1.7, pz);
      g.add(pillar);
    }
  }

  // Two fuel pumps.
  for (const px of [-1.2, 1.2]) {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.7), concrete(0x0e0e12));
    pump.position.set(px, 0.6, d * 0.1);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), emissive(data.color, 0.4));
    glow.position.set(px, 0.85, d * 0.1 + 0.36);
    g.add(pump, glow);
  }

  const sign = marquee(data.color, 2.4, 0.9);
  sign.position.set(0, 4.4, -d / 2 + shopD);
  g.add(sign);

  return { group: g };
}

function buildOffice(data: LandmarkData): Built {
  const g = new THREE.Group();
  const [w, d] = data.footprint;
  const h = 7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete(0x4a5765));
  body.position.y = h / 2;
  g.add(body);

  // Window grid.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (Math.random() < 0.35) continue;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.7),
        emissive(Math.random() < 0.5 ? 0x9fd8ff : 0xffe6a8, 0.25),
      );
      win.position.set(-w / 2 + 0.8 + col * (w - 1.6) / 2, 1.2 + row * 1.2, d / 2 + 0.02);
      g.add(win);
    }
  }
  const crown = marquee(data.color, w * 0.9, 0.6);
  crown.position.set(0, h - 0.6, d / 2 + 0.03);
  g.add(crown);
  return { group: g };
}

const BUILDERS: Record<LandmarkKind, (d: LandmarkData) => Built> = {
  cafe: buildCafe,
  arcade: buildArcade,
  workshop: buildWorkshop,
  gas: buildGasStation,
  office: buildOffice,
};

// --- Landmark (building + trigger marker) --------------------------------
export class Landmark {
  readonly data: LandmarkData;
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly triggerRadius: number;

  private ring: THREE.Mesh;
  private pin: THREE.Group;

  constructor(data: LandmarkData, anchor: Anchor) {
    this.data = data;
    this.position = new THREE.Vector3(anchor.x, 0, anchor.z);

    const built = BUILDERS[data.kind](data);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.rotation.y = anchor.rot; // face the road
    this.group.add(built.group);

    // Trigger fires while passing on the road; ring is a tighter visual cue.
    const half = Math.max(data.footprint[0], data.footprint[1]) / 2;
    this.triggerRadius = half + 6.5;
    const ringRadius = half + 1.6;

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius - 0.25, ringRadius, 44),
      new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    // Floating rotating pin above the building — the wayfinding beacon.
    this.pin = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 4), emissive(data.color, 0.5));
    cone.rotation.x = Math.PI; // point down
    this.pin.add(cone);
    const pinHeight = data.kind === "office" ? 9 : data.kind === "arcade" ? 8 : 6;
    this.pin.position.y = pinHeight;
    this.group.add(this.pin);
  }

  distanceTo(point: THREE.Vector3): number {
    return Math.hypot(this.position.x - point.x, this.position.z - point.z);
  }

  update(time: number): void {
    this.pin.rotation.y = time * 1.2;
    const pulse = 1 + Math.sin(time * 2.4) * 0.05;
    this.ring.scale.setScalar(pulse);
  }
}

export class LandmarkManager {
  readonly landmarks: Landmark[];

  constructor(scene: THREE.Scene, anchors: Anchor[]) {
    this.landmarks = LANDMARKS.map((data, i) => new Landmark(data, anchors[i % anchors.length]));
    for (const landmark of this.landmarks) scene.add(landmark.group);
  }

  update(time: number, carPosition: THREE.Vector3): Landmark | null {
    let nearest: Landmark | null = null;
    let nearestDist = Infinity;
    for (const landmark of this.landmarks) {
      landmark.update(time);
      const dist = landmark.distanceTo(carPosition);
      if (dist < landmark.triggerRadius && dist < nearestDist) {
        nearest = landmark;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  getAll(): CompassTarget[] {
    return this.landmarks.map((l) => ({
      id: l.data.id,
      title: l.data.title,
      color: l.data.color,
      position: l.position,
    }));
  }
}
