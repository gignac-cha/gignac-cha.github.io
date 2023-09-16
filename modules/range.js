export const range = (n, defaultValue) => {
  if (typeof defaultValue === "function") {
    return new Array(n).fill(null).map((_, i) => defaultValue(i));
  } else if (typeof defaultValue !== "undefined") {
    return new Array(n).fill(defaultValue);
  }
  return Array.from(new Array(n).keys());
};
const defaultComparator = (a, b, c) => a < b && b < c;
export const isInRange = (start, v, end, comparator = defaultComparator) => comparator ? comparator(start, v, end) : defaultComparator(start, v, end);
