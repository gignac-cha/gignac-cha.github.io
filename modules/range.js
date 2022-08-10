export const range = (n, defaultValue) => {
  if (typeof defaultValue === "function") {
    return new Array(n).fill(null).map((_, i) => defaultValue(i));
  } else if (typeof defaultValue !== "undefined") {
    return new Array(n).fill(defaultValue);
  }
  return new Array(n).fill(null).map((_, i) => i);
};
