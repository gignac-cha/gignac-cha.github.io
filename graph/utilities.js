/**
 *
 * @template {object} T
 * @param {T} object
 * @returns {Extract<keyof T, string>[]}
 */
export const keys = (object) => {
  /** @type {Extract<keyof T, string>[]} */
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
 * @returns {[keyof T, T[keyof T]][]}
 */
export const entries = (object) => keys(object).map((key) => [key, object[key]]);

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
