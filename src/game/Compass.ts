import * as THREE from "three";

export interface CompassTarget {
  id: string;
  title: string;
  color: number;
  position: THREE.Vector3;
}

// Inset from the true screen edge so arrows never get clipped.
const EDGE_MARGIN = 36;

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Off-screen indicators for each landmark: a colored arrow pinned to the
 * screen edge, pointing toward whatever is currently out of view. Once a
 * landmark's marker is itself on-screen, its arrow hides — no need to point
 * at something you can already see. Also builds a color legend.
 */
export class Compass {
  private legendEl: HTMLElement;
  private compassEl: HTMLElement;
  private arrows = new Map<string, HTMLElement>();
  private ndc = new THREE.Vector3();

  constructor(targets: CompassTarget[]) {
    this.legendEl = document.getElementById("legend")!;
    this.compassEl = document.getElementById("compass")!;

    for (const t of targets) {
      const row = document.createElement("div");
      row.className = "legend-row";
      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = toHexColor(t.color);
      row.appendChild(dot);
      row.appendChild(document.createTextNode(t.title));
      this.legendEl.appendChild(row);

      const arrow = document.createElement("div");
      arrow.className = "compass-arrow";
      arrow.style.background = toHexColor(t.color);
      arrow.style.display = "none";
      this.compassEl.appendChild(arrow);
      this.arrows.set(t.id, arrow);
    }
  }

  update(camera: THREE.Camera, targets: CompassTarget[]): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cx = width / 2;
    const cy = height / 2;
    const halfW = width / 2 - EDGE_MARGIN;
    const halfH = height / 2 - EDGE_MARGIN;

    for (const t of targets) {
      const arrow = this.arrows.get(t.id);
      if (!arrow) continue;

      this.ndc.copy(t.position).project(camera);
      const onScreen =
        this.ndc.x >= -1 &&
        this.ndc.x <= 1 &&
        this.ndc.y >= -1 &&
        this.ndc.y <= 1 &&
        this.ndc.z >= -1 &&
        this.ndc.z <= 1;

      if (onScreen) {
        arrow.style.display = "none";
        continue;
      }

      const sx = cx + (this.ndc.x * width) / 2;
      const sy = cy - (this.ndc.y * height) / 2;
      const dx = sx - cx;
      const dy = sy - cy;

      let px = cx;
      let py = cy;
      if (dx !== 0 || dy !== 0) {
        const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
        const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
        const scale = Math.min(scaleX, scaleY);
        px = cx + dx * scale;
        py = cy + dy * scale;
      }

      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      arrow.style.display = "block";
      arrow.style.left = `${px}px`;
      arrow.style.top = `${py}px`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
    }
  }
}
