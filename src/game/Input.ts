export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

const FORWARD_KEYS = new Set(["KeyW", "ArrowUp"]);
const BACKWARD_KEYS = new Set(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "ArrowRight"]);

export class Input {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  getState(): InputState {
    return {
      forward: this.any(FORWARD_KEYS),
      backward: this.any(BACKWARD_KEYS),
      left: this.any(LEFT_KEYS),
      right: this.any(RIGHT_KEYS),
    };
  }

  private any(codes: Set<string>): boolean {
    for (const code of codes) {
      if (this.keys.has(code)) return true;
    }
    return false;
  }
}
