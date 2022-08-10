export const randomReal = (x, y) => {
  const r = Math.random();
  if (typeof x !== "undefined" && typeof y !== "undefined") {
    return x + r * (y - x);
  } else if (typeof x !== "undefined" && typeof y === "undefined") {
    return r * x;
  }
  return r;
};
export const random = (x, y) => {
  if (typeof x === void 0 && typeof y === void 0) {
    return randomReal();
  }
  return Math.floor(randomReal(x, y));
};
export const choice = (array) => array[random(array.length)];
export const shuffle = (array) => array.sort(() => random(2) * 2 - 1);
