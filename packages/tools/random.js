const randomReal = (start, end) => {
  const random2 = Math.random();
  if (typeof start === "undefined" && typeof end === "undefined") {
    return random2;
  }
  if (typeof start === "number" && typeof end === "undefined") {
    end = start;
    return random2 * end;
  }
  if (typeof start === "number" && typeof end === "number") {
    return start + random2 * end;
  }
  throw Error("Unexpected error.");
};
export const random = Object.assign(
  new class {
    random(start, end) {
      if (typeof start === "undefined" && typeof end === "undefined") {
        return randomReal();
      }
      return Math.floor(randomReal(start, end));
    }
  }().random,
  {
    real: new class {
      real(start, end) {
        return randomReal(start, end);
      }
    }().real
  }
);
export const choice = (array) => array[random(array.length)];
export const shuffle = (array) => array.sort(() => random(2) * 2 - 1);
export const toShuffled = (array) => shuffle([...array]);
