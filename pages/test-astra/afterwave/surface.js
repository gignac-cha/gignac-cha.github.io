import GL from './vendor/lightgl.js';
import { Water } from './vendor/water.js';

const vertex = `
  varying vec2 coord;
  void main() { coord = gl_Vertex.xy * 0.5 + 0.5; gl_Position = vec4(gl_Vertex.xyz, 1.0); }
`;
const fragment = `
  uniform sampler2D water;
  uniform vec2 view;
  uniform float lightAngle;
  uniform float material;
  varying vec2 coord;

  vec3 environment(vec3 ray, vec3 tint) {
    float angle = lightAngle;
    vec2 rotated = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * ray.xz;
    float ribbon = exp(-pow((rotated.x + 0.22) / 0.075, 2.0));
    float broad = exp(-pow((rotated.x - 0.25) / 0.27, 2.0));
    float rim = exp(-pow((rotated.y + 0.38) / 0.085, 2.0));
    float fine = exp(-pow((rotated.x + 0.04) / 0.023, 2.0));
    vec3 illumination = tint * (0.12 + broad * 0.5);
    illumination += vec3(0.94, 1.0, 0.96) * (ribbon * 1.45 + fine * 0.28);
    illumination += vec3(0.95, 0.65, 0.39) * rim * 0.37;
    return illumination;
  }

  void main() {
    vec4 info = texture2D(water, coord);
    vec2 slope = info.ba;
    vec3 normal = normalize(vec3(slope.x * 1.9, sqrt(max(0.001, 1.0 - dot(slope, slope))), slope.y * 1.9));
    vec3 eye = normalize(vec3((coord.x - 0.5) * 0.24, -1.0, (coord.y - 0.5) * 0.18));
    vec3 ray = reflect(eye, normal);
    vec3 tint = vec3(0.47, 0.66, 0.65);
    if (material == 1.0) {
      tint = 0.52 + 0.29 * cos(6.28318 * (vec3(0.11, 0.38, 0.61) + dot(normal, normalize(vec3(0.8, 0.3, 0.4))) * 0.8));
    } else if (material == 2.0) {
      tint = vec3(0.47, 0.52, 0.56);
    }
    vec3 metal = environment(ray, tint);
    if (material == 2.0) metal = mix(vec3(dot(metal, vec3(0.2126, 0.7152, 0.0722))), metal, 0.15) * 0.72;
    float activity = smoothstep(0.004, 0.07, length(slope));
    vec3 background = vec3(0.04706, 0.05490, 0.06275);
    vec3 color = mix(background, metal, activity);
    vec2 edge = min(coord, 1.0 - coord) * view;
    float fade = smoothstep(0.0, 65.0, min(edge.x, edge.y));
    color = mix(background, color, fade);
    color = color / (vec3(1.0) + color * 0.38);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function dimensions(width, height, maximum = 384) {
  const scale = maximum / Math.max(width, height);
  return [Math.max(64, Math.round(width * scale)), Math.max(64, Math.round(height * scale))];
}

function setupCanvas(canvas, oldCanvas, kind) {
  canvas.id = 'surface';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A metallic wave surface that preserves and propagates each touch');
  canvas.dataset.renderer = kind;
  oldCanvas.replaceWith(canvas);
  return canvas;
}

function createGPU(oldCanvas, width, height) {
  const gl = GL.create({
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  gl.getExtension('WEBGL_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  const [gridWidth, gridHeight] = dimensions(width, height);
  const water = new Water(gl, gridWidth, gridHeight);
  const shader = new GL.Shader(vertex, fragment);
  const canvas = setupCanvas(gl.canvas, oldCanvas, 'webgl');
  const engine = {
    kind: 'webgl',
    canvas,
    resize(width, height) {
      const [gridWidth, gridHeight] = dimensions(width, height);
      water.resize(gridWidth, gridHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1900000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    drop(x, y, radius, strength) {
      water.addDrop(x * 2 - 1, (1 - y) * 2 - 1, radius, strength);
    },
    step(damping) {
      water.stepSimulation(damping);
    },
    clear() {
      water.clear();
    },
    render({ width, height, light, material }) {
      water.updateNormals();
      water.textureA.bind(0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      shader
        .uniforms({ water: 0, view: [width, height], lightAngle: (light * Math.PI) / 180, material })
        .draw(water.plane);
    },
  };
  engine.resize(width, height);
  return engine;
}

// CPU port of Water's neighbor-average/velocity update for unsupported GPUs.
function createCPU(oldCanvas, width, height) {
  const canvas = setupCanvas(document.createElement('canvas'), oldCanvas, 'canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas unavailable');
  let gridWidth = 0,
    gridHeight = 0;
  let heights, velocities, nextHeights, nextVelocities, attenuation, image;
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const engine = {
    kind: 'canvas',
    canvas,
    resize(width, height) {
      const [newWidth, newHeight] = dimensions(width, height, 256);
      if (newWidth === gridWidth && newHeight === gridHeight) return;
      const oldHeights = heights,
        oldVelocities = velocities,
        oldWidth = gridWidth,
        oldHeight = gridHeight;
      gridWidth = canvas.width = newWidth;
      gridHeight = canvas.height = newHeight;
      heights = new Float32Array(gridWidth * gridHeight);
      velocities = new Float32Array(heights.length);
      nextHeights = new Float32Array(heights.length);
      nextVelocities = new Float32Array(heights.length);
      attenuation = new Float32Array(heights.length);
      image = context.createImageData(gridWidth, gridHeight);
      for (let y = 0; y < gridHeight; y++)
        for (let x = 0; x < gridWidth; x++) {
          const index = y * gridWidth + x;
          attenuation[index] =
            0.88 +
            0.12 * smooth(0, 12, Math.min(x + 0.5, y + 0.5, gridWidth - x - 0.5, gridHeight - y - 0.5));
          if (oldHeights) {
            const previous =
              Math.min(oldHeight - 1, Math.floor((y / gridHeight) * oldHeight)) * oldWidth +
              Math.min(oldWidth - 1, Math.floor((x / gridWidth) * oldWidth));
            heights[index] = oldHeights[previous];
            velocities[index] = oldVelocities[previous];
          }
        }
    },
    drop(x, y, radius, strength) {
      const cx = x * gridWidth,
        cy = y * gridHeight;
      const size = radius * Math.min(gridWidth, gridHeight);
      for (
        let row = Math.max(0, Math.floor(cy - size));
        row < Math.min(gridHeight, Math.ceil(cy + size));
        row++
      ) {
        for (
          let column = Math.max(0, Math.floor(cx - size));
          column < Math.min(gridWidth, Math.ceil(cx + size));
          column++
        ) {
          const distance = Math.hypot(column + 0.5 - cx, row + 0.5 - cy);
          if (distance < size)
            heights[row * gridWidth + column] +=
              (0.5 - Math.cos((1 - distance / size) * Math.PI) * 0.5) * strength;
        }
      }
    },
    step(damping) {
      for (let y = 0; y < gridHeight; y++)
        for (let x = 0; x < gridWidth; x++) {
          const i = y * gridWidth + x;
          const average =
            (heights[y * gridWidth + Math.max(0, x - 1)] +
              heights[y * gridWidth + Math.min(gridWidth - 1, x + 1)] +
              heights[Math.max(0, y - 1) * gridWidth + x] +
              heights[Math.min(gridHeight - 1, y + 1) * gridWidth + x]) *
            0.25;
          nextVelocities[i] = (velocities[i] + (average - heights[i]) * 2) * damping * attenuation[i];
          nextHeights[i] = (heights[i] + nextVelocities[i]) * attenuation[i];
        }
      [heights, nextHeights] = [nextHeights, heights];
      [velocities, nextVelocities] = [nextVelocities, velocities];
    },
    clear() {
      heights.fill(0);
      velocities.fill(0);
    },
    render({ width, height, light, material }) {
      const angle = (light * Math.PI) / 180;
      const cosine = Math.cos(angle),
        sine = Math.sin(angle);
      const size = Math.min(gridWidth, gridHeight);
      for (let y = 0; y < gridHeight; y++)
        for (let x = 0; x < gridWidth; x++) {
          const i = y * gridWidth + x;
          const dx =
            (heights[y * gridWidth + Math.max(0, x - 1)] -
              heights[y * gridWidth + Math.min(gridWidth - 1, x + 1)]) *
            size *
            0.5;
          const dy =
            (heights[Math.min(gridHeight - 1, y + 1) * gridWidth + x] -
              heights[Math.max(0, y - 1) * gridWidth + x]) *
            size *
            0.5;
          const normalLength = Math.hypot(dx, 1, dy);
          const nx = dx / normalLength,
            nz = dy / normalLength;
          const length = Math.hypot(nx * 1.9, 1 / normalLength, nz * 1.9);
          const metalX = (nx * 1.9) / length,
            metalY = 1 / normalLength / length,
            metalZ = (nz * 1.9) / length;
          const rx = 2 * metalX * metalY,
            rz = 2 * metalZ * metalY;
          const rotatedX = cosine * rx + sine * rz,
            rotatedY = -sine * rx + cosine * rz;
          const ribbon = Math.exp(-(((rotatedX + 0.22) / 0.075) ** 2));
          const broad = Math.exp(-(((rotatedX - 0.25) / 0.27) ** 2));
          const rim = Math.exp(-(((rotatedY + 0.38) / 0.085) ** 2));
          const fine = Math.exp(-(((rotatedX + 0.04) / 0.023) ** 2));
          const activity = smooth(0.004, 0.07, Math.hypot(nx, nz));
          const fade = smooth(
            0,
            65,
            Math.min(
              ((x + 0.5) / gridWidth) * width,
              ((y + 0.5) / gridHeight) * height,
              ((gridWidth - x - 0.5) / gridWidth) * width,
              ((gridHeight - y - 0.5) / gridHeight) * height,
            ),
          );
          for (let channel = 0; channel < 3; channel++) {
            let tint = [0.47, 0.66, 0.65][channel];
            if (material === 1)
              tint =
                0.52 +
                0.29 *
                  Math.cos(
                    2 *
                      Math.PI *
                      ([0.11, 0.38, 0.61][channel] +
                        ((metalX * 0.8 + metalY * 0.3 + metalZ * 0.4) / Math.sqrt(0.89)) * 0.8),
                  );
            if (material === 2) tint = 0.5;
            let metal =
              tint * (0.12 + broad * 0.5) +
              [0.94, 1, 0.96][channel] * (ribbon * 1.45 + fine * 0.28) +
              (material === 2 ? 0.7 : [0.95, 0.65, 0.39][channel]) * rim * 0.37;
            if (material === 2) metal *= 0.72;
            const background = [12, 14, 16][channel] / 255;
            const color = background + (metal - background) * activity * fade;
            image.data[i * 4 + channel] = (color / (1 + color * 0.38)) * 255;
          }
          image.data[i * 4 + 3] = 255;
        }
      context.putImageData(image, 0, 0);
    },
  };
  engine.resize(width, height);
  return engine;
}

export function createSurface(canvas, width, height, forceCanvas = false) {
  if (!forceCanvas) {
    try {
      return createGPU(canvas, width, height);
    } catch (error) {
      console.warn('Afterwave: using the Canvas renderer.', error.message);
    }
  }
  return createCPU(canvas, width, height);
}
