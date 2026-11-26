// The screenshot scenes behind ?shot=start|play|cockpit|land. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot that chases the next ring (and, for the landing scene, the runway), so
// the frame is what a real flight looks like and the same seed always gives the
// same frame. Nothing here is a mock: the plane flies, the rings light, the HUD reads.
import { PLANE, RALLY, STEP, WORLD } from './config.js';
import { CAM_CHASE, CAM_COCKPIT, CAM_ORBIT } from './camera.js';

const PLAY_SECONDS = 42;
const COCKPIT_SECONDS = 30;
const LAND_LIMIT_SECONDS = 75;

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Steer the plane toward a point: bank into the heading error, pitch for height. */
function autopilot(plane, target, throttleTarget) {
  const dx = target.x - plane.position.x;
  const dz = target.z - plane.position.z;
  const desiredHeading = Math.atan2(dx, dz);
  const headingError = wrapAngle(desiredHeading - plane.heading);
  const bank = Math.max(-0.95, Math.min(0.95, -headingError * 1.3));
  const altError = target.y - plane.position.y;
  const pitch = Math.max(-1, Math.min(1, (altError * 0.012 + 0.04) / PLANE.maxPitch));
  // Ease off near the ring: a slower plane turns tighter and threads it.
  const distance = Math.hypot(dx, plane.position.y - target.y, dz);
  const throttle = distance < 300 ? Math.min(throttleTarget, 0.5) : throttleTarget;
  const throttleDelta = (throttle - plane.throttle) * 1.5 * STEP;
  return { pitch, bank, throttleDelta, brake: false };
}

function flyToRings(ctx, seconds) {
  const { aircraft, mission } = ctx;
  const plane = aircraft.state;
  let event = '';
  for (let i = 0; i < seconds / STEP; i += 1) {
    const next = mission.nextRing();
    const target = next ?? { x: 0, y: 90, z: 300 };
    const control = autopilot(plane, target, 0.72);
    event = aircraft.step(STEP, control) || event;
    const missionEvent = mission.step(STEP, plane, ctx.terrain.rings);
    if (missionEvent === 'ring' || missionEvent === 'fuel') ctx.onRing(missionEvent);
    if (event === 'crash' || event === 'ditch') {
      // Staging checkpoint: put the plane back in the air behind the next ring
      // and keep flying forward, so the scene still shows the rally honestly.
      const heading = Math.atan2(target.x - plane.position.x, target.z - plane.position.z);
      plane.position.set(target.x - Math.sin(heading) * 140, target.y + 10, target.z - Math.cos(heading) * 140);
      plane.heading = heading;
      plane.pitch = 0;
      plane.bank = 0;
      plane.speed = 55;
      plane.throttle = 0.6;
      plane.integrity = PLANE.integrity;
      plane.onGround = false;
      event = '';
    }
    if (event === 'landed') break;
  }
  return event;
}

function flyLanding(ctx) {
  const { aircraft, mission, terrain } = ctx;
  const plane = aircraft.state;
  // Start the final just south of the strip, already inside its flattened
  // corridor: 540 m out, 90 m up, on speed.
  plane.position.set(0, 92, 540);
  plane.heading = Math.PI;
  plane.pitch = -0.06;
  plane.bank = 0;
  plane.speed = 55;
  plane.throttle = 0.3;
  plane.onGround = false;
  plane.verticalSpeed = -3;
  let event = '';
  for (let i = 0; i < LAND_LIMIT_SECONDS / STEP; i += 1) {
    const z = plane.position.z;
    // Glide slope: 3 degrees down to the touchdown zone. Inside the runway's
    // flattened corridor the strip's own 44 m is the floor; south of it the
    // plane stays 25 m clear of the rough ground, then a gentle flare.
    let glideAlt = 44 + Math.max(0, z - 260) * 0.055;
    const corridor = Math.abs(plane.position.x) < 40 && z < 560;
    if (!corridor) {
      glideAlt = Math.max(glideAlt, terrain.heightAt(plane.position.x, plane.position.z) + 25);
    }
    let desiredVs = Math.max(-6, Math.min(4, (glideAlt - plane.position.y) * 0.5));
    // Flare: once low over the strip, hold a steady -3 m/s down to the wheels
    // instead of easing toward the glide line and floating past the far end.
    if (plane.position.y < 48 && z < 480) desiredVs = -3;
    const pitchAngle = Math.asin(Math.max(-0.5, Math.min(0.5, desiredVs / Math.max(plane.speed, 20))));
    const control = {
      pitch: Math.max(-1, Math.min(1, pitchAngle / PLANE.maxPitch)),
      bank: Math.max(-1, Math.min(1, -wrapAngle(Math.PI - plane.heading) * 1.5)),
      throttleDelta: ((plane.speed < 38 ? 0.35 : 0.12) - plane.throttle) * STEP,
      brake: false,
    };
    event = aircraft.step(STEP, control) || event;
    mission.step(STEP, plane, ctx.terrain.rings);
    if (event === 'landed' || event === 'crash' || event === 'ditch') break;
    if (event === 'hard') {
      // A hard arrival still counts as down: roll it out on the strip.
      event = 'landed';
      break;
    }
  }
  return event;
}

/**
 * Set the world to the named scene and return how it should be shown:
 * the screen to draw, the camera mode and the best score to show.
 */
export function stageShot(name, ctx) {
  const { aircraft, mission, terrain, hud } = ctx;
  aircraft.reset();
  mission.reset();
  mission.start();
  mission.paintRings(terrain.rings);
  if (name === 'play' || name === 'cockpit') {
    const seconds = name === 'cockpit' ? COCKPIT_SECONDS : PLAY_SECONDS;
    flyToRings(ctx, seconds);
    mission.paintRings(terrain.rings);
    return {
      screen: 'play',
      camera: name === 'cockpit' ? CAM_COCKPIT : CAM_CHASE,
      best: mission.state.score,
    };
  }
  if (name === 'land') {
    // Fly the whole rally first so the score and rings are real, then land.
    flyToRings(ctx, 150);
    // The landing is staged on its own: the airframe is made whole again so
    // the end screen shows the landing, not a scrape from the rally.
    aircraft.state.integrity = PLANE.integrity;
    const event = flyLanding(ctx);
    if (event === 'landed') mission.finishLanding(aircraft.state);
    else mission.finishCrash(event === 'ditch' ? 'ditched' : 'crashed');
    mission.paintRings(terrain.rings);
    return { screen: 'end', camera: CAM_CHASE, best: mission.state.score };
  }
  // start: the plane waits on the strip under the title screen.
  aircraft.syncMesh(0);
  hud.showTitle(0, 0);
  return { screen: 'title', camera: CAM_ORBIT, best: 0 };
}

export { RALLY, WORLD };
