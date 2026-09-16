import GL from './lightgl.js';

/*
 * WebGL Water
 * http://madebyevan.com/webgl-water/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

// Afterwave adaptations: rectangular fields, aspect-correct drops and normals,
// adjustable damping, absorbing edges, explicit clear and resize preservation.
// The data in the texture is (position.y, velocity.y, normal.x, normal.z)
export function Water(gl, width, height) {
  this.gl = gl;
  width = width || 256;
  height = height || 256;
  var vertexShader = '\
    varying vec2 coord;\
    void main() {\
      coord = gl_Vertex.xy * 0.5 + 0.5;\
      gl_Position = vec4(gl_Vertex.xyz, 1.0);\
    }\
  ';
  this.plane = GL.Mesh.plane();
  if (!GL.Texture.canUseFloatingPointTextures()) {
    throw new Error('This demo requires the OES_texture_float extension');
  }
  var filter = GL.Texture.canUseFloatingPointLinearFiltering() ? gl.LINEAR : gl.NEAREST;
  this.textureA = new GL.Texture(width, height, { type: gl.FLOAT, filter: filter });
  this.textureB = new GL.Texture(width, height, { type: gl.FLOAT, filter: filter });
  if ((!this.textureA.canDrawTo() || !this.textureB.canDrawTo()) && GL.Texture.canUseHalfFloatingPointTextures()) {
    filter = GL.Texture.canUseHalfFloatingPointLinearFiltering() ? gl.LINEAR : gl.NEAREST;
    gl.deleteTexture(this.textureA.id);
    gl.deleteTexture(this.textureB.id);
    this.textureA = new GL.Texture(width, height, { type: gl.HALF_FLOAT_OES, filter: filter });
    this.textureB = new GL.Texture(width, height, { type: gl.HALF_FLOAT_OES, filter: filter });
  }
  this.filter = filter;
  if (!this.textureA.canDrawTo() || !this.textureB.canDrawTo()) throw new Error('Floating-point rendering unavailable');
  this.dropShader = new GL.Shader(vertexShader, '\
    const float PI = 3.141592653589793;\
    uniform sampler2D texture;\
    uniform vec2 center;\
    uniform vec2 aspect;\
    uniform float radius;\
    uniform float strength;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* add the drop to the height */\
      float drop = max(0.0, 1.0 - length((center * 0.5 + 0.5 - coord) * aspect) / radius);\
      drop = 0.5 - cos(drop * PI) * 0.5;\
      info.r += drop * strength;\
      \
      gl_FragColor = info;\
    }\
  ');
  this.updateShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec2 delta;\
    uniform float damping;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* calculate average neighbor height */\
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      float average = (\
        texture2D(texture, coord - dx).r +\
        texture2D(texture, coord - dy).r +\
        texture2D(texture, coord + dx).r +\
        texture2D(texture, coord + dy).r\
      ) * 0.25;\
      \
      /* change the velocity to move toward the average */\
      info.g += (average - info.r) * 2.0;\
      \
      /* attenuate the velocity a little so waves do not last forever */\
      vec2 edgeCells = min(coord, 1.0 - coord) / delta;\
      float edgeDamping = mix(0.88, 1.0, smoothstep(0.0, 12.0, min(edgeCells.x, edgeCells.y)));\
      info.g *= damping * edgeDamping;\
      \
      /* move the vertex along the velocity */\
      info.r = (info.r + info.g) * edgeDamping;\
      \
      gl_FragColor = info;\
    }\
  ');
  this.normalShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec2 delta;\
    uniform vec2 aspect;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* update the normal */\
      vec3 dx = vec3(2.0 * delta.x * aspect.x, texture2D(texture, coord + vec2(delta.x, 0.0)).r - texture2D(texture, coord - vec2(delta.x, 0.0)).r, 0.0);\
      vec3 dy = vec3(0.0, texture2D(texture, coord + vec2(0.0, delta.y)).r - texture2D(texture, coord - vec2(0.0, delta.y)).r, 2.0 * delta.y * aspect.y);\
      info.ba = normalize(cross(dy, dx)).xz;\
      \
      gl_FragColor = info;\
    }\
  ');
  this.sphereShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec3 oldCenter;\
    uniform vec3 newCenter;\
    uniform float radius;\
    varying vec2 coord;\
    \
    float volumeInSphere(vec3 center) {\
      vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;\
      float t = length(toCenter) / radius;\
      float dy = exp(-pow(t * 1.5, 6.0));\
      float ymin = min(0.0, center.y - dy);\
      float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);\
      return (ymax - ymin) * 0.1;\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* add the old volume */\
      info.r += volumeInSphere(oldCenter);\
      \
      /* subtract the new volume */\
      info.r -= volumeInSphere(newCenter);\
      \
      gl_FragColor = info;\
    }\
  ');
  this.copyShader = new GL.Shader(vertexShader, 'uniform sampler2D texture; varying vec2 coord; void main() { gl_FragColor = texture2D(texture, coord); }');
  this.clear();
}

Water.prototype.addDrop = function(x, y, radius, strength) {
  var this_ = this;
  this.textureB.drawTo(function() {
    this_.textureA.bind();
    this_.dropShader.uniforms({
      center: [x, y],
      aspect: this_.aspect(),
      radius: radius,
      strength: strength
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.moveSphere = function(oldCenter, newCenter, radius) {
  var this_ = this;
  this.textureB.drawTo(function() {
    this_.textureA.bind();
    this_.sphereShader.uniforms({
      oldCenter: oldCenter,
      newCenter: newCenter,
      radius: radius
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.stepSimulation = function(damping) {
  var this_ = this;
  this.textureB.drawTo(function() {
    this_.textureA.bind();
    this_.updateShader.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
      damping: damping === undefined ? 0.995 : damping
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.updateNormals = function() {
  var this_ = this;
  this.textureB.drawTo(function() {
    this_.textureA.bind();
    this_.normalShader.uniforms({
      aspect: this_.aspect(),
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height]
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.aspect = function() {
  var size = Math.min(this.textureA.width, this.textureA.height);
  return [this.textureA.width / size, this.textureA.height / size];
};

Water.prototype.clear = function() {
  const gl = this.gl;
  var previous = gl.getParameter(gl.COLOR_CLEAR_VALUE);
  gl.clearColor(0, 0, 0, 0);
  this.textureA.drawTo(function() { gl.clear(gl.COLOR_BUFFER_BIT); });
  this.textureB.drawTo(function() { gl.clear(gl.COLOR_BUFFER_BIT); });
  gl.clearColor(previous[0], previous[1], previous[2], previous[3]);
};

Water.prototype.resize = function(width, height) {
  const gl = this.gl;
  if (this.textureA.width === width && this.textureA.height === height) return;
  var self = this;
  var previousA = this.textureA;
  var previousB = this.textureB;
  var options = { type: previousA.type, filter: this.filter };
  this.textureA = new GL.Texture(width, height, options);
  this.textureB = new GL.Texture(width, height, options);
  this.textureA.drawTo(function() {
    previousA.bind();
    self.copyShader.uniforms({ texture: 0 }).draw(self.plane);
  });
  gl.deleteTexture(previousA.id);
  gl.deleteTexture(previousB.id);
};
