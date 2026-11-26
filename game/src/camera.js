// The camera: a chase view that trails the plane and leans with its bank, a cockpit
// view from the pilot's seat, and a slow orbit for the title screen.
export const CAM_CHASE = 'chase';
export const CAM_COCKPIT = 'cockpit';
export const CAM_ORBIT = 'orbit';

export function createCamera(camera) {
  let mode = CAM_CHASE;
  const chasePos = new THREE.Vector3(0, 60, 460);
  const chaseLook = new THREE.Vector3(0, 50, 400);
  const tmp = new THREE.Vector3();

  function forwardOf(plane) {
    return new THREE.Vector3(Math.sin(plane.heading), 0, Math.cos(plane.heading));
  }

  function update(dt, plane, time, heightAt) {
    if (mode === CAM_ORBIT) {
      const angle = time * 0.12;
      const radius = 26;
      tmp.set(
        plane.position.x + Math.sin(angle) * radius,
        plane.position.y + 7 + Math.sin(time * 0.3) * 1.5,
        plane.position.z + Math.cos(angle) * radius,
      );
      camera.position.lerp(tmp, Math.min(1, dt * 2));
      // Look a little above the plane so it sits below the title text.
      camera.lookAt(plane.position.x, plane.position.y + 6, plane.position.z);
      camera.rotation.z = 0;
      return;
    }
    const forward = forwardOf(plane);
    if (mode === CAM_COCKPIT) {
      tmp.copy(plane.position).addScaledVector(forward, 1.6);
      tmp.y += 1.35;
      camera.position.copy(tmp);
      tmp.copy(plane.position).addScaledVector(forward, 60);
      tmp.y += Math.sin(plane.pitch) * 60;
      camera.lookAt(tmp);
      camera.rotation.z = -plane.bank * 0.25;
      return;
    }
    // Chase: behind and above, smoothed so the view never snaps.
    tmp.copy(plane.position).addScaledVector(forward, -15);
    tmp.y += 5.2;
    const ground = heightAt(tmp.x, tmp.z) + 2.5;
    if (tmp.y < ground) tmp.y = ground;
    chasePos.lerp(tmp, Math.min(1, dt * 4.5));
    camera.position.copy(chasePos);
    tmp.copy(plane.position).addScaledVector(forward, 26);
    tmp.y += 1.5;
    chaseLook.lerp(tmp, Math.min(1, dt * 6));
    camera.lookAt(chaseLook);
    camera.rotation.z += plane.bank * 0.15;
  }

  return {
    get mode() {
      return mode;
    },
    setMode(next) {
      mode = next;
      if (next === CAM_CHASE) chasePos.copy(camera.position);
    },
    toggle() {
      this.setMode(mode === CAM_CHASE ? CAM_COCKPIT : CAM_CHASE);
      return mode;
    },
    update,
  };
}
