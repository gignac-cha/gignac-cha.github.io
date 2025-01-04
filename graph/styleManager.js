import { div, style } from './element.js';
import { keys } from './utilities.js';

/** @type {Map<string, string>} */
const keyValueMap = new Map();
/** @type {Map<string, string>} */
const valueKeyMap = new Map();

/**
 *
 * @param {CSSStyleDeclaration} styles
 */
export const css = (styles) => {
  if (keys(styles).length === 0) {
    return;
  }
  const value = div({ style: styles })().style.cssText;
  if (valueKeyMap.has(value)) {
    return valueKeyMap.get(value);
  }
  const key = `style-${`${keyValueMap.size}`.padStart(8, '0')}`;
  keyValueMap.set(key, value);
  valueKeyMap.set(value, key);
  document.head.appendChild(style({ id: key })(`.${key}{${value}}`));
  return key;
};
