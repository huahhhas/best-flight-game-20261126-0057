// The HUD: every instrument the pilot reads — speed, altitude, heading, throttle,
// fuel, integrity, clock, score and rings — plus the minimap, the cockpit dashboard
// and the title, pause and end screens. All of it is DOM over the 3D view, so the
// instruments stay crisp in a screenshot at any window size.
import { MONO, RALLY, RING_COURSE, WORLD } from './config.js';

const KNOTS = 1.94384;
const FEET = 3.28084;

function headingDegrees(heading) {
  return ((heading * 180) / Math.PI + 180 + 360) % 360;
}

function compassLabel(degrees) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(degrees / 22.5) % 16];
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    hud: $('hud'),
    speed: $('hud-speed'),
    alt: $('hud-alt'),
    vsi: $('hud-vsi'),
    hdg: $('hud-hdg'),
    compass: $('hud-compass'),
    clock: $('hud-clock'),
    score: $('hud-score'),
    rings: $('hud-rings'),
    mission: $('hud-mission'),
    throttleFill: $('hud-throttle-fill'),
    throttleText: $('hud-throttle-text'),
    fuelFill: $('hud-fuel-fill'),
    fuelText: $('hud-fuel-text'),
    integFill: $('hud-integrity-fill'),
    integText: $('hud-integrity-text'),
    message: $('hud-message'),
    banner: $('hud-banner'),
    minimap: $('minimap'),
    dash: $('cockpit-dash'),
    attitude: $('attitude'),
    title: $('title-screen'),
    titleBest: $('title-best'),
    pause: $('pause-screen'),
    end: $('end-screen'),
    endTitle: $('end-title'),
    endStats: $('end-stats'),
    endHint: $('end-hint'),
    status: $('status'),
  };
  const mapCtx = els.minimap.getContext('2d');
  const attCtx = els.attitude.getContext('2d');
  let bannerTimer = 0;
  let messageTimer = 0;

  function announce(text) {
    els.status.textContent = text;
  }

  function showOnly(screen) {
    els.title.classList.toggle('hidden', screen !== 'title');
    els.pause.classList.toggle('hidden', screen !== 'pause');
    els.end.classList.toggle('hidden', screen !== 'end');
    els.hud.classList.toggle('hidden', screen === 'title');
    els.dash.classList.toggle('hidden', true);
  }

  function showTitle(bestRally, bestFree) {
    showOnly('title');
    els.titleBest.textContent = bestRally > 0
      ? `Best rally score ${bestRally.toLocaleString()}`
      : 'No rally flown yet — the valley is waiting.';
    void bestFree;
  }

  function showPlay() {
    showOnly('play');
  }

  function showPause() {
    showOnly('pause');
  }

  function showEnd(title, stats, hint) {
    showOnly('end');
    els.endTitle.textContent = title;
    els.endStats.innerHTML = stats;
    els.endHint.textContent = hint;
  }

  function setMessage(text, seconds = 3) {
    els.message.textContent = text;
    messageTimer = seconds;
  }

  function flashBanner(text) {
    els.banner.textContent = text;
    els.banner.classList.remove('hidden');
    bannerTimer = 1.6;
  }

  function drawMinimap(plane, mission, rings) {
    const size = 170;
    const scale = size / (WORLD.size + 160);
    const toMap = (x, z) => [(x + WORLD.half + 80) * scale, (z + WORLD.half + 80) * scale];
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(16, 28, 38, 0.72)';
    mapCtx.fillRect(0, 0, size, size);
    // Lake.
    const [lx, lz] = toMap(WORLD.lake.x, WORLD.lake.z);
    mapCtx.fillStyle = '#3f7fb5';
    mapCtx.beginPath();
    mapCtx.arc(lx, lz, WORLD.lake.radius * scale, 0, Math.PI * 2);
    mapCtx.fill();
    // Runway.
    const [rx0, rz0] = toMap(WORLD.runway.x, WORLD.runway.z0);
    const [rx1, rz1] = toMap(WORLD.runway.x, WORLD.runway.z1);
    mapCtx.strokeStyle = '#f2f2e8';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(rx0, rz0);
    mapCtx.lineTo(rx1, rz1);
    mapCtx.stroke();
    // Rings: done green, next orange, the rest faint.
    for (let i = 0; i < RING_COURSE.length; i += 1) {
      const [x, y, z] = RING_COURSE[i];
      const [mx, mz] = toMap(x, z);
      const done = i < mission.state.ringIndex;
      const next = i === mission.state.ringIndex && !mission.state.finished;
      mapCtx.fillStyle = done ? '#37d67a' : next ? '#ff9f1c' : 'rgba(255,255,255,0.45)';
      mapCtx.beginPath();
      mapCtx.arc(mx, mz, next ? 5 : 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    void rings;
    // The plane, pointing where it flies.
    const [px, pz] = toMap(plane.position.x, plane.position.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(Math.PI - plane.heading);
    mapCtx.fillStyle = '#ffd166';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(0, 3);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function drawAttitude(plane) {
    const size = 140;
    const c = size / 2;
    attCtx.clearRect(0, 0, size, size);
    attCtx.save();
    attCtx.beginPath();
    attCtx.arc(c, c, c - 2, 0, Math.PI * 2);
    attCtx.clip();
    attCtx.translate(c, c);
    attCtx.rotate(-plane.bank);
    attCtx.translate(0, plane.pitch * 110);
    attCtx.fillStyle = '#3f8fd2';
    attCtx.fillRect(-size, -size, size * 2, size);
    attCtx.fillStyle = '#8a6a42';
    attCtx.fillRect(-size, 0, size * 2, size);
    attCtx.strokeStyle = 'rgba(255,255,255,0.85)';
    attCtx.lineWidth = 2;
    attCtx.beginPath();
    attCtx.moveTo(-size, 0);
    attCtx.lineTo(size, 0);
    attCtx.stroke();
    attCtx.restore();
    // Fixed aircraft symbol and bezel.
    attCtx.strokeStyle = '#ffd166';
    attCtx.lineWidth = 3;
    attCtx.beginPath();
    attCtx.moveTo(c - 26, c);
    attCtx.lineTo(c + 26, c);
    attCtx.moveTo(c, c - 4);
    attCtx.lineTo(c, c + 4);
    attCtx.stroke();
    attCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    attCtx.lineWidth = 3;
    attCtx.beginPath();
    attCtx.arc(c, c, c - 2, 0, Math.PI * 2);
    attCtx.stroke();
  }

  function update(dt, plane, mission, cameraMode) {
    const knots = Math.round(plane.speed * KNOTS);
    const feet = Math.round(plane.position.y * FEET);
    const vsi = Math.round(plane.verticalSpeed * FEET * 60);
    const hdg = headingDegrees(plane.heading);
    els.speed.textContent = String(knots).padStart(3, '0');
    els.alt.textContent = feet.toLocaleString();
    els.vsi.textContent = (vsi >= 0 ? '+' : '') + vsi.toLocaleString() + ' fpm';
    els.hdg.textContent = String(Math.round(hdg)).padStart(3, '0') + '° ' + compassLabel(hdg);
    // Compass strip: the eight points around the current heading.
    let strip = '';
    for (let off = -90; off <= 90; off += 30) {
      const d = (hdg + off + 360) % 360;
      const card = ['N', 'E', 'S', 'W'][Math.round(d / 90) % 4];
      strip += Math.abs(d - Math.round(d / 90) * 90) < 4 ? ` ${card} ` : ` ${Math.round(d / 10) * 10} `;
    }
    els.compass.textContent = strip;
    els.clock.textContent = formatClock(mission.state.time);
    els.score.textContent = mission.state.score.toLocaleString();
    els.rings.textContent = mission.mode === 'rally'
      ? `RINGS ${Math.min(mission.state.ringsHit, RALLY.rings)}/${RALLY.rings}`
      : `RINGS ${mission.state.ringsHit}`;
    els.mission.textContent = mission.mode === 'rally' ? 'ALPINE AIR RALLY' : 'FREE FLIGHT';
    els.throttleFill.style.width = `${Math.round(plane.throttle * 100)}%`;
    els.throttleText.textContent = `THR ${Math.round(plane.throttle * 100)}%`;
    els.fuelFill.style.width = `${Math.round(plane.fuel)}%`;
    els.fuelText.textContent = `FUEL ${Math.round(plane.fuel)}%`;
    els.fuelFill.classList.toggle('low', plane.fuel < 25);
    els.integFill.style.width = `${Math.round(plane.integrity)}%`;
    els.integText.textContent = `AIRFRAME ${Math.round(plane.integrity)}%`;
    els.integFill.classList.toggle('low', plane.integrity < 40);
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) els.banner.classList.add('hidden');
    }
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) els.message.textContent = '';
    }
    drawMinimap(plane, mission);
    const cockpit = cameraMode === 'cockpit';
    els.dash.classList.toggle('hidden', !cockpit);
    // The cockpit dashboard sits at the bottom centre: lift the message above it.
    els.message.style.bottom = cockpit ? '195px' : '18px';
    if (cockpit) drawAttitude(plane);
  }

  return {
    showTitle,
    showPlay,
    showPause,
    showEnd,
    setMessage,
    flashBanner,
    announce,
    update,
    font: MONO,
  };
}
