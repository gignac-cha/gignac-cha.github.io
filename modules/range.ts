export const range = (n: number, defaultValue?: unknown): number[] => {
  if (typeof defaultValue === 'function') {
    return new Array(n).fill(null).map((_: unknown, i: number) => defaultValue(i));
  } else if (typeof defaultValue !== 'undefined') {
    return new Array(n).fill(defaultValue);
  }
  return new Array(n).fill(null).map((_: unknown, i: number) => i);
};
