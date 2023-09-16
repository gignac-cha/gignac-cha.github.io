export const range = (n: number, defaultValue?: unknown): number[] => {
  if (typeof defaultValue === 'function') {
    return new Array(n).fill(null).map((_: unknown, i: number) => defaultValue(i));
  } else if (typeof defaultValue !== 'undefined') {
    return new Array(n).fill(defaultValue);
  }
  return Array.from(new Array(n).keys());
};

type Comparator<T> = (a: T, b: T, c: T) => boolean;
const defaultComparator = <T>(a: T, b: T, c: T): boolean => a < b && b < c;
export const isInRange = <T>(start: T, v: T, end: T, comparator: Comparator<T> = defaultComparator): boolean =>
  comparator ? comparator(start, v, end) : defaultComparator(start, v, end);
