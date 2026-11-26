// Synthesised sound — no audio files: a low engine drone that follows the throttle,
// wind that rises with speed, and short chimes for rings, landings and crashes.
// Everything starts on the first gesture, so browsers never block it.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(context.destination);
    engineOsc.start();
    // Wind: looped noise through a bandpass, its gain tied to airspeed.
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    noise.connect(band).connect(windGain).connect(context.destination);
    noise.start();
  }

  function resume() {
    if (context && context.state === 'suspended') context.resume();
  }

  function update(throttle, speed, airborne) {
    if (!context) return;
    const t = context.currentTime;
    engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + throttle * 0.06, t, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + throttle * 88, t, 0.1);
    engineFilter.frequency.setTargetAtTime(280 + throttle * 900, t, 0.1);
    windGain.gain.setTargetAtTime(muted || !airborne ? 0 : Math.min(0.12, speed * 0.0013), t, 0.15);
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!context || muted) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    start,
    resume,
    update,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    ring() {
      tone(880, 0.25, 'sine', 0.16);
      tone(1318, 0.35, 'sine', 0.14, 0.08);
    },
    fuel() {
      tone(659, 0.2, 'sine', 0.16);
      tone(988, 0.3, 'sine', 0.14, 0.07);
    },
    land() {
      tone(220, 0.3, 'triangle', 0.2);
      tone(330, 0.4, 'triangle', 0.16, 0.1);
    },
    crash() {
      tone(90, 0.7, 'sawtooth', 0.22);
      tone(55, 0.9, 'square', 0.14, 0.05);
    },
    click() {
      tone(520, 0.08, 'sine', 0.1);
    },
  };
}
