import { createPanel } from '../tools/panel.js';
import { initializeIcons, setIcon, createNotice, downloadCanvas, initializeFullscreen } from '../tools/ui.js';
import { THREE, createStudio } from '../tools/studio.js';
import { spectrum, traceLight } from './optics.js';

window.addEventListener(
  'load',
  () => {
    const element = (id) => document.getElementById(id);
    const footer = document.querySelector('.colophon');
    const panel = createPanel({
      title: 'Prism Garden',
      theme: 'dark',
      indexHref: '../index.html',
      paragraphs: [
        '하나의 빛이 유리 프리즘을 지나며 여러 색과 방향으로 나뉘는 3D 광학 실험입니다. 프리즘을 선택해 위치와 각도를 바꾸면 굴절된 빛의 경로가 함께 달라집니다.',
        '빛의 경로는 프리즘 면과의 교차점과 스넬 법칙으로 계산합니다. 파장별 굴절률 차이를 강조한 기하광학 근사이며, 유리 표면은 Three.js의 투과·분산 재질로 표현합니다.',
      ],
    });
    footer.insertBefore(panel.trigger, footer.lastElementChild);
    document.body.appendChild(panel.element);
    initializeIcons();
    const notice = createNotice(element('notice'));
    const canvas = element('canvas');
    let studio;
    try {
      studio = createStudio(canvas, { radius: 4.2, position: [5, 6, 8], target: [0, 0.65, 0], onMessage: notice.show });
    } catch {
      notice.show('WebGL 2 is unavailable.', true);
      return;
    }
    studio.controls.enabled = false;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const state = { running: !reducedMotion.matches, selected: 0, dispersion: 0.65, index: 1.52, mode: 'place', time: 0 };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#101617', toneMapped: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    ground.receiveShadow = true;
    studio.scene.add(ground);
    studio.scene.fog = new THREE.Fog('#101617', 16, 40);
    const grid = new THREE.GridHelper(16, 32, '#38504c', '#243431');
    grid.position.y = 0.002;
    grid.material.transparent = true;
    grid.material.opacity = 0.26;
    studio.scene.add(grid);
    const initial = [
      { x: -1.55, z: 0, angle: 20, scale: [1, 1.25, 1] },
      { x: 0.85, z: -0.3, angle: -18, scale: [1.2, 0.95, 1.2] },
      { x: 2.65, z: 1.2, angle: 44, scale: [0.75, 0.7, 0.75] },
    ];
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 1.6, 3, 1, false);
    const prisms = initial.map((value, index) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: '#e2f5f0',
        metalness: 0,
        roughness: 0.035,
        transmission: 1,
        thickness: 0.65,
        ior: 1.52,
        dispersion: 1.3,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
        clearcoat: 1,
        flatShading: true,
      });
      const prism = new THREE.Mesh(geometry, material);
      prism.scale.set(...value.scale);
      prism.position.set(value.x, value.scale[1] * 0.8, value.z);
      prism.rotation.y = THREE.MathUtils.degToRad(value.angle);
      prism.userData = { index, angle: value.angle };
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: '#a5d2cd', transparent: true, opacity: 0.45 }),
      );
      prism.add(edges);
      studio.scene.add(prism);
      return prism;
    });
    const selection = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.07, 64),
      new THREE.MeshBasicMaterial({ color: '#d8c781', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
    );
    selection.rotation.x = -Math.PI / 2;
    selection.position.y = 0.012;
    studio.scene.add(selection);
    const source = new THREE.Vector3(-5.5, 0.75, -0.15);
    const direction = new THREE.Vector3(1, 0, 0.025).normalize();
    const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
    const beamPools = spectrum.map(({ color }) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      return Array.from({ length: 10 }, () => {
        const mesh = new THREE.Mesh(segmentGeometry, material);
        studio.scene.add(mesh);
        return mesh;
      });
    });
    const up = new THREE.Vector3(0, 1, 0);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
    let drag = null,
      previous = 0,
      dirty = true;

    function updateSelection() {
      const prism = prisms[state.selected];
      selection.position.set(prism.position.x, 0.012, prism.position.z);
      selection.scale.setScalar(prism.scale.x);
      element('selected').value = String(state.selected);
      element('angle').value = prism.userData.angle;
      element('angle-value').value = `${Math.round(prism.userData.angle)}°`;
      element('readout').textContent = `PRISM ${String(state.selected + 1).padStart(2, '0')}`;
    }
    function updateBeams() {
      studio.scene.updateMatrixWorld(true);
      let count = 0;
      spectrum.forEach((band, index) => {
        const refraction = state.index + state.dispersion * 0.07 * ((550 / band.wavelength) ** 2 - 1);
        const points = traceLight(source, direction, prisms, refraction);
        beamPools[index].forEach((mesh, part) => {
          mesh.visible = part < points.length - 1;
          if (!mesh.visible) return;
          const segment = points[part + 1].clone().sub(points[part]);
          mesh.position.copy(points[part]).addScaledVector(segment, 0.5);
          mesh.quaternion.setFromUnitVectors(up, segment.clone().normalize());
          mesh.scale.set(0.01, segment.length(), 0.01);
          count++;
        });
      });
      element('ray-count').textContent = `07 BANDS / ${count} SEGMENTS`;
    }
    function pointerRay(event) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, studio.camera);
    }
    function movePrism(x, z) {
      const selected = prisms[state.selected];
      const next = new THREE.Vector2(THREE.MathUtils.clamp(x, -3.4, 3.4), THREE.MathUtils.clamp(z, -2.3, 2.3));
      // Keep circumscribed circles separate so rotating glass never overlaps.
      for (const prism of prisms) {
        if (prism === selected) continue;
        const minimum = 0.8 * (selected.scale.x + prism.scale.x) + 0.04;
        if (Math.hypot(next.x - prism.position.x, next.y - prism.position.z) < minimum) return;
      }
      selected.position.x = next.x;
      selected.position.z = next.y;
      updateSelection();
      dirty = true;
    }
    canvas.addEventListener('pointerdown', (event) => {
      if (state.mode !== 'place' || event.button !== 0 || drag) return;
      pointerRay(event);
      const hit = raycaster.intersectObjects(prisms, false)[0];
      if (!hit) return;
      state.selected = hit.object.userData.index;
      const point = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (!point) return;
      drag = { id: event.pointerId, offset: hit.object.position.clone().sub(point) };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
      canvas.focus({ preventScroll: true });
      updateSelection();
      dirty = true;
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      pointerRay(event);
      const point = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
      if (point) movePrism(point.x + drag.offset.x, point.z + drag.offset.z);
    });
    function release(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const id = drag.id;
      drag = null;
      canvas.classList.remove('dragging');
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
    canvas.addEventListener('keydown', (event) => {
      if (state.mode !== 'place') return;
      const directions = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
      if (!directions[event.key]) return;
      event.preventDefault();
      const [x, z] = directions[event.key];
      movePrism(prisms[state.selected].position.x + x, prisms[state.selected].position.z + z);
    });
    document.querySelectorAll('[name="mode"]').forEach((input) =>
      input.addEventListener('change', () => {
        studio.stopInertia();
        state.mode = input.value;
        studio.controls.enabled = state.mode === 'orbit';
        dirty = true;
      }),
    );
    element('selected').addEventListener('change', (event) => {
      state.selected = Number(event.target.value);
      updateSelection();
      dirty = true;
    });
    element('angle').addEventListener('input', (event) => {
      prisms[state.selected].userData.angle = Number(event.target.value);
      updateSelection();
      dirty = true;
    });
    element('dispersion').addEventListener('input', (event) => {
      state.dispersion = Number(event.target.value) / 100;
      element('dispersion-value').value = event.target.value;
      dirty = true;
    });
    element('refraction').addEventListener('input', (event) => {
      state.index = Number(event.target.value) / 100;
      element('refraction-value').value = state.index.toFixed(2);
      dirty = true;
    });
    function playback() {
      setIcon(element('play'), state.running ? 'pause' : 'play');
      element('play').setAttribute('aria-label', state.running ? 'Pause' : 'Play');
      element('play').dataset.tip = state.running ? 'Pause' : 'Play';
      previous = 0;
      dirty = true;
    }
    element('play').addEventListener('click', () => {
      state.running = !state.running;
      studio.stopInertia();
      playback();
    });
    element('reset').addEventListener('click', () => {
      initial.forEach((value, index) => {
        prisms[index].position.set(value.x, value.scale[1] * 0.8, value.z);
        prisms[index].userData.angle = value.angle;
      });
      state.time = 0;
      state.selected = 0;
      studio.resetView();
      updateSelection();
      dirty = true;
    });
    element('save').addEventListener('click', async () => {
      try {
        studio.render();
        await downloadCanvas(canvas, { filename: 'prism-garden.png', caption: 'Prism Garden.', color: '#dbe8de' });
        notice.show('Image saved');
      } catch {
        notice.show('Image could not be saved');
      }
    });
    initializeFullscreen(element('fullscreen'), notice.show);
    reducedMotion.addEventListener('change', (event) => {
      if (event.matches) {
        state.running = false;
        playback();
      }
    });
    document.addEventListener('visibilitychange', () => {
      previous = 0;
    });
    updateSelection();
    playback();
    function frame(time) {
      requestAnimationFrame(frame);
      if (document.hidden || studio.lost) {
        previous = 0;
        return;
      }
      const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
      previous = time;
      if (state.running && !drag) {
        state.time += delta;
        dirty = true;
      }
      const cameraChanged = studio.controls.update();
      const redraw = dirty || cameraChanged || state.running || studio.needsRender;
      if (dirty) {
        prisms.forEach((prism, index) => {
          prism.rotation.y = THREE.MathUtils.degToRad(prism.userData.angle) + Math.sin(state.time * 0.28 + index) * 0.055;
          prism.material.ior = state.index;
          prism.material.dispersion = state.dispersion * 2;
        });
        updateBeams();
        dirty = false;
      }
      if (redraw) studio.render();
    }
    requestAnimationFrame(frame);
  },
  { once: true },
);
