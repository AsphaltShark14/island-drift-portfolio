export type LandmarkKind = "cafe" | "arcade" | "workshop" | "gas" | "office";

export interface LandmarkData {
  id: string;
  title: string;
  /** Building centre on the ground, [x, z]. */
  position: [number, number];
  /** Footprint [width, depth] — also drives the trigger radius. */
  footprint: [number, number];
  color: number;
  kind: LandmarkKind;
  html: string;
}

// Edit this file to make the city your own — swap the html for each
// stop with your real bio, projects, skills and contact details.
export const LANDMARKS: LandmarkData[] = [
  {
    id: "about",
    title: "About Me — Corner Cafe",
    position: [0, 21],
    footprint: [6, 5],
    color: 0xffb84d,
    kind: "cafe",
    html: `<p>Hi, I'm <strong>[Your Name]</strong>. Pull up to the cafe — this is the
      About stop. Replace this text in <code>src/game/PortfolioData.ts</code> with a
      couple of sentences about who you are and what you build.</p>`,
  },
  {
    id: "projects",
    title: "Projects — Neon Arcade",
    position: [21, 0],
    footprint: [5, 6],
    color: 0x2ee6ff,
    kind: "arcade",
    html: `<ul>
      <li><strong>[Project One]</strong> — one line describing it.</li>
      <li><strong>[Project Two]</strong> — one line describing it.</li>
      <li><strong>[Project Three]</strong> — one line describing it.</li>
    </ul>`,
  },
  {
    id: "skills",
    title: "Skills — Tuning Garage",
    position: [0, -21],
    footprint: [7, 5],
    color: 0x39ff88,
    kind: "workshop",
    html: `<p>The workshop where the builds happen. [Language], [Language],
      [Framework], [Framework], [Tool] — list the stack you want visitors to see.</p>`,
  },
  {
    id: "contact",
    title: "Contact — Gas Station (Checkpoint)",
    position: [-21, 0],
    footprint: [8, 6],
    color: 0xff2e88,
    kind: "gas",
    html: `<p>Refuel and reach out.</p>
      <p>Email: <a href="mailto:mat.majgier@gmail.com">mat.majgier@gmail.com</a></p>
      <p>Swap in your preferred links (GitHub, LinkedIn, etc.) here.</p>`,
  },
  {
    id: "experience",
    title: "Experience — Office Tower",
    position: [21, 21],
    footprint: [5, 5],
    color: 0x8b5cff,
    kind: "office",
    html: `<ul>
      <li><strong>[Role]</strong> @ [Company] — [years].</li>
      <li><strong>[Role]</strong> @ [Company] — [years].</li>
    </ul>`,
  },
];
