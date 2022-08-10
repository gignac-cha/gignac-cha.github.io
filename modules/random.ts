export const randomReal = (x?: number, y?: number): number => {
  const r: number = Math.random();
  if (typeof x !== 'undefined' && typeof y !== 'undefined') {
    return x + r * (y - x);
  } else if (typeof x !== 'undefined' && typeof y === 'undefined') {
    return r * x;
  }
  return r;
};
export const random = (x?: number, y?: number): number => {
  if (typeof x === undefined && typeof y === undefined) {
    return randomReal();
  }
  return Math.floor(randomReal(x, y));
};
export const choice = <T>(array: T[]): T => array[random(array.length)];
export const shuffle = <T>(array: T[]): T[] => array.sort(() => random(2) * 2 - 1);
