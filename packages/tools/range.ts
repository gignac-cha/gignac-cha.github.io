const magic = <T1, T2>(value: T1 | T2): value is T2 => true;
export const range = new (class {
  range(count: number): number[];
  range<T>(count: number, defaultValueFunction: (index: number) => T): T[];
  range<T>(count: number, defaultValue: T): T[];
  range<T>(count: number, defaultValueOrFunction?: T | ((index: number) => T)): number[] | T[] {
    if (typeof defaultValueOrFunction === 'function' && magic<T, (index: number) => T>(defaultValueOrFunction)) {
      return new Array(count).fill(undefined).map((_: unknown, index: number) => defaultValueOrFunction(index));
    }
    if (typeof defaultValueOrFunction !== 'undefined') {
      return new Array(count).fill(defaultValueOrFunction);
    }
    return Array.from(new Array(count).keys());
  }
})().range;

type Comparator<T> = (a: T, b: T, c: T) => boolean;
const defaultComparator = <T>(a: T, b: T, c: T): boolean => a < b && b < c;
export const isInRange = <T>(start: T, value: T, end: T, comparator: Comparator<T> = defaultComparator): boolean =>
  comparator ? comparator(start, value, end) : defaultComparator(start, value, end);
