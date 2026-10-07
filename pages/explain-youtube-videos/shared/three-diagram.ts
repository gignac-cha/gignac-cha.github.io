import * as THREE from 'three';
import { createDiagram, HEIGHT, WIDTH } from './diagram';
import { createViewControls } from './view-controls';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ThreeOptions {
  // 3D 를 그릴 영역(SVG 좌표). 기본은 1600×900 전체.
  region?: Region;
  // 정사영 카메라. 장면이 정한 카메라 거리만큼 원근 카메라(시야각 fov)로 보이던 크기를 그대로 보여 준다.
  orthographic?: { fov?: number };
  // 캔버스를 SVG 뒤(behind) 또는 앞(front)에 둔다. 2D 장면 위 일부에만 3D 를 얹을 때는 front.
  placement?: 'behind' | 'front';
}

// Three.js 층: host(16:9 장면 요소) 안의 SVG 와 같은 좌표계(1600×900)에서 region 영역에 WebGL 로 그린다.
// 장면은 카메라를 놓은 뒤 look(target) 으로 바라볼 지점을 정한다. 그 위에 사용자의 시점 조작이 더해진다.
export const createThreeLayer = (host: HTMLElement, { region = { x: 0, y: 0, width: WIDTH, height: HEIGHT }, orthographic, placement = 'behind' }: ThreeOptions = {}) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = 'three-layer-canvas';
  if (placement === 'behind') {
    host.prepend(renderer.domElement);
  } else {
    host.append(renderer.domElement);
  }

  const aspect = region.width / region.height;
  const fov = orthographic?.fov ?? 35;
  const camera = orthographic ? new THREE.OrthographicCamera(-aspect, aspect, 1, -1, .1, 2000) : new THREE.PerspectiveCamera(fov, aspect, .1, 2000);
  const scene = new THREE.Scene();

  // 시점 초기화 버튼: 사용자가 시점을 바꿨을 때만 보인다.
  const resetButton = document.createElement('button');
  resetButton.className = 'three-view-reset';
  resetButton.textContent = '시점 초기화';
  resetButton.hidden = true;
  host.append(resetButton);
  const controls = createViewControls(renderer.domElement, camera, (changed) => (resetButton.hidden = !changed));
  resetButton.addEventListener('click', () => controls.reset());

  // host 안에서 SVG(viewBox 1600×900, 가운데 맞춤)와 같은 16:9 상자를 구하고, 그 안의 region 에 캔버스를 둔다.
  let size = { width: 0, height: 0 };
  const fit = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height || (width === size.width && height === size.height)) {
      return;
    }
    size = { width, height };
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    const left = (width - WIDTH * scale) / 2 + region.x * scale;
    const top = (height - HEIGHT * scale) / 2 + region.y * scale;
    renderer.setSize(region.width * scale, region.height * scale, false);
    Object.assign(renderer.domElement.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${region.width * scale}px`,
      height: `${region.height * scale}px`,
    });
    Object.assign(resetButton.style, {
      left: `${left + 12}px`,
      top: `${top + region.height * scale - 40}px`,
    });
  };

  // 카메라를 놓은 뒤 부른다. 정사영이면 그 거리에서 원근 카메라로 보이던 크기로 맞추고, 사용자 조작을 더한다.
  const look = (target: THREE.Vector3) => {
    if (camera instanceof THREE.OrthographicCamera) {
      const half = camera.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(fov / 2));
      if (camera.top !== half) {
        Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(target);
    camera.updateMatrixWorld();
    controls.apply(target);
  };

  const render = () => {
    fit();
    renderer.render(scene, camera);
  };

  // 3D 위치를 SVG 좌표(1600×900)로 옮긴다. 입체 위에 글자를 붙일 때 쓴다.
  const project = (position: THREE.Vector3) => {
    const point = position.clone().project(camera);
    return { x: region.x + ((point.x + 1) / 2) * region.width, y: region.y + ((1 - point.y) / 2) * region.height };
  };

  return { THREE, renderer, scene, camera, render, project, look };
};

// Three.js 로 그리는 장면 판. 뒤에는 WebGL 캔버스, 앞에는 기존 다이어그램과 같은 1600×900 SVG 를 겹쳐
// 제목·글자는 SVG 로, 입체는 Three.js 로 그린다. 모든 움직임은 update(time) 에서 재생 시간으로 정한다.
export const createThreeDiagram = (className: string, title: string, options: ThreeOptions = {}) => {
  const { element, root } = createDiagram(`${className} three-diagram`, title);
  return { element, root, ...createThreeLayer(element, { ...options, placement: 'behind' }) };
};
