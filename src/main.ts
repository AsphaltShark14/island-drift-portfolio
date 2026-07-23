import "./style.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const game = new Game(canvas);
game.start();

// Dev-only hook for automated testing (stripped from production builds).
if (import.meta.env.DEV) {
  (window as unknown as { __game: Game }).__game = game;
}
