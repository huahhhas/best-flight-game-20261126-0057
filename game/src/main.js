// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between five
// screens: title, play, paused, complete and crashed.
//
// ?seed=N fixes the valley, the rings and the weather. ?shot=start|play|cockpit|land
// (with &seed=N) stages that scene instead of running the loop, paints it a few
// times and sets window.__shotReady for a screenshot.
import { BEST_KEY, PALETTE, RALLY, RALLY_BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createHud } from './hud.js';
import { MODE_FREE, MODE_RALLY, createMission } from './missions.js';
import { CAM_CHASE, CAM_COCKPIT, CAM_ORBIT, createCamera } from './camera.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'pause';
const SCREEN_END = 'end';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const modeParam = params.get('mode') === 'free' ? MODE_FREE : MODE_RALLY;

const canvas = document.getElementById('game');
const hud = createHud(document);
const audio = createAudio();
const random = createRandom(seed);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(PALETTE.skyHorizon);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyHorizon);
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 4200);
camera.position.set(0, 60, 460);

const terrain = createTerrain(scene, random);
const aircraft = createAircraft(scene, terrain.heightAt);
const mission = createMission(modeParam);
const cam = createCamera(camera);
const input = createInput(canvas);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function readBest(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function endStatsText() {
  const m = mission.state;
  const rows = [
    ['Score', m.score.toLocaleString()],
    ['Rings', `${m.ringsHit} / ${RALLY.rings}`],
    ['Time', `${Math.floor(m.time / 60)}:${String(Math.floor(m.time % 60)).padStart(2, '0')}`],
    ['Fuel left', `${Math.round(aircraft.state.fuel)}%`],
    ['Airframe', `${Math.round(aircraft.state.integrity)}%`],
  ];
  if (m.landingRating) rows.push(['Landing', m.landingRating]);
  return rows.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
}

function runShot(name) {
  const ctx = {
    aircraft,
    mission,
    terrain,
    hud,
    onRing: (event) => {
      if (event === 'ring') audio.ring();
      if (event === 'fuel') audio.fuel();
    },
  };
  const staged = stageShot(name, ctx);
  cam.setMode(staged.camera);
  aircraft.syncMesh(0);
  terrain.update(0, 0);
  if (staged.screen === 'title') {
    hud.showTitle(readBest(RALLY_BEST_KEY), readBest(BEST_KEY));
    cam.setMode(CAM_ORBIT);
  } else if (staged.screen === 'end') {
    const m = mission.state;
    const title = m.outcome === 'landed'
      ? (m.ringIndex >= RALLY.rings ? 'RALLY COMPLETE' : 'DOWN SAFE')
      : m.outcome === 'ditched' ? 'DITCHED IN THE LAKE' : 'CRASHED';
    hud.showEnd(title, endStatsText(), 'Press Enter to fly again.');
    hud.announce(`${title}. Score ${m.score}.`);
  } else {
    hud.showPlay();
    hud.setMessage(
      mission.state.ringIndex >= RALLY.rings
        ? 'All rings down — bring her home to the strip.'
        : `Ring ${mission.state.ringIndex + 1} of ${RALLY.rings} — thread the orange ring.`,
      6,
    );
    hud.announce('Flying.');
  }
  let painted = 0;
  function paint() {
    // Settle the camera on the staged scene before the first frame, so the
    // shot shows the plane instead of the camera still flying to it.
    if (painted === 0) {
      for (let i = 0; i < 120; i += 1) {
        cam.update(1 / 60, aircraft.state, i * 0.5, terrain.heightAt);
      }
    }
    cam.update(1 / 60, aircraft.state, painted * 0.5, terrain.heightAt);
    aircraft.state.mesh.userData.prop.visible = cam.mode !== CAM_COCKPIT;
    terrain.update(1 / 60, painted * 0.5);
    renderer.render(scene, camera);
    hud.update(1 / 60, aircraft.state, mission, cam.mode);
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let mode = modeParam;
  let bestRally = readBest(RALLY_BEST_KEY);
  let bestFree = readBest(BEST_KEY);
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let muted = false;
  let started = false;

  cam.setMode(CAM_ORBIT);
  hud.showTitle(bestRally, bestFree);
  hud.announce('Ridge Runner. Press Enter or click to fly.');

  function startGame(nextMode) {
    mode = nextMode;
    audio.start();
    audio.resume();
    mission.mode = nextMode;
    aircraft.reset();
    mission.reset();
    mission.start();
    mission.paintRings(terrain.rings);
    aircraft.syncMesh(0);
    accumulator = 0;
    started = true;
    screen = SCREEN_PLAY;
    cam.setMode(CAM_CHASE);
    hud.showPlay();
    hud.setMessage(
      nextMode === MODE_RALLY
        ? `Rally: thread all ${RALLY.rings} rings, then land on the strip.`
        : 'Free flight: rings are worth 100 each — land anywhere flat to refuel.',
      6,
    );
    hud.announce(nextMode === MODE_RALLY ? 'Rally started.' : 'Free flight started.');
  }

  function endGame(title, hint) {
    screen = SCREEN_END;
    const m = mission.state;
    if (mode === MODE_RALLY && m.score > bestRally) {
      bestRally = m.score;
      saveBest(RALLY_BEST_KEY, bestRally);
    }
    if (mode === MODE_FREE && m.score > bestFree) {
      bestFree = m.score;
      saveBest(BEST_KEY, bestFree);
    }
    hud.showEnd(title, endStatsText(), hint);
    hud.announce(`${title}. Score ${m.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      hud.setMessage(muted ? 'Sound off.' : 'Sound on.', 2);
    }
    if (actions & ACTION_CAMERA && screen === SCREEN_PLAY) {
      const next = cam.toggle();
      hud.setMessage(next === CAM_COCKPIT ? 'Cockpit view — C for chase.' : 'Chase view — C for cockpit.', 2);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_END)) {
      startGame(mode);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showPause();
      hud.announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.showPlay();
      hud.announce('Flying.');
    }
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      time += STEP;
      return;
    }
    const control = input.control(STEP);
    const event = aircraft.step(STEP, control);
    const missionEvent = mission.step(STEP, aircraft.state, terrain.rings);
    audio.update(aircraft.state.throttle, aircraft.state.speed, !aircraft.state.onGround);
    if (missionEvent === 'ring') {
      audio.ring();
      hud.flashBanner(`RING ${mission.state.ringsHit} / ${RALLY.rings}`);
      const left = RALLY.rings - mission.state.ringIndex;
      hud.setMessage(
        left > 0 ? `Ring ${mission.state.ringIndex + 1} of ${RALLY.rings} — ${Math.round(mission.distanceToNextRing(aircraft.state))} m ahead.`
          : 'All rings down — bring her home to the strip.',
        4,
      );
    } else if (missionEvent === 'fuel') {
      audio.fuel();
      hud.flashBanner('FUEL RING — +35');
      hud.setMessage('Fuel topped up. Keep flying.', 3);
    } else if (missionEvent === 'timeout') {
      hud.setMessage('Time up — land on the strip to bank what you have.', 5);
    }
    if (event === 'landed') {
      audio.land();
      mission.finishLanding(aircraft.state);
      const m = mission.state;
      endGame(
        m.ringIndex >= RALLY.rings && mode === MODE_RALLY ? 'RALLY COMPLETE' : 'DOWN SAFE',
        'Press Enter to fly again.',
      );
    } else if (event === 'crash') {
      audio.crash();
      mission.finishCrash('crashed');
      endGame('CRASHED', 'The valley wins this one. Press Enter to try again.');
    } else if (event === 'ditch') {
      audio.crash();
      mission.finishCrash('ditched');
      endGame('DITCHED IN THE LAKE', 'Water landings never end well. Press Enter to try again.');
    } else if (event === 'hard') {
      audio.land();
      hud.flashBanner('HARD LANDING — AIRFRAME -22');
      hud.setMessage('That one hurt the airframe. Roll clear or take off again.', 4);
    }
    if (aircraft.state.fuel <= 0 && !aircraft.state.onGround && mission.state.started && !mission.state.finished) {
      hud.setMessage('OUT OF FUEL — gliding. Find the strip or a flat field.', 3);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    time += dt;
    terrain.update(dt, time);
    aircraft.syncMesh(time);
    // The camera and clouds take the real frame time, so the view tracks the
    // plane at any display rate instead of only at 60 fps.
    cam.update(dt, aircraft.state, time, terrain.heightAt);
    // The spinning propeller reads as a dark slab from the pilot's seat: hide
    // it in cockpit view, where a real pilot sees only a blur.
    aircraft.state.mesh.userData.prop.visible = cam.mode !== CAM_COCKPIT;
    renderer.render(scene, camera);
    if (screen !== SCREEN_TITLE) hud.update(dt, aircraft.state, mission, cam.mode);
  }

  document.getElementById('btn-rally').addEventListener('click', () => startGame(MODE_RALLY));
  document.getElementById('btn-free').addEventListener('click', () => startGame(MODE_FREE));
  document.addEventListener('pointerdown', () => {
    audio.start();
    audio.resume();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showPause();
      hud.announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
