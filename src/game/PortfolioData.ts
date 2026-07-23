export type LandmarkShape = "monument" | "stack" | "gear" | "tower";

export interface LandmarkData {
  id: string;
  title: string;
  /** Position on the ground, [x, z]. */
  position: [number, number];
  color: number;
  shape: LandmarkShape;
  html: string;
}

// Edit this file to make the map your own — swap the html for each
// stop with your real bio, projects, skills and contact details.
export const LANDMARKS: LandmarkData[] = [
  {
    id: "about",
    title: "About Me",
    position: [0, -15],
    color: 0x5aa9ff,
    shape: "monument",
    html: `<p>Hi, I'm <strong>[Your Name]</strong>. This is the About stop —
      replace this text in <code>src/game/PortfolioData.ts</code> with a
      couple of sentences about who you are and what you do.</p>`,
  },
  {
    id: "projects",
    title: "Projects",
    position: [15, 0],
    color: 0xff9f45,
    shape: "stack",
    html: `<ul>
      <li><strong>[Project One]</strong> — one line describing it.</li>
      <li><strong>[Project Two]</strong> — one line describing it.</li>
      <li><strong>[Project Three]</strong> — one line describing it.</li>
    </ul>`,
  },
  {
    id: "skills",
    title: "Skills",
    position: [0, 15],
    color: 0x5be08a,
    shape: "gear",
    html: `<p>[Language], [Language], [Framework], [Framework], [Tool] &mdash;
      list the stack you want visitors to see here.</p>`,
  },
  {
    id: "contact",
    title: "Contact",
    position: [-15, 0],
    color: 0xff5d8f,
    shape: "tower",
    html: `<p>Email: <a href="mailto:mat.majgier@gmail.com">mat.majgier@gmail.com</a></p>
      <p>Swap in your preferred contact links (GitHub, LinkedIn, etc.) here.</p>`,
  },
];

export const MAP_HALF_SIZE = 21;
