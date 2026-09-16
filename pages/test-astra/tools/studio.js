import { THREE, OrbitControls, RoomEnvironment } from '../tidal-form/vendor/three-kit.js';

export { THREE };

export function createStudio(canvas, { background = '#101617', position = [5, 5, 8], target = [0, 0.6, 0], radius = 3.5, onMessage = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(background);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const direction = new THREE.Vector3(...position).normalize();
  camera.position.copy(direction);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.rotateSpeed = 0.65;
  let environment;
  let lost = false;
  let needsRender = true;
  let distance = 0;
  const key = new THREE.DirectionalLight('#fff8e7', 3);
  key.position.set(-3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.camera.far = 25;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  key.shadow.blurSamples = 6;
  scene.add(key, new THREE.HemisphereLight('#e4f3f2', '#4f655b', 1.5));
  const fill = new THREE.DirectionalLight('#9bd2e8', 1.2);
  fill.position.set(4, 3, -5);
  scene.add(fill);

  function lightEnvironment() {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const next = generator.fromScene(room, 0.025);
    scene.environment = next.texture;
    environment?.dispose();
    environment = next;
    room.dispose();
    generator.dispose();
  }
  function stopInertia() {
    const oldPosition = camera.position.clone();
    controls.enableDamping = false;
    controls.update();
    needsRender = true;
    camera.position.copy(oldPosition);
    controls.update();
    controls.enableDamping = true;
  }
  function resize() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, bounds.width),
      height = Math.max(1, bounds.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1700000 / (width * height))));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const angle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.min(1, camera.aspect));
    const fit = radius / Math.sin(angle);
    const currentDirection = distance ? camera.position.clone().sub(controls.target).normalize() : direction.clone();
    const zoomRatio = distance ? camera.position.distanceTo(controls.target) / distance : 1;
    stopInertia();
    camera.position.copy(currentDirection.multiplyScalar(fit * THREE.MathUtils.clamp(zoomRatio, 0.7, 1.8))).add(controls.target);
    distance = fit;
    controls.minDistance = fit * 0.7;
    controls.maxDistance = fit * 1.8;
    controls.update();
  }
  function resetView() {
    stopInertia();
    camera.position.copy(direction.clone().multiplyScalar(distance)).add(controls.target);
    controls.update();
  }
  lightEnvironment();
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    environment = null;
    scene.environment = null;
    scene.traverse((object) => {
      if (object.isLight && object.shadow) {
        object.shadow.map = null;
        object.shadow.mapPass = null;
      }
    });
    onMessage('Graphics paused. Waiting for recovery.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      lightEnvironment();
      lost = false;
      needsRender = true;
      onMessage('Scene restored');
    } catch {
      onMessage('Reload this page to restore the scene.');
    }
  });
  canvas.addEventListener('keydown', (event) => {
    if (!controls.enabled) return;
    const turns = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
    if (turns[event.key]) {
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta += turns[event.key][0];
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + turns[event.key][1], controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
    }
  });
  controls.addEventListener('change', () => {
    needsRender = true;
  });
  return {
    renderer,
    scene,
    camera,
    controls,
    resize,
    resetView,
    stopInertia,
    render() {
      if (!lost) {
        renderer.render(scene, camera);
        needsRender = false;
      }
    },
    get lost() {
      return lost;
    },
    get needsRender() {
      return needsRender;
    },
  };
}
