const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ringPose, RING_COUNT } = require('./form.js');

test('every form stays finite and in the camera envelope at control extremes', () => {
  for (const form of [0, 1, 2]) for (const openness of [0, 1]) for (const twist of [-Math.PI, Math.PI]) {
    for (let i = 0; i < RING_COUNT; i++) {
      const pose = ringPose(i, { form, openness, twist, time: 5, pulse: 1, hover: 1 });
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.radius > 0.15 && pose.radius < 2.6);
      assert.ok(Math.abs(pose.y) < 3);
    }
  }
});

test('resting spindle layers have strictly ordered heights', () => {
  let previous = -Infinity;
  for (let i = 0; i < RING_COUNT; i++) {
    const pose = ringPose(i, { form: 0, openness: 0, twist: 0, time: 0, pulse: 0, hover: 0 });
    assert.ok(pose.y > previous);
    previous = pose.y;
  }
});

test('pointer interaction opens a layer without changing its identity', () => {
  const options = { form: 0, openness: 0, twist: 1, time: 0, pulse: 0, hover: 0 };
  const original = ringPose(12, options);
  const touched = ringPose(12, { ...options, hover: 1 });
  assert.ok(touched.radius > original.radius);
  assert.notEqual(touched.rotationX, original.rotationX);
});
