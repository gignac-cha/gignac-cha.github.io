const randomReal = (start?: number, end?: number) => {
  const random = Math.random();
  if (typeof start === 'undefined' && typeof end === 'undefined') {
    return random;
  }
  if (typeof start === 'number' && typeof end === 'undefined') {
    end = start;
    return random * end;
  }
  if (typeof start === 'number' && typeof end === 'number') {
    return start + random * (end - start);
  }
  throw Error('Unexpected error.');
};
export const random = Object.assign(
  new (class {
    random(): number;
    random(end: number): number;
    random(start: number, end: number): number;
    random(start?: number, end?: number) {
      if (typeof start === 'undefined' && typeof end === 'undefined') {
        return randomReal();
      }
      return Math.floor(randomReal(start, end));
    }
  })().random,
  {
    real: new (class {
      real(): number;
      real(end: number): number;
      real(start: number, end: number): number;
      real(start?: number, end?: number) {
        return randomReal(start, end);
      }
    })().real,
  },
);

export const choice = <T>(array: T[]): T => array[random(array.length)];
export const shuffle = <T>(array: T[]): T[] => array.sort(() => random(2) * 2 - 1);
export const toShuffled = <T>(array: T[]): T[] => shuffle([...array]);
