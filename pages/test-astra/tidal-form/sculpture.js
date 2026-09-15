import { THREE, OrbitControls, RoomEnvironment } from './vendor/three-kit.js';
import { RING_COUNT, ringPose } from './form.js';
const finishes = [
  { color: '#354246', metalness: 0.93, roughness: 0.32, edge: '#899b9b' },
  { color: '#e5e6df', metalness: 0.12, roughness: 0.3, edge: '#bac9c2' },
  { color: '#387d72', metalness: 0.7, roughness: 0.34, edge: '#83b4a0' },
];

function loopGeometry() {
  const shape = new THREE.Shape();
  const hole = new THREE.Path();
  const segments = 128;
  function point(index, scale) {
    const angle = (index / segments) * Math.PI * 2;
    const radius = (1 + Math.cos(angle * 3) * 0.065) * scale;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.79];
  }
  for (let i = 0; i <= segments; i++) {
    const [x, y] = point(i, 1);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const [x, y] = point(i, 0.951);
    if (i === segments) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.0125, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export class Sculpture {
  constructor(stage, callbacks) {
    this.stage = stage;
    this.callbacks = callbacks;
    this.canvas = stage.querySelector('canvas');
    this.state = {
      form: 0,
      openness: 0.16,
      twist: (105 * Math.PI) / 180,
      finish: 0,
      time: 0,
      pulse: 0,
      turn: true,
      running: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
    this.dirty = true;
    this.lost = false;
    this.previousTime = 0;
    this.hovered = -1;
    this.lastPicked = 0;
    this.pointerInside = false;
    this.interacting = false;
    this.frameId = 0;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor('#e5e9e7');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e5e9e7');
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(6, 3.8, 8);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.78;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.65;
    this.controls.addEventListener('start', () => {
      this.interacting = true;
      this.canvas.classList.add('dragging');
      this.setHover(-1);
    });
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.canvas.classList.remove('dragging');
      this.dirty = true;
    });
    this.controls.addEventListener('change', () => {
      this.dirty = true;
    });
    this.group = new THREE.Group();
    this.group.rotation.z = -0.06;
    this.scene.add(this.group);
    this.geometry = loopGeometry();
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: finishes[0].color,
      metalness: finishes[0].metalness,
      roughness: finishes[0].roughness,
      clearcoat: 0.22,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.1,
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: finishes[0].edge,
      metalness: 0.92,
      roughness: 0.28,
      envMapIntensity: 1.1,
    });
    this.accentMaterial = new THREE.MeshPhysicalMaterial({
      color: '#a43b29',
      metalness: 0.54,
      roughness: 0.3,
      clearcoat: 0.35,
    });
    this.hoverMaterial = new THREE.MeshPhysicalMaterial({
      color: '#e3774e',
      metalness: 0.58,
      roughness: 0.25,
      clearcoat: 0.5,
    });
    this.materials = {
      body: [this.bodyMaterial, this.edgeMaterial],
      accent: [this.accentMaterial, this.edgeMaterial],
      hover: [this.hoverMaterial, this.edgeMaterial],
    };
    this.rings = Array.from({ length: RING_COUNT }, (_, index) => {
      const ring = new THREE.Mesh(
        this.geometry,
        index >= 14 && index <= 16 ? this.materials.accent : this.materials.body,
      );
      ring.castShadow = true;
      ring.receiveShadow = true;
      ring.userData.index = index;
      this.group.add(ring);
      return ring;
    });
    const ambient = new THREE.HemisphereLight('#f7fbf7', '#84958e', 1.2);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight('#fff7eb', 2.6);
    key.position.set(-3, 8, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.blurSamples = 8;
    key.shadow.camera.left = key.shadow.camera.bottom = -5;
    key.shadow.camera.right = key.shadow.camera.top = 5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.normalBias = 0.018;
    key.shadow.bias = -0.00015;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#cce7f0', 1.5);
    fill.position.set(5, 2, -4);
    this.scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.ShadowMaterial({ color: '#54625d', opacity: 0.14 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.spherical = new THREE.Spherical();
    this.environmentTarget = null;
    this.setEnvironment();
    this.applyPoses(0, true);
    this.resize();
    this.bindEvents();
    this.frameId = requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  setEnvironment() {
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const next = generator.fromScene(room, 0.025);
    this.scene.environment = next.texture;
    this.environmentTarget?.dispose();
    this.environmentTarget = next;
    room.dispose();
    generator.dispose();
  }

  applyPoses(delta, immediate = false) {
    for (let index = 0; index < this.rings.length; index++) {
      const ring = this.rings[index];
      const hover = this.hovered < 0 ? 0 : Math.exp(-(((index - this.hovered) / 4) ** 2));
      const localPulse = this.state.pulse * (0.5 + 0.5 * Math.cos(index * 0.25 - this.state.time * 5));
      const pose = ringPose(index, { ...this.state, pulse: localPulse, hover });
      const follow = (current, target) =>
        immediate ? target : THREE.MathUtils.damp(current, target, 8, delta);
      ring.position.set(
        follow(ring.position.x, pose.x),
        follow(ring.position.y, pose.y),
        follow(ring.position.z, pose.z),
      );
      ring.scale.set(follow(ring.scale.x, pose.radius), 1, follow(ring.scale.z, pose.radius));
      ring.rotation.set(
        follow(ring.rotation.x, pose.rotationX),
        follow(ring.rotation.y, pose.rotationY),
        follow(ring.rotation.z, pose.rotationZ),
      );
      ring.material =
        index === this.hovered
          ? this.materials.hover
          : index >= 14 && index <= 16
            ? this.materials.accent
            : this.materials.body;
    }
  }

  setHover(index) {
    if (index === this.hovered) return;
    this.hovered = index;
    this.canvas.classList.toggle('hovering', index >= 0);
    this.callbacks.hover(index);
    this.dirty = true;
  }

  stopCameraInertia() {
    // Consume OrbitControls' pending movement, then restore the current view.
    const position = this.camera.position.clone();
    const target = this.controls.target.clone();
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
    this.controls.enableDamping = damping;
  }

  fitCamera(reset = false) {
    this.stopCameraInertia();
    const minAngle = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * Math.min(1, this.camera.aspect),
    );
    const radius = (this.state.form === 2 ? 2.05 : 2.55) + this.state.openness * 0.3;
    const fitDistance = (radius / Math.sin(minAngle)) * 1.03;
    const direction = reset
      ? new THREE.Vector3(6, 3.8, 8).normalize()
      : this.camera.position.clone().sub(this.controls.target).normalize();
    const ratio =
      reset || !this.fitDistance
        ? 1
        : this.camera.position.distanceTo(this.controls.target) / this.fitDistance;
    this.camera.position
      .copy(direction.multiplyScalar(fitDistance * Math.min(1.8, Math.max(0.65, ratio))))
      .add(this.controls.target);
    this.controls.minDistance = fitDistance * 0.65;
    this.controls.maxDistance = fitDistance * 1.8;
    this.fitDistance = fitDistance;
    this.controls.update();
    this.dirty = true;
  }

  resize() {
    const width = Math.max(1, this.stage.clientWidth),
      height = Math.max(1, this.stage.clientHeight);
    this.renderer.setPixelRatio(
      Math.min(Math.max(devicePixelRatio || 1, 1.25), 1.75, Math.sqrt(1900000 / (width * height))),
    );
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  bindEvents() {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.stage);
    this.canvas.addEventListener('pointermove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.pointerInside = event.pointerType !== 'touch';
      this.lastPicked = 0;
      this.dirty = true;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.pointerInside = false;
      this.setHover(-1);
    });
    this.canvas.addEventListener('dblclick', (event) => {
      event.preventDefault();
      this.impulse();
    });
    this.canvas.addEventListener('keydown', (event) => {
      const orbit = {
        ArrowLeft: [-0.08, 0],
        ArrowRight: [0.08, 0],
        ArrowUp: [0, -0.08],
        ArrowDown: [0, 0.08],
      };
      if (orbit[event.key]) {
        event.preventDefault();
        this.spherical.setFromVector3(this.camera.position.clone().sub(this.controls.target));
        this.spherical.theta += orbit[event.key][0];
        this.spherical.phi = THREE.MathUtils.clamp(
          this.spherical.phi + orbit[event.key][1],
          this.controls.minPolarAngle,
          this.controls.maxPolarAngle,
        );
        this.camera.position.setFromSpherical(this.spherical).add(this.controls.target);
        this.controls.update();
      } else if (['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        const direction = this.camera.position.clone().sub(this.controls.target);
        const distance = THREE.MathUtils.clamp(
          direction.length() * (event.key === '-' ? 1.1 : 0.9),
          this.controls.minDistance,
          this.controls.maxDistance,
        );
        this.camera.position.copy(direction.setLength(distance)).add(this.controls.target);
        this.controls.update();
      }
      this.dirty = true;
    });
    document.addEventListener('visibilitychange', () => {
      this.previousTime = 0;
      this.pointerInside = false;
      this.setHover(-1);
    });
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
      this.controls.enabled = false;
      // The lost context owns these handles; they cannot be deleted after restoration.
      this.scene.environment = null;
      this.environmentTarget = null;
      this.scene.traverse((object) => {
        if (object.isLight && object.shadow) {
          object.shadow.map = null;
          object.shadow.mapPass = null;
          object.shadow.needsUpdate = true;
        }
      });
      this.callbacks.message('Graphics paused. Waiting for recovery.', true);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      try {
        this.setEnvironment();
        this.lost = false;
        this.controls.enabled = true;
        this.previousTime = 0;
        this.dirty = true;
        this.callbacks.message('Sculpture restored');
      } catch {
        this.callbacks.message('Reload this page to restore the sculpture.', true);
      }
    });
  }

  set(name, value) {
    this.state[name] = value;
    if (name === 'finish') {
      const finish = finishes[value];
      this.bodyMaterial.color.set(finish.color);
      this.bodyMaterial.metalness = finish.metalness;
      this.bodyMaterial.roughness = finish.roughness;
      this.edgeMaterial.color.set(finish.edge);
      this.edgeMaterial.metalness = value === 1 ? 0.18 : 0.92;
      this.edgeMaterial.roughness = value === 1 ? 0.4 : 0.28;
    }
    if (name === 'form' || name === 'openness') this.fitCamera();
    if (name === 'running') {
      this.previousTime = 0;
      if (!value) this.stopCameraInertia();
    }
    this.dirty = true;
  }

  impulse() {
    this.state.pulse = 1;
    this.dirty = true;
  }

  resetView() {
    this.controls.target.set(0, 0, 0);
    this.group.rotation.y = 0;
    this.state.time = 0;
    this.state.pulse = 0;
    this.setHover(-1);
    this.applyPoses(0, true);
    this.fitCamera(true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  frame(timestamp) {
    this.frameId = requestAnimationFrame((next) => this.frame(next));
    if (document.hidden || this.lost) {
      this.previousTime = 0;
      return;
    }
    const delta = this.previousTime ? Math.min((timestamp - this.previousTime) / 1000, 0.05) : 0;
    this.previousTime = timestamp;
    const cameraChanged = this.controls.update();
    if (this.state.running) {
      this.state.time += delta;
      this.state.pulse *= Math.exp(-delta * 1.5);
      if (this.state.turn && !this.interacting) this.group.rotation.y += delta * 0.09;
    }
    if (this.pointerInside && !this.interacting && timestamp - this.lastPicked > 80) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.rings, false)[0];
      this.setHover(hit ? hit.object.userData.index : -1);
      this.lastPicked = timestamp;
    }
    if (this.state.running || this.dirty || cameraChanged) {
      this.applyPoses(delta, !this.state.running);
      this.render();
      this.callbacks.time(this.state.time);
      this.dirty = false;
    }
  }
}
