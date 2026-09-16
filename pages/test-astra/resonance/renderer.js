import { sample } from './wave-field.js';

const palettes = [
  [
    [0.44, 0.78, 0.73],
    [0.94, 0.65, 0.52],
  ],
  [
    [0.6, 0.73, 0.93],
    [0.9, 0.64, 0.76],
  ],
  [
    [0.59, 0.67, 0.65],
    [0.95, 0.95, 0.88],
  ],
];
const vertexSource = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;
const fragmentSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  uniform vec2 u_resolution;
  uniform vec2 u_view;
  uniform vec3 u_sources[6];
  uniform int u_count;
  uniform float u_time;
  uniform float u_wavelength;
  uniform int u_mode;
  uniform vec3 u_cool;
  uniform vec3 u_warm;

  vec3 field(vec2 point) {
    float height = 0.0;
    vec2 slope = vec2(0.0);
    float frequency = 6.28318530718 / u_wavelength;
    for (int i = 0; i < 6; i++) {
      if (i >= u_count) break;
      vec2 delta = point - u_sources[i].xy;
      float distance = length(delta);
      float attenuation = 1.0 / (1.0 + distance * 0.0015);
      float phase = distance * frequency - u_time + u_sources[i].z;
      float wave = sin(phase);
      height += wave * attenuation;
      slope += (cos(phase) * frequency * attenuation - wave * 0.0015 * attenuation * attenuation) * delta / max(distance, 0.0001);
    }
    return vec3(height, slope) / sqrt(max(float(u_count), 1.0));
  }

  void main() {
    vec2 point = gl_FragCoord.xy / u_resolution * u_view;
    point.y = u_view.y - point.y;
    vec2 samplePoint = point;
    if (u_mode == 2) samplePoint = (floor(point / 7.0) + 0.5) * 7.0;
    vec3 wave = field(samplePoint);
    float value = wave.x;
    vec3 ink = mix(u_cool, u_warm, smoothstep(-0.7, 0.7, value));
    vec3 background = vec3(0.04314, 0.05490, 0.06275);
    vec3 color;
    if (u_mode == 0) {
      float contour = abs(sin(value * 8.0));
      float width = clamp(length(wave.yz) * 6.5 * u_view.x / u_resolution.x, 0.04, 0.6);
      float line = 1.0 - smoothstep(0.025, width + 0.035, contour);
      float body = pow(abs(value) * 0.58, 2.0);
      color = background + ink * (line * 0.85 + body * 0.13);
    } else if (u_mode == 1) {
      vec3 normal = normalize(vec3(-wave.y * 24.0, -wave.z * 24.0, 1.0));
      float light = max(0.0, dot(normal, normalize(vec3(-0.6, -0.8, 0.7))));
      float crest = pow(max(0.0, light), 9.0);
      color = background + ink * (0.055 + light * 0.35) + vec3(0.7, 0.8, 0.74) * crest * 0.35;
    } else {
      float radius = 0.5 + min(1.0, abs(value)) * 2.1;
      float dotShape = 1.0 - smoothstep(radius - 0.45, radius + 0.45, length(point - samplePoint));
      color = background + ink * dotShape * (0.2 + min(1.0, abs(value)) * 0.7);
    }
    vec2 grid = abs(mod(point + 24.0, 48.0) - 24.0);
    float gridLine = 1.0 - smoothstep(0.0, 0.65, min(grid.x, grid.y));
    color += vec3(0.012) * gridLine;
    vec2 edge = min(point, u_view - point);
    float fade = smoothstep(0.0, 65.0, min(edge.x, edge.y));
    color = mix(background, color, 0.2 + 0.8 * fade);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createWebGL(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  if (!gl) throw new Error('WebGL unavailable');
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      throw new Error(message);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(
    ['resolution', 'view', 'sources', 'count', 'time', 'wavelength', 'mode', 'cool', 'warm'].map((name) => [
      name,
      gl.getUniformLocation(program, `u_${name}${name === 'sources' ? '[0]' : ''}`),
    ]),
  );
  const sourceData = new Float32Array(18);
  return {
    canvas,
    kind: 'webgl',
    resize(width, height) {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2200000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render(state) {
      sourceData.fill(0);
      state.sources.forEach((source, index) => sourceData.set([source.x, source.y, source.phase], index * 3));
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.view, state.width, state.height);
      gl.uniform3fv(uniforms.sources, sourceData);
      gl.uniform1i(uniforms.count, state.sources.length);
      gl.uniform1f(uniforms.time, state.time);
      gl.uniform1f(uniforms.wavelength, state.wavelength);
      gl.uniform1i(uniforms.mode, state.mode);
      gl.uniform3fv(uniforms.cool, palettes[state.palette][0]);
      gl.uniform3fv(uniforms.warm, palettes[state.palette][1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}

function createCanvas(canvas) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas unavailable');
  let frame;
  const smoothstep = (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  return {
    canvas,
    kind: 'canvas',
    resize(width, height) {
      const scale = Math.min(1, 430 / width, 320 / height);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      frame = context.createImageData(canvas.width, canvas.height);
    },
    render(state) {
      const [cool, warm] = palettes[state.palette];
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const px = ((x + 0.5) / canvas.width) * state.width;
          const py = ((y + 0.5) / canvas.height) * state.height;
          const sampleX = state.mode === 2 ? (Math.floor(px / 7) + 0.5) * 7 : px;
          const sampleY = state.mode === 2 ? (Math.floor(py / 7) + 0.5) * 7 : py;
          const wave = sample(sampleX, sampleY, state.sources, state.wavelength, state.time);
          const blend = smoothstep(-0.7, 0.7, wave.height);
          let intensity;
          let highlight = 0;
          if (state.mode === 0) {
            const width = Math.max(
              0.04,
              Math.min(0.6, (Math.hypot(wave.dx, wave.dy) * 6.5 * state.width) / canvas.width),
            );
            intensity =
              (1 - smoothstep(0.025, width + 0.035, Math.abs(Math.sin(wave.height * 8)))) * 0.85 +
              (Math.abs(wave.height) * 0.58) ** 2 * 0.13;
          } else if (state.mode === 1) {
            const nx = -wave.dx * 24;
            const ny = -wave.dy * 24;
            const light = Math.max(0, (-0.6 * nx - 0.8 * ny + 0.7) / Math.hypot(nx, ny, 1) / Math.sqrt(1.49));
            intensity = 0.055 + light * 0.35;
            highlight = light ** 9 * 0.35;
          } else {
            const radius = 0.5 + Math.min(1, Math.abs(wave.height)) * 2.1;
            intensity =
              (1 - smoothstep(radius - 0.45, radius + 0.45, Math.hypot(px - sampleX, py - sampleY))) *
              (0.2 + Math.min(1, Math.abs(wave.height)) * 0.7);
          }
          const fade = 0.2 + 0.8 * smoothstep(0, 65, Math.min(px, py, state.width - px, state.height - py));
          const offset = (y * canvas.width + x) * 4;
          for (let channel = 0; channel < 3; channel++) {
            const ink = cool[channel] * (1 - blend) + warm[channel] * blend;
            frame.data[offset + channel] =
              [11, 14, 16][channel] + (ink * intensity + highlight * [0.7, 0.8, 0.74][channel]) * fade * 255;
          }
          frame.data[offset + 3] = 255;
        }
      }
      context.putImageData(frame, 0, 0);
    },
  };
}

export function createRenderer(canvas, forceCanvas = false) {
  if (!forceCanvas) {
    try {
      return createWebGL(canvas);
    } catch {
      /* A canvas with a WebGL context must be replaced before requesting 2D. */
    }
  }
  const replacement = canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  return createCanvas(replacement);
}
