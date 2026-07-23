import * as THREE from "three";
import type { InputState } from "./Input";
import { MAP_HALF_SIZE } from "./PortfolioData";

const MAX_SPEED_FORWARD = 11;
const MAX_SPEED_REVERSE = -4.5;
const ACCEL = 16;
const FRICTION = 8;
const BASE_TURN_RATE = 2.6;
const WHEEL_RADIUS = 0.28;
const BOUND = MAP_HALF_SIZE - 1.5;

export class Car {
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector3(0, 0, 6);
  heading = Math.PI;
  speed = 0;

  private wheels: THREE.Mesh[] = [];

  constructor(bodyColor = 0xe0483e) {
    this.mesh = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.45, 2),
      new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true }),
    );
    body.position.y = 0.45;
    this.mesh.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.4, 1),
      new THREE.MeshLambertMaterial({ color: 0x9fe3ff, flatShading: true }),
    );
    cabin.position.set(0, 0.85, -0.15);
    this.mesh.add(cabin);

    const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 8);
    wheelGeometry.rotateZ(Math.PI / 2); // axle now lies along local X, so spin is a pure rotation.x
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x1c1c1c, flatShading: true });
    const wheelOffsets: Array<[number, number]> = [
      [0.6, 0.7],
      [-0.6, 0.7],
      [0.6, -0.7],
      [-0.6, -0.7],
    ];
    for (const [x, z] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, WHEEL_RADIUS, z);
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
  }

  update(dt: number, input: InputState): void {
    if (input.forward) {
      this.speed = Math.min(this.speed + ACCEL * dt, MAX_SPEED_FORWARD);
    } else if (input.backward) {
      this.speed = Math.max(this.speed - ACCEL * dt, MAX_SPEED_REVERSE);
    } else if (this.speed > 0) {
      this.speed = Math.max(this.speed - FRICTION * dt, 0);
    } else if (this.speed < 0) {
      this.speed = Math.min(this.speed + FRICTION * dt, 0);
    }

    const turnFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 3, 0, 1);
    const turnDirection = this.speed >= 0 ? 1 : -1;
    if (input.left) this.heading += BASE_TURN_RATE * dt * turnFactor * turnDirection;
    if (input.right) this.heading -= BASE_TURN_RATE * dt * turnFactor * turnDirection;

    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -BOUND, BOUND);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -BOUND, BOUND);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;

    const wheelSpin = (this.speed * dt) / WHEEL_RADIUS;
    for (const wheel of this.wheels) {
      wheel.rotation.x += wheelSpin;
    }
  }
}
