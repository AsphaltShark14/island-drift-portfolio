export type LandmarkKind = "cafe" | "arcade" | "workshop" | "gas" | "office";

export interface LandmarkData {
  id: string;
  title: string;
  /** World position — island (x,z) coordinates, or circuit building centre. */
  position: [number, number];
  /** Circuit-mode-only building footprint [width, depth]. Unused on the island. */
  footprint: [number, number];
  color: number;
  /** Circuit-mode-only building style. Unused on the island. */
  kind: LandmarkKind;
  html: string;
}

export const LANDMARKS: LandmarkData[] = [
  {
    id: "about",
    title: "About Me",
    position: [-63.7, -0.8],
    footprint: [6, 5],
    color: 0xffb84d,
    kind: "cafe",
    html: `<p>Software Developer with experience across the full stack — building
      applications from scratch, shipping features, and keeping production systems
      healthy. Focused on clean solutions, solid testing, and continuous growth.</p>
      <p><strong>Education:</strong> Jagiellonian University — Bachelor's degree in
      Bioinformatics (2015 – 2019)</p>
      <p>
        <a href="https://linkedin.com/in/daniel-bogucki/" target="_blank" rel="noopener noreferrer">↗ LinkedIn</a>
        &nbsp;·&nbsp;
        <a href="https://github.com/AsphaltShark14" target="_blank" rel="noopener noreferrer">↗ GitHub</a>
      </p>
      <p>Email: <a href="mailto:daniel.bogucki14@gmail.com">daniel.bogucki14@gmail.com</a>
      &nbsp;·&nbsp; +48 509-695-506</p>`,
  },
  {
    id: "green-cell",
    title: "Green Cell",
    position: [55, -1.0],
    footprint: [5, 5],
    color: 0x39ff88,
    kind: "office",
    html: `<p class="job-period">Web Developer · Jan 2020 – Jun 2021</p>
      <ul>
        <li><strong>Energy Management App</strong> — React Native, TypeScript. Problem
          solving, front-end application development.</li>
        <li><strong>Company Site</strong> — React, JavaScript, ES6, Three.js, SASS.
          Landing pages for products, maintainable code.</li>
        <li><strong>Marketing Support</strong> — JavaScript, HTML, CSS. Landing pages
          and newsletter templates for campaigns, SEO.</li>
      </ul>`,
  },
  {
    id: "heap",
    title: "HEAP (Freelancing)",
    position: [99.2, -1.2],
    footprint: [5, 5],
    color: 0x2ee6ff,
    kind: "arcade",
    html: `<p class="job-period">React Native Developer · Jun 2021 – Jul 2022</p>
      <ul>
        <li><strong>Music Compatibility App</strong> — React Native, TypeScript.
          Developing the app, creating new components, maintaining infrastructure,
          bug fixing.</li>
      </ul>`,
  },
  {
    id: "liki",
    title: "Liki",
    position: [114.8, -29.4],
    footprint: [5, 5],
    color: 0x8b5cff,
    kind: "office",
    html: `<p class="job-period">Front-end Developer · Jun 2022 – Oct 2023</p>
      <ul>
        <li><strong>Live Shopping Web App</strong> — Next.js, TypeScript, zustand,
          TanstackQuery, module CSS, Storybook.</li>
        <li><strong>News App</strong> — React Native, TypeScript, AppWrite, Webpack.</li>
        <li><strong>Services Site</strong> — Gatsby, TypeScript, Strapi,
          Styled-Components, GraphQL, Apollo Client.</li>
        <li><strong>Energy Controller App</strong> — React, TypeScript, Astro.js,
          Tanstack, ChakraUI, recharts, Vitest, Redux.</li>
      </ul>`,
  },
  {
    id: "grass-valley",
    title: "Grass Valley",
    position: [60.7, -34.6],
    footprint: [6, 6],
    color: 0xff2e88,
    kind: "gas",
    html: `<p class="job-period">Software Developer · Oct 2023 – Present</p>
      <p>Maintaining and evolving production-grade broadcast applications — bug
      resolution, feature design, architecture decisions, full delivery lifecycle.</p>
      <ul>
        <li><strong>FlashBack App</strong> — React, TypeScript, C#, .NET, MUI, Redux.
          Greenfield development, REST API integration, backend frame read/write,
          full test coverage.</li>
        <li><strong>Production Switcher</strong> — React, TypeScript, C#, .NET,
          Tanstack. Critical bug fixes, new features, UI/UX audit. ★ Award-winning
          (IBC, NAB).</li>
        <li><strong>Event / Sport Producer</strong> — React, TypeScript, C#, .NET.
          Greenfield development, cross-instance data replication. ★ Award-winning
          (IBC, NAB).</li>
      </ul>`,
  },
  {
    id: "tools",
    title: "Tools",
    position: [-113.5, 7.1],
    footprint: [4, 4],
    color: 0xf2b134,
    kind: "workshop",
    html: `<p><strong>Languages:</strong> JavaScript, TypeScript, C#, SQL</p>
      <p><strong>Frameworks:</strong> React, React Native, Next.js, .NET, Node.js</p>
      <p><strong>Code Tools:</strong> git, Playwright, Copilot / Codex / Claude Code</p>
      <p><strong>Libraries:</strong> Tanstack, zustand, Redux, recharts</p>
      <p><strong>Other:</strong> Figma</p>`,
  },
];
