import * as THREE from "three";
import { LANDMARKS, type LandmarkData, type LandmarkShape } from "./PortfolioData";

const TRIGGER_RADIUS = 3.4;

function buildShape(shape: LandmarkShape, color: number): THREE.Object3D {
  const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const group = new THREE.Group();

  switch (shape) {
    case "monument": {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), material);
      base.position.y = 0.25;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4), material);
      spire.position.y = 1.8;
      spire.rotation.y = Math.PI / 4;
      group.add(base, spire);
      break;
    }
    case "stack": {
      const sizes = [1.6, 1.2, 0.8];
      let y = 0;
      sizes.forEach((size, i) => {
        const h = 0.7;
        y += h / 2;
        const block = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), material);
        block.position.y = y;
        block.rotation.y = i * 0.3;
        group.add(block);
        y += h / 2;
      });
      break;
    }
    case "gear": {
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 8), material);
      lower.position.y = 0.25;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 8), material);
      upper.position.y = 1.05;
      upper.rotation.y = Math.PI / 8;
      group.add(lower, upper);
      break;
    }
    case "tower": {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 6), material);
      pole.position.y = 1.5;
      const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material);
      beacon.position.y = 3.1;
      group.add(pole, beacon);
      break;
    }
  }

  return group;
}

export class Landmark {
  readonly data: LandmarkData;
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  private beacon: THREE.Object3D;
  private ring: THREE.Mesh;

  constructor(data: LandmarkData) {
    this.data = data;
    this.position = new THREE.Vector3(data.position[0], 0, data.position[1]);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    this.beacon = buildShape(data.shape, data.color);
    this.group.add(this.beacon);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(TRIGGER_RADIUS - 0.15, TRIGGER_RADIUS, 24),
      new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.group.add(this.ring);
  }

  distanceTo(point: THREE.Vector3): number {
    return Math.hypot(this.position.x - point.x, this.position.z - point.z);
  }

  update(time: number): void {
    this.beacon.position.y = 0.15 + Math.sin(time * 1.6 + this.position.x) * 0.08;
    this.beacon.rotation.y = time * 0.6;
    const pulse = 1 + Math.sin(time * 2) * 0.05;
    this.ring.scale.setScalar(pulse);
  }
}

export class LandmarkManager {
  readonly landmarks: Landmark[];

  constructor(scene: THREE.Scene) {
    this.landmarks = LANDMARKS.map((data) => new Landmark(data));
    for (const landmark of this.landmarks) {
      scene.add(landmark.group);
    }
  }

  update(time: number, carPosition: THREE.Vector3): Landmark | null {
    let nearest: Landmark | null = null;
    let nearestDist = Infinity;

    for (const landmark of this.landmarks) {
      landmark.update(time);
      const dist = landmark.distanceTo(carPosition);
      if (dist < TRIGGER_RADIUS && dist < nearestDist) {
        nearest = landmark;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  get avoidPoints(): Array<[number, number]> {
    return this.landmarks.map((l) => l.data.position);
  }
}
