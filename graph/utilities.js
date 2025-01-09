/**
 *
 * @template {object} T
 * @param {T} object
 * @returns {(keyof T)[]}
 */
export const keys = (object) => {
  /** @type {(keyof T)[]} */
  const keys = [];
  for (const key in object) {
    keys.push(key);
  }
  return keys;
};

/**
 *
 * @template {object} T
 * @param {T} object
 * @returns {{ [K in keyof T]: [K, T[K]] }[keyof T][]}
 */
export const entries = (object) => keys(object).map((key) => [key, object[key]]);

/**
 *
 * @template {object} T
 * @param {T} object
 * @param {string} key
 * @returns {key is keyof T}
 */
export const keyIn = (object, key) => key in object;

/**
 *
 * @param {string} camelCase
 * @returns
 */
export const camelCaseToKebabCase = (camelCase) =>
  camelCase.replace(/([a-z])([A-Z])/g, (capture) => `${capture.at(0)}-${capture.at(1)}`).toLowerCase();

/**
 *
 * @param {string} kebabCase
 * @returns
 */
export const kebabCaseToCamelCase = (kebabCase) =>
  kebabCase.replace(/([a-z])\-([a-z])/g, (capture) => `${capture.at(0)}${capture.at(1)?.toUpperCase()}`).toLowerCase();

for (const[key, value]of entries({a:1,b:2})) {
  
}