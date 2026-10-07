import * as THREE from 'three';

// 3D 장면의 시점 조작. 끌기 = 회전, 오른쪽 버튼·Shift+끌기 = 이동, 휠 = 확대·축소, 두 번 클릭 = 처음 시점.
// 장면이 정한 카메라 연출(재생 시간에 따른 위치)은 그대로 두고, 그 위에 사용자의 회전·이동·확대를 더한다.
export interface ViewControls {
  // 장면이 카메라를 놓고 바라볼 지점을 정한 뒤 부른다. 사용자의 조작을 더하고 카메라를 그 시점으로 옮긴다.
  apply: (target: THREE.Vector3) => void;
  reset: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const createViewControls = (surface: HTMLElement, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, onChange: (changed: boolean) => void): ViewControls => {
  const view = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
  const changed = () => view.yaw !== 0 || view.pitch !== 0 || view.zoom !== 1 || view.panX !== 0 || view.panY !== 0;
  const notify = () => onChange(changed());

  surface.addEventListener('contextmenu', (event) => event.preventDefault());
  surface.addEventListener('pointerdown', (event) => {
    const mode = event.button === 2 || event.shiftKey ? 'pan' : event.button === 0 ? 'rotate' : undefined;
    if (!mode) {
      return;
    }
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    surface.classList.add('grabbing');
    let last = { x: event.clientX, y: event.clientY };
    const move = (next: PointerEvent) => {
      const dx = next.clientX - last.x;
      const dy = next.clientY - last.y;
      last = { x: next.clientX, y: next.clientY };
      if (mode === 'rotate') {
        view.yaw -= dx * .006;
        view.pitch = clamp(view.pitch - dy * .006, -1.2, 1.2);
      } else {
        view.panX += dx;
        view.panY += dy;
      }
      notify();
    };
    const end = () => {
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', end);
      surface.removeEventListener('pointercancel', end);
      surface.classList.remove('grabbing');
    };
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
  });
  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    view.zoom = clamp(view.zoom * Math.exp(-event.deltaY * .0015), .4, 4);
    notify();
  }, { passive: false });

  const reset = () => {
    Object.assign(view, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 });
    notify();
  };
  surface.addEventListener('dblclick', reset);

  const up = new THREE.Vector3(0, 1, 0);
  const apply = (target: THREE.Vector3) => {
    const offset = camera.position.clone().sub(target);
    offset.applyAxisAngle(up, view.yaw);
    const right = new THREE.Vector3().crossVectors(up, offset).normalize();
    if (right.lengthSq() > 0) {
      offset.applyAxisAngle(right, view.pitch);
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      offset.multiplyScalar(1 / view.zoom);
    } else if (camera.zoom !== view.zoom) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    if (view.panX !== 0 || view.panY !== 0) {
      // 화면에서 끈 픽셀만큼 세계 좌표로 옮긴다.
      const height = surface.clientHeight || 1;
      const worldPerPixel =
        camera instanceof THREE.PerspectiveCamera
          ? (2 * offset.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height
          : (camera.top - camera.bottom) / camera.zoom / height;
      const shift = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .multiplyScalar(-view.panX * worldPerPixel)
        .add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(view.panY * worldPerPixel));
      camera.position.add(shift);
      camera.updateMatrixWorld();
    }
  };

  return { apply, reset };
};
