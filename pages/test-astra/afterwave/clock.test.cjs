const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FixedClock } = require('./clock.js');

test('simulation time is independent of display refresh rate', () => {
  for (const refreshRate of [30, 60, 90, 120, 144]) {
    const clock = new FixedClock();
    let steps = 0;
    for (let frame = 0; frame < refreshRate; frame++) clock.advance(1 / refreshRate, () => steps++);
    assert.equal(steps, 120);
  }
});

test('a long interruption cannot trigger an unbounded catch-up', () => {
  const clock = new FixedClock();
  let steps = 0;
  clock.advance(60, () => steps++);
  assert.equal(steps, 12);
  clock.advance(0, () => steps++);
  assert.equal(steps, 12);
});

test('reset discards pending fractional time', () => {
  const clock = new FixedClock();
  let steps = 0;
  clock.advance(1 / 240, () => steps++);
  clock.reset();
  clock.advance(1 / 240, () => steps++);
  assert.equal(steps, 0);
  clock.advance(1 / 240, () => steps++);
  assert.equal(steps, 1);
});
