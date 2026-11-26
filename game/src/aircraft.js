// The Kestrel K-9 bush plane: built from primitives so it looks built, not drawn,
// and the arcade flight model that flies it — throttle, bank, pitch, stall, fuel.
import { PALETTE, PLANE, WORLD } from './config.js';

function buildPlaneMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.planeBody, roughness: 0.5, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.planeAccent, roughness: 0.55, metalness: 0.15 });
  const glassMat = new THREE.MeshStandardMaterial({ color: PALETTE.planeGlass, roughness: 0.15, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7, metalness: 0.3 });

  // Fuselage: a tapered body with a rounded nose and a cream cheatline.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), bodyMat);
  nose.position.z = -2.8;
  nose.scale.set(1, 1, 0.9);
  group.add(nose);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.57, 5.0, 12, 1, true, 0, Math.PI), accentMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.z = Math.PI;
  stripe.position.y = 0.08;
  group.add(stripe);
  // Canopy: the glasshouse the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), glassMat);
  canopy.scale.set(1, 0.72, 1.9);
  canopy.position.set(0, 0.62, -0.4);
  group.add(canopy);
  // High wing with a slight dihedral, plus struts down to the fuselage.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.16, 1.7), accentMat);
  wing.position.set(0, 0.72, -0.2);
  wing.rotation.z = 0;
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.7), bodyMat);
  wingTipL.position.set(-4.7, 0.72, -0.2);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 4.7;
  group.add(wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), darkMat);
    strut.position.set(side * 1.5, 0.1, -0.2);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }
  // Tail: horizontal stabiliser and a tall fin with the rally number.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.1), accentMat);
  tailplane.position.set(0, 0.25, 2.6);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), bodyMat);
  fin.position.set(0, 0.85, 2.55);
  group.add(fin);
  // Propeller: spinner, hub and two blades that spin with the engine.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), accentMat);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -3.7;
  group.add(spinner);
  const prop = new THREE.Group();
  prop.position.z = -3.55;
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), darkMat);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  group.add(prop);
  // Fixed gear: two wheels and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), darkMat);
    leg.position.set(side * 0.85, -0.95, -0.6);
    leg.rotation.z = side * 0.35;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.45, -0.6);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10), darkMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 2.6);
  group.add(tailWheel);
  // Navigation lights: red port, green starboard, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
  navL.position.set(-4.95, 0.72, -0.2);
  group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2dff5e }));
  navR.position.set(4.95, 0.72, -0.2);
  group.add(navR);
  group.userData.prop = prop;
  return group;
}

/** The aircraft: position, attitude, speed, throttle, fuel and integrity. */
export function createAircraft(scene, heightAt) {
  const mesh = buildPlaneMesh();
  scene.add(mesh);
  const state = {
    mesh,
    position: new THREE.Vector3(WORLD.start.x, 0, WORLD.start.z),
    heading: WORLD.start.heading,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    integrity: PLANE.integrity,
    verticalSpeed: 0,
    onGround: true,
    landed: false,
    propAngle: 0,
  };
  state.position.y = heightAt(state.position.x, state.position.z) + 1.6;

  function reset() {
    state.position.set(WORLD.start.x, 0, WORLD.start.z);
    state.position.y = heightAt(state.position.x, state.position.z) + 1.6;
    state.heading = WORLD.start.heading;
    state.pitch = 0;
    state.bank = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = PLANE.fuelCapacity;
    state.integrity = PLANE.integrity;
    state.verticalSpeed = 0;
    state.onGround = true;
    state.landed = false;
  }

  /**
   * One fixed step. `control` carries pitch (-1..1, + is nose up), bank (-1..1,
   * + is right), throttleDelta and brake. Returns an event string or ''.
   */
  function step(dt, control) {
    const groundH = heightAt(state.position.x, state.position.z);
    const wasAirborne = !state.onGround;

    // Throttle: the engine answers, fuel burns, an empty tank glides.
    if (state.fuel <= 0) state.throttle = 0;
    else {
      state.throttle = Math.max(0, Math.min(1, state.throttle + control.throttleDelta));
      state.fuel = Math.max(0, state.fuel - (PLANE.fuelDrain + state.throttle * PLANE.fuelDrainThrottle) * dt);
    }
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    let rate = PLANE.accel;
    if (control.brake) rate *= 0.35;
    state.speed += (targetSpeed - state.speed) * Math.min(1, rate * dt);
    if (control.brake) state.speed = Math.max(0, state.speed - 22 * dt);

    // Attitude: bank and pitch chase the stick, gently on the ground.
    const authority = state.onGround ? 0.25 : 1;
    state.bank += (control.bank * PLANE.maxBank - state.bank) * Math.min(1, PLANE.bankRate * authority * dt);
    state.pitch += (control.pitch * PLANE.maxPitch - state.pitch) * Math.min(1, PLANE.pitchRate * authority * dt);

    // Turning: a banked wing turns the nose, faster when the wing is loaded.
    // Arcade authority (x2.2 over the textbook rate) keeps the rally's tight
    // ring-to-ring turns flyable at cruise speed.
    const turnRate = (2.2 * 9.81 * Math.tan(state.bank)) / Math.max(state.speed, 18);
    state.heading -= turnRate * dt * (state.onGround ? 0.3 : 1);

    // Flight: forward speed becomes climb by the pitch; below stall speed the
    // nose drops and the plane sinks instead of climbing.
    const stalled = state.speed < PLANE.stallSpeed && !state.onGround;
    let climb = Math.sin(state.pitch) * state.speed;
    if (stalled) {
      climb -= PLANE.sinkRate * (1 - state.speed / PLANE.stallSpeed);
      state.pitch += (state.pitch * 0.4 - 0.12 - state.pitch) * dt;
    }
    state.verticalSpeed = climb;
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
    state.position.addScaledVector(forward, state.speed * Math.cos(state.pitch) * dt);
    state.position.y += climb * dt;

    // The ground: rolling on the strip, touching down, or hitting the valley.
    // Over the lake the water, not the basin, is the ground.
    const lakeD = Math.hypot(state.position.x - WORLD.lake.x, state.position.z - WORLD.lake.z);
    const overLake = lakeD < WORLD.lake.radius;
    const ground = overLake ? Math.max(groundH, WORLD.lake.height) : groundH;
    const clearance = state.position.y - ground;
    const r = WORLD.runway;
    const overRunway = Math.abs(state.position.x - r.x) < r.width / 2 && state.position.z > r.z0 && state.position.z < r.z1;
    if (clearance <= 1.6) {
      state.position.y = ground + 1.6;
      if (overLake) return 'ditch';
      if (wasAirborne) {
        // Touchdown: gentle, slow and level on the strip is a landing; anything
        // else is a hard arrival the airframe remembers.
        const gentle = state.verticalSpeed > -9 && Math.abs(state.bank) < 0.3 && state.speed < 72;
        if (overRunway && gentle) {
          state.onGround = true;
          state.landed = true;
          state.pitch = 0;
          state.bank = 0;
          state.verticalSpeed = 0;
          state.speed = Math.min(state.speed, 42);
          return 'landed';
        }
        if (state.verticalSpeed < -16 || state.speed > 85) return 'crash';
        state.integrity -= 22;
        state.onGround = true;
        state.speed = Math.max(0, state.speed - 18);
        state.pitch = 0;
        state.bank = 0;
        state.verticalSpeed = 0;
        if (state.integrity <= 0) return 'crash';
        return 'hard';
      }
      state.onGround = true;
      if (state.speed < 2) state.speed = 0;
    } else if (clearance > 4) {
      state.onGround = false;
      state.landed = false;
    }
    // Takeoff roll: the wing lifts off once it has the speed for it.
    if (state.onGround && state.speed > PLANE.stallSpeed + 6 && state.pitch > 0.08) {
      state.onGround = false;
    }
    // Rolling on the ground: no vertical speed to report.
    if (state.onGround) state.verticalSpeed = 0;
    // Keep the plane inside the valley.
    state.position.x = Math.max(-WORLD.half, Math.min(WORLD.half, state.position.x));
    state.position.z = Math.max(-WORLD.half, Math.min(WORLD.half, state.position.z));
    if (state.position.y > 420) state.position.y = 420;
    return '';
  }

  function syncMesh(time) {
    mesh.position.copy(state.position);
    mesh.rotation.set(0, 0, 0);
    // The model is built nose-first toward -Z, so yaw is heading + PI; pitch up
    // lifts the nose and a positive bank drops the right wing.
    mesh.rotateY(state.heading + Math.PI);
    mesh.rotateX(state.pitch);
    mesh.rotateZ(-state.bank);
    // The propeller spins with the throttle; on the ground it idles.
    state.propAngle += (2 + state.throttle * 55) * (1 / 60);
    mesh.userData.prop.rotation.z = state.propAngle;
    void time;
  }

  return { state, reset, step, syncMesh };
}
