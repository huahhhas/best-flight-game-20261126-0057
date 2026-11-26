// Keyboard and mouse: arrows/WASD fly the plane, Shift/Ctrl work the throttle,
// Space is the brake, C swaps the camera, P pauses, M mutes. The mouse steers too —
// hold the pointer off-centre and the plane banks toward it — but any key wins.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeenAt = 0;
  let mouseActive = false;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyC') actions |= ACTION_CAMERA;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function keyUp(event) {
    keys.delete(event.code);
  }
  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    mouseSeenAt = performance.now();
    mouseActive = true;
  }
  function blur() {
    keys.clear();
    mouseActive = false;
  }
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointermove', pointerMove);

  function control(dt) {
    const pitchKey = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
      - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
    const bankKey = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
      - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    let pitch = pitchKey;
    let bank = bankKey;
    // Mouse steering: a gentle hand on the stick, only while the pointer has
    // moved recently and no key is steering the same axis.
    if (mouseActive && performance.now() - mouseSeenAt < 2500) {
      if (pitchKey === 0) pitch = Math.max(-1, Math.min(1, -mouseY * 2.2));
      if (bankKey === 0) bank = Math.max(-1, Math.min(1, mouseX * 2.2));
    }
    const throttleDelta = ((keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0)
      - (keys.has('ControlLeft') || keys.has('ControlRight') ? 1 : 0)) * 0.55 * dt;
    return {
      pitch,
      bank,
      throttleDelta,
      brake: keys.has('Space'),
    };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { control, takeActions };
}
