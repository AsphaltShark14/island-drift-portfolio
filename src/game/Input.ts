export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

const FORWARD_KEYS = new Set(["KeyW", "ArrowUp"]);
const BACKWARD_KEYS = new Set(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "ArrowRight"]);
const HANDBRAKE_KEYS = new Set(["Space", "ShiftLeft", "ShiftRight"]);
const RESET_KEY = "KeyR";

export class Input {
  private keys = new Set<string>();
  private resetRequested = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      // Space would otherwise scroll the page / trigger buttons.
      if (HANDBRAKE_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === RESET_KEY && !e.repeat) this.resetRequested = true;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  getState(): InputState {
    return {
      forward: this.any(FORWARD_KEYS),
      backward: this.any(BACKWARD_KEYS),
      left: this.any(LEFT_KEYS),
      right: this.any(RIGHT_KEYS),
      handbrake: this.any(HANDBRAKE_KEYS),
    };
  }

  /** True once per R press (auto-repeat ignored); clears itself on read. */
  consumeReset(): boolean {
    const requested = this.resetRequested;
    this.resetRequested = false;
    return requested;
  }

  private any(codes: Set<string>): boolean {
    for (const code of codes) {
      if (this.keys.has(code)) return true;
    }
    return false;
  }
}
