// Missions: the rally and free flight. The rally is a course of glowing rings over
// the valley and back to the runway; free flight is the same valley with no clock,
// rings worth points whenever you thread one, and fuel on every landing.
// The mission owns the clock, the score and the ring states; the loop owns the plane.
import { FUEL_RING_INDEX, PALETTE, RALLY, RING_COURSE } from './config.js';

export const MODE_RALLY = 'rally';
export const MODE_FREE = 'free';

export function createMission(mode) {
  const state = {
    mode,
    ringIndex: 0,
    ringsHit: 0,
    score: 0,
    time: 0,
    started: false,
    finished: false,
    outcome: '', // 'landed' | 'crashed' | 'ditched' | 'timeout' | ''
    landingRating: '',
    best: 0,
  };

  function ringPosition(index) {
    const [x, y, z] = RING_COURSE[index];
    return { x, y, z };
  }

  function paintRings(rings) {
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      const isFuel = FUEL_RING_INDEX.includes(i);
      const done = i < state.ringIndex;
      const next = i === state.ringIndex && !state.finished;
      ring.userData.passed = done;
      const color = done ? PALETTE.ringDone : isFuel ? PALETTE.ringFuel : PALETTE.ringNext;
      ring.userData.torus.material.color.setHex(color);
      ring.userData.inner.material.color.setHex(done ? 0x9dffc4 : 0xffffff);
      ring.visible = state.mode === MODE_RALLY || next || !done;
      if (state.mode === MODE_FREE) ring.visible = true;
      ring.userData.torus.material.opacity = next ? 1 : 0.85;
    }
  }

  function start() {
    state.started = true;
    state.time = 0;
    state.finished = false;
    state.outcome = '';
  }

  function reset() {
    state.ringIndex = 0;
    state.ringsHit = 0;
    state.score = 0;
    state.time = 0;
    state.started = false;
    state.finished = false;
    state.outcome = '';
    state.landingRating = '';
  }

  /**
   * Advance the mission one step. `plane` is the aircraft state, `rings` the
   * ring meshes. Returns an event string: 'ring' | 'fuel' | 'landed' | 'timeout' | ''.
   */
  function step(dt, plane, rings) {
    if (!state.started || state.finished) return '';
    state.time += dt;
    if (state.mode === MODE_RALLY && state.time > RALLY.timeLimit) {
      state.finished = true;
      state.outcome = 'timeout';
      return 'timeout';
    }
    // Threading the next ring: within its radius, in any direction.
    const target = ringPosition(state.ringIndex % RING_COURSE.length);
    const d = Math.hypot(plane.position.x - target.x, plane.position.y - target.y, plane.position.z - target.z);
    if (d < RALLY.ringRadius) {
      const isFuel = FUEL_RING_INDEX.includes(state.ringIndex % RING_COURSE.length);
      state.ringsHit += 1;
      state.score += RALLY.ringPoints;
      state.ringIndex += 1;
      if (isFuel) {
        plane.fuel = Math.min(100, plane.fuel + RALLY.fuelRingBonus);
        paintRings(rings);
        return 'fuel';
      }
      if (state.mode === MODE_RALLY && state.ringIndex >= RING_COURSE.length) {
        // Every ring is down: the rally is won by landing on the strip.
        paintRings(rings);
        return 'ring';
      }
      paintRings(rings);
      return 'ring';
    }
    return '';
  }

  function finishLanding(plane) {
    if (state.finished) return;
    state.finished = true;
    state.outcome = 'landed';
    const soft = Math.abs(plane.verticalSpeed) < 4 && plane.speed < 45;
    state.landingRating = soft ? 'Butter smooth' : plane.speed < 60 ? 'Firm but fair' : 'A bit hot';
    if (state.mode === MODE_RALLY && state.ringIndex >= RING_COURSE.length) {
      state.score += RALLY.landingBonus;
      const left = Math.max(0, RALLY.timeLimit - state.time);
      state.score += Math.round(left * RALLY.timeBonusPerSecond * 0.1);
    } else if (state.mode === MODE_FREE) {
      state.score += 150;
    }
  }

  function finishCrash(kind) {
    if (state.finished) return;
    state.finished = true;
    state.outcome = kind; // 'crashed' or 'ditched'
  }

  function nextRing() {
    if (state.mode === MODE_RALLY && state.ringIndex >= RING_COURSE.length) return null;
    return ringPosition(state.ringIndex % RING_COURSE.length);
  }

  function distanceToNextRing(plane) {
    const next = nextRing();
    if (!next) return 0;
    return Math.hypot(plane.position.x - next.x, plane.position.y - next.y, plane.position.z - next.z);
  }

  return {
    state,
    get mode() {
      return state.mode;
    },
    set mode(next) {
      state.mode = next;
    },
    start,
    reset,
    step,
    paintRings,
    finishLanding,
    finishCrash,
    nextRing,
    distanceToNextRing,
  };
}
