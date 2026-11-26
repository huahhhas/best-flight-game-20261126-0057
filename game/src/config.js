// Ridge Runner — Alpine Air Rally. Every tuning number and colour in one place.
// The world is a 2400 x 2400 m alpine valley; the runway sits near its south edge and
// the rally course weaves north through the valley, over the pass and back to land.
export const STEP = 1 / 60;
export const BEST_KEY = 'ridge-runner.best';
export const RALLY_BEST_KEY = 'ridge-runner.rally-best';

export const WORLD = {
  size: 2400,
  half: 1200,
  segments: 128,
  lake: { x: -520, z: -320, radius: 230, height: 16 },
  // The runway is flattened into the terrain around this rectangle.
  runway: { x: 0, z0: 180, z1: 480, width: 26, height: 42 },
  // Where the plane parks and the rally starts, facing north (-Z).
  start: { x: 0, z: 430, heading: Math.PI },
};

export const PLANE = {
  maxSpeed: 96, // m/s, about 186 kt at full throttle
  cruiseSpeed: 58,
  stallSpeed: 27,
  accel: 0.35, // how fast speed chases throttle * maxSpeed, per second
  maxPitch: 0.62, // radians, nose up or down
  pitchRate: 1.15,
  maxBank: 1.15,
  bankRate: 2.4,
  climbAuthority: 1.0,
  sinkRate: 7, // m/s lost below stall speed
  fuelCapacity: 100,
  fuelDrain: 0.16, // per second at idle
  fuelDrainThrottle: 0.30, // extra per second at full throttle
  integrity: 100,
};

export const RALLY = {
  rings: 12,
  ringRadius: 20,
  ringPoints: 100,
  fuelRingBonus: 35,
  // Minutes the clock allows before the rally times out (landing still counts).
  timeLimit: 420,
  landingBonus: 500,
  timeBonusPerSecond: 4,
};

// Ring course: [x, altitude above sea level, z]. The valley run goes north, climbs
// over the east pass, then comes back south for a final approach onto the runway.
export const RING_COURSE = [
  [0, 95, 60],
  [-140, 110, -180],
  [-260, 130, -420],
  [-180, 165, -640],
  [60, 200, -780],
  [300, 215, -700],
  [420, 190, -480],
  [330, 150, -260],
  [180, 120, -80],
  [40, 100, 120],
  [-60, 90, 300],
  [0, 80, 520],
];

export const FUEL_RING_INDEX = [4, 8];

export const PALETTE = {
  skyTop: 0x2a68ad,
  skyHorizon: 0xa9d2e8,
  fog: 0xc4d9e6,
  sun: 0xfff2c8,
  terrainLow: 0x4a7a38,
  terrainHigh: 0x8a7a52,
  snow: 0xf4f7fa,
  rock: 0x7d7468,
  lake: 0x3f7fb5,
  runway: 0x3a3f46,
  runwayLine: 0xf2f2e8,
  ringNext: 0xff9f1c,
  ringDone: 0x37d67a,
  ringFuel: 0x2ec4b6,
  planeBody: 0xe8590c,
  planeAccent: 0xfdf6e3,
  planeGlass: 0x9fd8ef,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO = '"SF Mono", "Cascadia Code", Consolas, "Roboto Mono", monospace';
