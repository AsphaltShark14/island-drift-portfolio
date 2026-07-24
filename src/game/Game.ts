import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Input } from "./Input";
import { Car } from "./Car";
import { createWorld, type WorldResult, type AABB, type Wall } from "./World";
import { createIslandWorld, type IslandWorld } from "./IslandWorld";
import { LandmarkManager } from "./Landmarks";
import { IslandMarkers } from "./IslandMarkers";
import { UIOverlay } from "./UIOverlay";
import { Compass, type CompassTarget } from "./Compass";
import type { LandmarkData } from "./PortfolioData";

/** Anything that reports the active portfolio stop near the car. */
interface MarkerSource {
  update(time: number, carPosition: THREE.Vector3): { data: LandmarkData } | null;
  getAll(): CompassTarget[];
}

// Which map to load. The procedural circuit stays available for comparison.
const USE_ISLAND = true;
// Live x/z readout in the HUD, for scouting landmark coordinates while driving.
const SHOW_COORDS = false;

const SKY_COLOR = 0x9ec9e8; // daytime sky
const PIXEL_SCALE = 0.85; // low-res render upscaled for a retro pixelated look
const ISO_OFFSET = new THREE.Vector3(1, 1, 1).multiplyScalar(30);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private input = new Input();
  private ui = new UIOverlay();

  private coordsEl = document.getElementById("coords");
  private car?: Car;
  private world?: WorldResult; // circuit mode
  private island?: IslandWorld; // island mode
  private landmarks?: MarkerSource;
  private compass?: Compass;
  private colliders: AABB[] = [];
  private walls: Wall[] = [];

  private viewSize = USE_ISLAND ? 22 : 24;
  private ready = false;
  private cameraTarget = new THREE.Vector3();
  private spawn = { x: 0, z: 0, heading: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 40, 140);

    this.camera = new THREE.OrthographicCamera();

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6b5a45, 1.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.0);
    sun.position.set(18, 30, 12);
    this.scene.add(sun);

    // Post-processing: a gentle bloom so lights/signage pop without washing out.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.15, 0.3, 0.9);
    this.composer.addPass(this.bloom);

    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();

    void this.init();
  }

  private async init(): Promise<void> {
    if (USE_ISLAND) {
      this.island = await createIslandWorld(this.scene);
      this.scene.fog = new THREE.Fog(SKY_COLOR, this.island.radius * 0.7, this.island.radius * 2.4);

      this.spawn = this.island.spawn;
      this.car = new Car(this.scene);
      this.car.setGroundSampler(this.island.sampleGround);
      this.car.setWallChecker(this.island.checkWall);
      this.car.resetTo(this.spawn.x, this.spawn.z, this.spawn.heading);
      this.landmarks = new IslandMarkers(this.scene, this.island.sampleGround);
    } else {
      this.world = createWorld(this.scene);
      this.landmarks = new LandmarkManager(this.scene, this.world.anchors);
      this.colliders = this.world.colliders;
      this.walls = this.world.walls;

      this.spawn = this.world.spawn;
      this.car = new Car(this.scene);
      this.car.resetTo(this.spawn.x, this.spawn.z, this.spawn.heading);
    }

    this.compass = new Compass(this.landmarks.getAll());

    this.cameraTarget.copy(this.car.position);
    this.updateCameraPosition();
    this.ready = true;
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // --- Dev/testing helpers (stripped from production builds) --------------
  placeCar(x: number, z: number, heading = 0): void {
    this.car?.resetTo(x, z, heading);
  }
  carX(): number {
    return this.car?.position.x ?? 0;
  }
  carZ(): number {
    return this.car?.position.z ?? 0;
  }
  carY(): number {
    return this.car?.position.y ?? 0;
  }
  isReady(): boolean {
    return this.ready;
  }
  debugSample(x: number, z: number): number | null {
    return this.island ? this.island.sampleGround(x, z) : null;
  }
  debugRadius(): number {
    return this.island?.radius ?? 0;
  }
  debugWall(dx: number, dz: number, dist: number): boolean {
    if (!this.island || !this.car) return false;
    return this.island.checkWall(this.car.position.x, this.car.position.y + 0.55, this.car.position.z, dx, dz, dist);
  }
  debugSurfaces(): { top: number | null; atCar: number | null; y: number } {
    const x = this.carX();
    const z = this.carZ();
    const y = this.carY();
    return {
      top: this.island ? this.island.sampleGround(x, z) : null,
      atCar: this.island ? this.island.sampleGround(x, z, y) : null,
      y: +y.toFixed(2),
    };
  }
  debugAnchors(): Array<{ x: number; z: number; rot: number }> {
    return this.world?.anchors ?? [];
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    if (this.ready && this.car) {
      if (this.input.consumeReset()) {
        this.car.resetTo(this.spawn.x, this.spawn.z, this.spawn.heading);
        this.cameraTarget.copy(this.car.position);
      }
      this.car.update(dt, this.input.getState(), this.colliders, this.walls);
      this.world?.update(time);

      this.cameraTarget.lerp(this.car.position, 1 - Math.pow(0.0015, dt));
      this.updateCameraPosition();

      const active = this.landmarks?.update(time, this.car.position) ?? null;
      if (active) this.ui.show(active.data.id, active.data.title, active.data.html);
      else this.ui.hide();

      if (this.landmarks) this.compass?.update(this.camera, this.landmarks.getAll());

      if (SHOW_COORDS && this.coordsEl) {
        const p = this.car.position;
        this.coordsEl.textContent = `x: ${p.x.toFixed(1)}   z: ${p.z.toFixed(1)}`;
      }
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

    this.camera.left = (-this.viewSize * aspect) / 2;
    this.camera.right = (this.viewSize * aspect) / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.near = 0.1;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();

    const rw = Math.floor(width * PIXEL_SCALE);
    const rh = Math.floor(height * PIXEL_SCALE);
    this.renderer.setSize(rw, rh, false);
    this.composer.setSize(rw, rh);
    this.bloom.resolution.set(rw, rh);
  }
}
