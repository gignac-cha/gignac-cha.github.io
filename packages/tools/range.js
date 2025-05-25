const magic = (value) => true;
export const range = new class {
  range(count, defaultValueOrFunction) {
    if (typeof defaultValueOrFunction === "function" && magic(defaultValueOrFunction)) {
      return new Array(count).fill(void 0).map((_, index) => defaultValueOrFunction(index));
    }
    if (typeof defaultValueOrFunction !== "undefined") {
      return new Array(count).fill(defaultValueOrFunction);
    }
    return Array.from(new Array(count).keys());
  }
}().range;
const defaultComparator = (a, b, c) => a < b && b < c;
export const isInRange = (start, value, end, comparator = defaultComparator) => comparator ? comparator(start, value, end) : defaultComparator(start, value, end);
