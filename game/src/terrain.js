// The valley: a seeded heightfield with a flattened runway, a lake, pine forest,
// drifting clouds and the glowing rally rings. heightAt() is the one source of truth
// for the ground, used by the flight model, the camera and the minimap alike.
import { PALETTE, RALLY, RING_COURSE, WORLD } from './config.js';
import { createNoise } from './random.js';

const TREE_LINE = 150;

function terrainHeight(noise, x, z) {
  // Rolling hills, then a mountain wall that rises toward the edges of the world.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD.half;
  const hills = noise(x, z) * 42 + noise(x * 2.7 + 500, z * 2.7 - 300) * 14;
  const mountains = Math.pow(Math.max(0, edge - 0.55) / 0.45, 2) * 260;
  let h = 34 + hills + mountains;
  // Carve the valley the rally flies through: low ground along a north-south curve.
  const valleyX = 120 * Math.sin(z * 0.0016) - 40;
  const valley = Math.exp(-Math.pow((x - valleyX) / 260, 2));
  h -= valley * 26;
  // The lake basin.
  const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  if (dl < WORLD.lake.radius + 80) {
    const t = Math.max(0, 1 - (dl - WORLD.lake.radius) / 80);
    h = h * (1 - t) + (WORLD.lake.height - 4) * t;
  }
  // Flatten the runway strip so landings are fair.
  const r = WORLD.runway;
  const dx = Math.abs(x - r.x);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  const d = Math.hypot(dx, dz);
  if (d < 90) {
    const t = Math.max(0, 1 - d / 90);
    h = h * (1 - t) + r.height * t;
  }
  return h;
}

function paintTerrain(geometry, noise) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color(PALETTE.terrainLow);
  const high = new THREE.Color(PALETTE.terrainHigh);
  const snow = new THREE.Color(PALETTE.snow);
  const rock = new THREE.Color(PALETTE.rock);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = position.getY(i);
    const n = (noise(x * 0.11 + 900, z * 0.11 - 700) + 1) / 2;
    if (h > 165) color.copy(snow).lerp(rock, 0.25 + n * 0.3);
    else if (h > 120) color.copy(rock).lerp(high, 0.5 + n * 0.3);
    else color.copy(low).lerp(high, 0.25 + n * 0.45);
    // The valley floor reads as meadow; the lake shore as sand.
    const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
    if (dl < WORLD.lake.radius + 26 && h < WORLD.lake.height + 6) color.setHex(0xcbb98a);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function buildRunway(scene) {
  const r = WORLD.runway;
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.z1 - r.z0),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(r.x, r.height + 0.15, (r.z0 + r.z1) / 2);
  group.add(strip);
  // Centre dashes and the threshold bars.
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine });
  for (let z = r.z0 + 22; z < r.z1 - 10; z += 28) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 12), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(r.x, r.height + 0.3, z);
    group.add(dash);
  }
  for (const z of [r.z0 + 8, r.z1 - 8]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(r.width - 4, 3), dashMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(r.x, r.height + 0.3, z);
    group.add(bar);
  }
  // Windsock and a small hangar beside the strip.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  sockPole.position.set(r.x + 22, r.height + 4.5, r.z0 + 30);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7b24 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(r.x + 20, r.height + 8.6, r.z0 + 30);
  group.add(sock);
  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 22, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8a94a0 }),
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(r.x - 34, r.height, r.z1 - 26);
  group.add(hangar);
  scene.add(group);
  return { sock };
}

function buildTrees(scene, random, noise, heightAt) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const crownGeo = new THREE.ConeGeometry(3.2, 11, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6b34 });
  const count = 620;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 30) {
    guard += 1;
    const x = random.range(-WORLD.half + 60, WORLD.half - 60);
    const z = random.range(-WORLD.half + 60, WORLD.half - 60);
    const h = heightAt(x, z);
    if (h > TREE_LINE) continue;
    if (Math.abs(x - WORLD.runway.x) < 46 && z > WORLD.runway.z0 - 60 && z < WORLD.runway.z1 + 60) continue;
    const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
    if (dl < WORLD.lake.radius + 14) continue;
    const s = random.range(0.8, 1.7);
    dummy.position.set(x, h + 1.6 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = random.range(0, Math.PI * 2);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (4 + 5.5) * s * 0.5 + 2.4 * s;
    dummy.updateMatrix();
    crowns.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trunks.count = placed;
  crowns.count = placed;
  scene.add(trunks);
  scene.add(crowns);
}

function buildClouds(scene, random) {
  const clouds = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i += 1) {
    const group = new THREE.Group();
    const puffs = random.int(3, 5);
    for (let p = 0; p < puffs; p += 1) {
      const s = random.range(14, 30);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
      puff.position.set(random.range(-28, 28), random.range(-4, 6), random.range(-14, 14));
      puff.scale.y = 0.45;
      group.add(puff);
    }
    group.position.set(
      random.range(-WORLD.half, WORLD.half),
      random.range(230, 330),
      random.range(-WORLD.half, WORLD.half),
    );
    group.userData.drift = random.range(1.5, 4);
    scene.add(group);
    clouds.push(group);
  }
  return clouds;
}

function buildRings(scene) {
  const rings = RING_COURSE.map(([x, y, z], index) => {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(RALLY.ringRadius, 1.3, 10, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.ringNext }),
    );
    group.add(torus);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(RALLY.ringRadius, 0.35, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    group.add(inner);
    group.position.set(x, y, z);
    group.userData.index = index;
    group.userData.torus = torus;
    group.userData.inner = inner;
    scene.add(group);
    return group;
  });
  return rings;
}

/** Build the whole world. Returns the scene helpers the game loop needs. */
export function createTerrain(scene, random) {
  const noise = createNoise(random, 260);
  const heightAt = (x, z) => terrainHeight(noise, x, z);

  const geometry = new THREE.PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)));
  }
  geometry.computeVertexNormals();
  paintTerrain(geometry, noise);
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(terrain);

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD.lake.radius, 48),
    new THREE.MeshLambertMaterial({ color: PALETTE.lake, transparent: true, opacity: 0.92 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(WORLD.lake.x, WORLD.lake.height, WORLD.lake.z);
  scene.add(lake);

  const { sock } = buildRunway(scene);
  buildTrees(scene, random, noise, heightAt);
  const clouds = buildClouds(scene, random);
  const rings = buildRings(scene);

  // Sun, sky light and haze.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.05);
  sun.position.set(500, 700, -300);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x5d6b4a, 0.85));
  scene.fog = new THREE.Fog(PALETTE.fog, 800, 2800);

  return {
    heightAt,
    rings,
    clouds,
    update(dt, time) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.drift * dt;
        if (cloud.position.x > WORLD.half + 120) cloud.position.x = -WORLD.half - 120;
      }
      sock.rotation.y = Math.sin(time * 0.7) * 0.4;
      for (const ring of rings) {
        const pulse = 1 + 0.05 * Math.sin(time * 3 + ring.userData.index);
        ring.scale.setScalar(ring.userData.passed ? 1 : pulse);
        ring.rotation.y = Math.sin(time * 0.4 + ring.userData.index) * 0.12;
      }
    },
  };
}
