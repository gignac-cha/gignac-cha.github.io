import * as THREE from 'three';
import { createDiagram, HEIGHT, WIDTH } from './diagram';

// Three.js 로 그리는 장면 판. 뒤에는 WebGL 캔버스, 앞에는 기존 다이어그램과 같은 1600×900 SVG 를 겹쳐
// 제목·글자는 SVG 로, 입체는 Three.js 로 그린다. 모든 움직임은 update(time) 에서 재생 시간으로 정한다.
export const createThreeDiagram = (className: string, title: string) => {
  const { element, root } = createDiagram(`${className} three-diagram`, title);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = 'three-diagram-canvas';
  element.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, WIDTH / HEIGHT, .1, 2000);

  // 영역 안에서 가장 큰 16:9 상자에 그린다. SVG 의 viewBox(가운데 맞춤)와 같은 상자라 project() 가 그대로 맞는다.
  let size = { width: 0, height: 0 };
  const fit = () => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width && height && (width !== size.width || height !== size.height)) {
      size = { width, height };
      const boxWidth = Math.min(width, (height * WIDTH) / HEIGHT);
      const boxHeight = (boxWidth * HEIGHT) / WIDTH;
      renderer.setSize(boxWidth, boxHeight, false);
      Object.assign(renderer.domElement.style, {
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        left: `${(width - boxWidth) / 2}px`,
        top: `${(height - boxHeight) / 2}px`,
      });
      camera.aspect = WIDTH / HEIGHT;
      camera.updateProjectionMatrix();
    }
  };

  const render = () => {
    fit();
    renderer.render(scene, camera);
  };

  // 3D 위치를 SVG 좌표(1600×900)로 옮긴다. 입체 위에 글자를 붙일 때 쓴다.
  const project = (position: THREE.Vector3) => {
    const point = position.clone().project(camera);
    return { x: ((point.x + 1) / 2) * WIDTH, y: ((1 - point.y) / 2) * HEIGHT };
  };

  return { element, root, THREE, renderer, scene, camera, render, project };
};
