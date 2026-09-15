const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sample, clampPoint } = require('./wave-field.js');

test('a source stays finite at its origin', () => {
  const value = sample(30, 40, [{ x: 30, y: 40, phase: 0 }], 80, 0);
  assert.ok(Object.values(value).every(Number.isFinite));
});

test('opposite phases at the same location cancel', () => {
  const sources = [{ x: 10, y: 20, phase: 0 }, { x: 10, y: 20, phase: Math.PI }];
  for (const time of [0, 0.5, 3, 20]) {
    const value = sample(80, 60, sources, 80, time);
    assert.ok(Math.abs(value.height) < 1e-12);
    assert.ok(Math.abs(value.dx) < 1e-12);
    assert.ok(Math.abs(value.dy) < 1e-12);
  }
});

test('a circular wave has mirror symmetry', () => {
  const sources = [{ x: 0, y: 0, phase: 0 }];
  const left = sample(-36, 24, sources, 90, 1);
  const right = sample(36, 24, sources, 90, 1);
  assert.equal(left.height, right.height);
  assert.equal(left.dx, -right.dx);
  assert.equal(left.dy, right.dy);
});

test('analytic slope agrees with the finite difference of the wave', () => {
  const sources = [{ x: 30, y: 40, phase: 0.3 }, { x: 140, y: 80, phase: 1 }];
  const step = 0.0001;
  const value = sample(70, 60, sources, 80, 1);
  const dx = (sample(70 + step, 60, sources, 80, 1).height - sample(70 - step, 60, sources, 80, 1).height) / (2 * step);
  assert.ok(Math.abs(value.dx - dx) < 1e-8);
});

test('no sources is a quiet field and points remain in bounds', () => {
  assert.deepEqual(sample(10, 20, [], 80, 0), { height: 0, dx: 0, dy: 0 });
  assert.deepEqual(clampPoint(-1, 2), { x: 0.06, y: 0.94 });
});
