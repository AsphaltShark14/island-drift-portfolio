import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Input } from "./Input";
import { Car } from "./Car";
import { createWorld, type WorldResult, type AABB } from "./World";
import { LandmarkManager } from "./Landmarks";
import { UIOverlay } from "./UIOverlay";

const SKY_COLOR = 0x9ec9e8; // daytime Tokyo sky
const VIEW_SIZE = 24;
const PIXEL_SCALE = 0.5; // low-res render upscaled for a retro pixelated look
const ISO_OFFSET = new THREE.Vector3(1, 1, 1).multiplyScalar(26);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private input = new Input();
  private car: Car;
  private world: WorldResult;
  private landmarks: LandmarkManager;
  private ui = new UIOverlay();
  private colliders: AABB[];
  private cameraTarget = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 30, 72);

    this.camera = new THREE.OrthographicCamera();

    // Daytime: bright sky fill + warm directional sun for clean flat-shaded look.
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6b5a45, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.7);
    sun.position.set(18, 30, 12);
    this.scene.add(sun);

    // World first (roads, buildings), then landmarks add their colliders.
    this.world = createWorld(this.scene);
    this.landmarks = new LandmarkManager(this.scene);
    this.colliders = [...this.world.colliders, ...this.landmarks.colliders];

    this.car = new Car(this.scene);
    this.cameraTarget.copy(this.car.position);
    this.updateCameraPosition();

    // Post-processing: a gentle bloom so signage/lights pop without washing out.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // strength, radius, threshold — high threshold so only the brightest bits bloom.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.3, 0.9);
    this.composer.addPass(this.bloom);

    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** Dev/testing helper: drop the car at a spot and stop it. */
  placeCar(x: number, z: number, heading = 0): void {
    this.car.position.set(x, 0, z);
    this.car.heading = heading;
    this.car.halt();
  }

  /** Dev/testing helper: current car x/z. */
  carX(): number {
    return this.car.position.x;
  }
  carZ(): number {
    return this.car.position.z;
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    this.car.update(dt, this.input.getState(), this.colliders);
    this.world.update(time);

    this.cameraTarget.lerp(this.car.position, 1 - Math.pow(0.0015, dt));
    this.updateCameraPosition();

    const active = this.landmarks.update(time, this.car.position);
    if (active) {
      this.ui.show(active.data.id, active.data.title, active.data.html);
    } else {
      this.ui.hide();
    }

    this.composer.render();
  }

  private updateCameraPosition(): void {
    this.camera.position.copy(this.cameraTarget).add(ISO_OFFSET);
    this.camera.lookAt(this.cameraTarget);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.camera.left = (-VIEW_SIZE * aspect) / 2;
    this.camera.right = (VIEW_SIZE * aspect) / 2;
    this.camera.top = VIEW_SIZE / 2;
    this.camera.bottom = -VIEW_SIZE / 2;
    this.camera.near = 0.1;
    this.camera.far = 120;
    this.camera.updateProjectionMatrix();

    const rw = Math.floor(width * PIXEL_SCALE);
    const rh = Math.floor(height * PIXEL_SCALE);
    this.renderer.setSize(rw, rh, false);
    this.composer.setSize(rw, rh);
    this.bloom.resolution.set(rw, rh);
  }
}
