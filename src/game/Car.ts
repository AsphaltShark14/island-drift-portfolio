import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { InputState } from "./Input";
import type { AABB } from "./World";

// --- Tuning -------------------------------------------------------------
const MAX_SPEED = 20;
const MAX_REVERSE = 7;
const ENGINE_ACCEL = 26;
const BRAKE_ACCEL = 34;
const ROLL_DRAG = 0.9; // passive slowdown per second (fraction)
const STEER_RATE = 2.7; // rad/s at full speed authority
const GRIP_NORMAL = 7.5; // lateral velocity killed fast → holds its line
const GRIP_DRIFT = 1.1; // handbrake/power slide → rear steps out
const DRIFT_SLIP_THRESHOLD = 3.2; // |lateral speed| above which tyres smoke
const TARGET_LENGTH = 2.2; // world units the loaded model is scaled to
const CAR_RADIUS = 0.95; // collision circle
const WHEEL_SPIN_RADIUS = 0.28;

export class Car {
  readonly mesh: THREE.Group;
  readonly position = new THREE.Vector3(-10, 0, -14); // on the south ring road
  heading = Math.PI / 2; // facing east along the road

  /** World-space ground velocity (x, z). */
  private velocity = new THREE.Vector2(0, 0);
  private forward = new THREE.Vector2(0, 0);
  private right = new THREE.Vector2(0, 0);

  private modelPivot = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private smoke: SmokeSystem;

  /** Signed forward speed, for camera shake / HUD. */
  get speed(): number {
    return this.velocity.dot(this.forward);
  }

  /** How sideways the car is travelling right now (drift intensity). */
  get lateralSpeed(): number {
    return Math.abs(this.velocity.dot(this.right));
  }

  get isDrifting(): boolean {
    return this.lateralSpeed > DRIFT_SLIP_THRESHOLD;
  }

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.mesh.add(this.modelPivot);

    // Procedural fallback shows instantly; GLB swaps in when it loads.
    this.buildFallback();
    void this.loadModel();

    this.smoke = new SmokeSystem(scene);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
  }

  /** Zero the car's momentum (used when teleporting for tests). */
  halt(): void {
    this.velocity.set(0, 0);
  }

  update(dt: number, input: InputState, colliders: AABB[]): void {
    // Local axes from heading (matches sin/cos forward convention).
    this.forward.set(Math.sin(this.heading), Math.cos(this.heading));
    this.right.set(Math.cos(this.heading), -Math.sin(this.heading));

    let vLong = this.velocity.dot(this.forward);
    let vLat = this.velocity.dot(this.right);

    // --- Engine / brakes ---
    if (input.forward) {
      vLong = Math.min(vLong + ENGINE_ACCEL * dt, MAX_SPEED);
    } else if (input.backward) {
      vLong = Math.max(vLong - BRAKE_ACCEL * dt, -MAX_REVERSE);
    } else {
      vLong -= vLong * ROLL_DRAG * dt;
    }

    // --- Steering (authority scales with speed, flips in reverse) ---
    const speedFactor = THREE.MathUtils.clamp(Math.abs(vLong) / 6, 0, 1);
    const dirSign = vLong >= 0 ? 1 : -1;
    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;
    this.heading += steer * STEER_RATE * dt * speedFactor * dirSign;

    // --- Grip: how fast lateral velocity bleeds off ---
    // Handbrake, or power-sliding into a hard turn, lowers grip → drift.
    const powerSlide = input.forward && Math.abs(steer) > 0 && Math.abs(vLong) > 12;
    const grip = input.handbrake || powerSlide ? GRIP_DRIFT : GRIP_NORMAL;
    vLat -= vLat * Math.min(grip * dt, 1);

    // Recompose world velocity.
    this.velocity
      .copy(this.forward)
      .multiplyScalar(vLong)
      .addScaledVector(this.right, vLat);

    // Integrate + resolve collisions against buildings.
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.y * dt;
    this.resolveCollisions(colliders);

    // --- Visuals ---
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;

    const spin = (vLong * dt) / WHEEL_SPIN_RADIUS;
    for (const wheel of this.wheels) wheel.rotation.x += spin;

    this.smoke.update(dt);
    if (this.isDrifting && Math.abs(vLong) > 2) {
      this.smoke.emit(this.position, this.right);
    }
  }

  // --- Collision: car as a circle vs building AABBs -----------------------
  private resolveCollisions(colliders: AABB[]): void {
    for (const box of colliders) {
      const cx = THREE.MathUtils.clamp(this.position.x, box.minX, box.maxX);
      const cz = THREE.MathUtils.clamp(this.position.z, box.minZ, box.maxZ);
      const dx = this.position.x - cx;
      const dz = this.position.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= CAR_RADIUS * CAR_RADIUS) continue;

      let nx: number;
      let nz: number;
      let push: number;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        nx = dx / dist;
        nz = dz / dist;
        push = CAR_RADIUS - dist;
      } else {
        // Center inside the box — push out along the nearest face.
        const toLeft = this.position.x - box.minX;
        const toRight = box.maxX - this.position.x;
        const toBack = this.position.z - box.minZ;
        const toFront = box.maxZ - this.position.z;
        const min = Math.min(toLeft, toRight, toBack, toFront);
        nx = min === toLeft ? -1 : min === toRight ? 1 : 0;
        nz = min === toBack ? -1 : min === toFront ? 1 : 0;
        push = CAR_RADIUS + min;
      }

      this.position.x += nx * push;
      this.position.z += nz * push;

      // Kill the velocity component going into the wall (slide along it).
      const into = this.velocity.x * nx + this.velocity.y * nz;
      if (into < 0) {
        this.velocity.x -= into * nx;
        this.velocity.y -= into * nz;
      }
    }
  }

  // --- Model --------------------------------------------------------------
  private buildFallback(): void {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, flatShading: true, metalness: 0.1, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: 0x223244, flatShading: true, metalness: 0.3, roughness: 0.2 });

    // Long low hood + hatch cabin = AE86-ish silhouette.
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.4, 2.2), paint);
    lower.position.y = 0.45;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.9), paint);
    hood.position.set(0, 0.68, 0.6);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.95), glass);
    cabin.position.set(0, 0.82, -0.25);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.22), dark);
    spoiler.position.set(0, 0.9, -1.05);
    group.add(lower, hood, cabin, spoiler);

    const wheelGeo = new THREE.CylinderGeometry(WHEEL_SPIN_RADIUS, WHEEL_SPIN_RADIUS, 0.26, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [[0.58, 0.72], [-0.58, 0.72], [0.58, -0.72], [-0.58, -0.72]] as const) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.position.set(x, WHEEL_SPIN_RADIUS, z);
      group.add(wheel);
      this.wheels.push(wheel);
    }

    this.addLampsAndLights(group);
    this.setModel(group);
  }

  private async loadModel(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync("/models/ae86.glb");
      const root = gltf.scene;

      // Drop any baked camera/light nodes from the export.
      root.traverse((o) => {
        if ((o as THREE.Camera).isCamera) o.visible = false;
      });

      const normalized = this.normalizeModel(root);

      // Grab wheels for spinning; give the body a night-friendly finish.
      const wheels: THREE.Object3D[] = [];
      normalized.traverse((o) => {
        if (/wheel/i.test(o.name)) wheels.push(o);
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && "metalness" in mat) {
            mat.metalness = 0.2;
            mat.roughness = 0.55;
          }
        }
      });

      this.addLampsAndLights(normalized);
      this.wheels = wheels.length ? wheels : this.wheels;
      this.setModel(normalized);
    } catch (err) {
      // Keep the procedural fallback already on screen.
      console.warn("AE86 model failed to load, using fallback car:", err);
    }
  }

  /** Center on ground, scale to TARGET_LENGTH, orient length along +Z. */
  private normalizeModel(root: THREE.Object3D): THREE.Group {
    const pivot = new THREE.Group();
    pivot.add(root);

    let box = new THREE.Box3().setFromObject(root);
    let size = box.getSize(new THREE.Vector3());

    // If the model was authored Z-up (height is a horizontal axis), lay it flat.
    if (size.y < size.z * 0.6 && size.z > size.x) {
      // already Y-up with length on Z — fine
    } else if (size.y > size.x && size.y > size.z) {
      root.rotation.x = -Math.PI / 2;
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
    }

    // Orient the longer horizontal axis to Z (car forward).
    if (size.x > size.z) {
      root.rotation.y += Math.PI / 2;
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
    }

    const length = Math.max(size.x, size.z);
    const scale = TARGET_LENGTH / length;
    pivot.scale.setScalar(scale);

    // Recenter x/z and drop onto the ground (y=0) after scaling.
    box = new THREE.Box3().setFromObject(pivot);
    const center = box.getCenter(new THREE.Vector3());
    pivot.position.x -= center.x;
    pivot.position.z -= center.z;
    pivot.position.y -= box.min.y;

    return pivot;
  }

  private addLampsAndLights(group: THREE.Object3D): void {
    const tail = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff2233, emissiveIntensity: 2.2 });
    const head = new THREE.MeshStandardMaterial({ color: 0xfff6d5, emissive: 0xfff6d5, emissiveIntensity: 2.0 });
    for (const dx of [-0.38, 0.38]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.06), tail);
      t.position.set(dx, 0.5, -1.08);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), head);
      h.position.set(dx, 0.5, 1.08);
      group.add(t, h);
    }
  }

  private setModel(model: THREE.Object3D): void {
    this.modelPivot.clear();
    this.modelPivot.add(model);
  }
}

// --- Tyre smoke: a small pool of fading sprites -------------------------
class SmokeSystem {
  private sprites: THREE.Sprite[] = [];
  private life: number[] = [];
  private next = 0;
  private cooldown = 0;
  private static readonly MAX = 44;

  constructor(scene: THREE.Scene) {
    const material = new THREE.SpriteMaterial({
      map: makeSmokeTexture(),
      color: 0xcfd6e0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < SmokeSystem.MAX; i++) {
      const sprite = new THREE.Sprite(material.clone());
      sprite.visible = false;
      sprite.scale.setScalar(0.6);
      scene.add(sprite);
      this.sprites.push(sprite);
      this.life.push(0);
    }
  }

  emit(position: THREE.Vector3, right: THREE.Vector2): void {
    if (this.cooldown > 0) return;
    this.cooldown = 0.03;
    // Puff behind each rear wheel.
    for (const side of [-1, 1]) {
      const sprite = this.sprites[this.next];
      sprite.position.set(
        position.x + right.x * 0.5 * side,
        0.25,
        position.z + right.y * 0.5 * side,
      );
      sprite.scale.setScalar(0.5 + Math.random() * 0.3);
      (sprite.material as THREE.SpriteMaterial).opacity = 0.55;
      sprite.visible = true;
      this.life[this.next] = 0.7;
      this.next = (this.next + 1) % SmokeSystem.MAX;
    }
  }

  update(dt: number): void {
    this.cooldown -= dt;
    for (let i = 0; i < this.sprites.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const sprite = this.sprites[i];
      const t = Math.max(this.life[i], 0) / 0.7;
      (sprite.material as THREE.SpriteMaterial).opacity = t * 0.55;
      sprite.scale.setScalar(sprite.scale.x + dt * 1.2);
      sprite.position.y += dt * 0.4;
      if (this.life[i] <= 0) sprite.visible = false;
    }
  }
}

function makeSmokeTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
