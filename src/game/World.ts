import * as THREE from "three";
import { MAP_HALF_SIZE } from "./PortfolioData";

const TILE_SIZE = 3;
const GRASS_A = 0x3f8a52;
const GRASS_B = 0x367949;

export function createGround(): THREE.Group {
  const group = new THREE.Group();
  const tilesPerSide = Math.round((MAP_HALF_SIZE * 2) / TILE_SIZE);
  const start = -((tilesPerSide * TILE_SIZE) / 2) + TILE_SIZE / 2;

  const geometry = new THREE.BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE);
  const materialA = new THREE.MeshLambertMaterial({ color: GRASS_A, flatShading: true });
  const materialB = new THREE.MeshLambertMaterial({ color: GRASS_B, flatShading: true });

  for (let ix = 0; ix < tilesPerSide; ix++) {
    for (let iz = 0; iz < tilesPerSide; iz++) {
      const parity = (ix + iz) % 2 === 0;
      const tile = new THREE.Mesh(geometry, parity ? materialA : materialB);
      tile.position.set(start + ix * TILE_SIZE, -0.1, start + iz * TILE_SIZE);
      group.add(tile);
    }
  }

  return group;
}

function makeTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a30, flatShading: true }),
  );
  trunk.position.y = 0.5;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x2f7d4f, flatShading: true }),
  );
  leaves.position.y = 1.7;
  tree.add(leaves);

  return tree;
}

function makeRock(): THREE.Mesh {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.4, 0),
    new THREE.MeshLambertMaterial({ color: 0x8a8a8f, flatShading: true }),
  );
  rock.position.y = 0.25;
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  return rock;
}

export function createProps(avoid: Array<[number, number]>): THREE.Group {
  const group = new THREE.Group();
  const bound = MAP_HALF_SIZE - 2;
  const avoidRadius = 4;
  let placed = 0;
  let attempts = 0;

  while (placed < 26 && attempts < 400) {
    attempts++;
    const x = (Math.random() * 2 - 1) * bound;
    const z = (Math.random() * 2 - 1) * bound;

    const tooClose = avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < avoidRadius);
    if (tooClose || Math.hypot(x, z) < 5) continue;

    const prop = Math.random() < 0.7 ? makeTree() : makeRock();
    prop.position.x = x;
    prop.position.z = z;
    group.add(prop);
    placed++;
  }

  return group;
}
