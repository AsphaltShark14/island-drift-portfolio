import * as THREE from "three";
import { Input } from "./Input";
import { Car } from "./Car";
import { createGround, createProps } from "./World";
import { LandmarkManager } from "./Landmarks";
import { UIOverlay } from "./UIOverlay";

const SKY_COLOR = 0x1b1f3b;
const VIEW_SIZE = 15;
const PIXEL_SCALE = 0.4;
const ISO_OFFSET = new THREE.Vector3(1, 1, 1).multiplyScalar(20);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private input = new Input();
  private car = new Car();
  private landmarks: LandmarkManager;
  private ui = new UIOverlay();
  private cameraTarget = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);

    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 24, 52);

    this.camera = new THREE.OrthographicCamera();
    this.cameraTarget.copy(this.car.position);
    this.updateCameraPosition();

    const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x2a2a1a, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.2);
    sun.position.set(15, 25, 10);
    this.scene.add(sun);

    this.scene.add(createGround());
    this.landmarks = new LandmarkManager(this.scene);
    this.scene.add(createProps(this.landmarks.avoidPoints));
    this.scene.add(this.car.mesh);

    window.addEventListener("resize", () => this.handleResize());
    this.handleResize();
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    this.car.update(dt, this.input.getState());

    this.cameraTarget.lerp(this.car.position, 1 - Math.pow(0.001, dt));
    this.updateCameraPosition();

    const active = this.landmarks.update(time, this.car.position);
    if (active) {
      this.ui.show(active.data.id, active.data.title, active.data.html);
    } else {
      this.ui.hide();
    }

    this.renderer.render(this.scene, this.camera);
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
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width * PIXEL_SCALE, height * PIXEL_SCALE, false);
  }
}
