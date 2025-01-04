import { css } from '../styleManager.js';
import { keyIn, keys } from '../utilities.js';

/** @type {Record<keyof Radix.LayoutOptions, string>} */
const keyMap = {
  p: 'p',
  px: 'px',
  py: 'py',
  pt: 'pt',
  pr: 'pr',
  pb: 'pb',
  pl: 'pl',
  width: 'w',
  minWidth: 'min-w',
  maxWidth: 'max-w',
  height: 'h',
  minHeight: 'min-h',
  maxHeight: 'max-h',
  position: 'position',
  inset: 'inset',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  overflow: 'overflow',
  overflowX: 'ox',
  overflowY: 'oy',
  flexBasis: 'fb',
  flexShrink: 'fs',
  flexGrow: 'fg',
  gridArea: 'ga',
  gridColumn: 'gc',
  gridColumnStart: 'gcs',
  gridColumnEnd: 'gce',
  gridRow: 'gr',
  gridRowStart: 'grs',
  gridRowEnd: 'gre',
};

/**
 *
 * @param {Partial<Radix.LayoutOptions & Record<string, unknown>>} options
 * @returns {{ layoutOptions: Partial<Radix.LayoutOptions>; restOptions: Partial<Record<string, unknown>> }}
 */
export const extractLayoutOptions = (options) => {
  /** @type {Partial<Radix.LayoutOptions>} */
  const layoutOptions = {}
  /** @type {Partial<Record<string, unknown>>} */
  const restOptions = {}
  for (const key of keys(options)) {
    if (keyIn(keyMap, key)) {
      layoutOptions[''] = options[key]
    } else {
      restOptions[key] = options[key]
    }
  }
  return { layoutOptions, restOptions }
}

/**
 *
 * @param {Partial<Radix.LayoutOptions>} options
 */
export const convertToClassNames = (options) => {
  /** @type {(string | undefined)[]} */
  const classNames = [];
  /** @type {Partial<Record<string, Responsive<string>>>} */
  const styles = {};
  for (const key of keys(options)) {
    switch (key) {
      case 'p':
      case 'px':
      case 'py':
      case 'pt':
      case 'pr':
      case 'pb':
      case 'pl': {
        const value = options[key];
        if (typeof value === 'string') {
          classNames.push(`rt-r-${keyMap[key]}`);
          styles[key] = value;
        } else {
          classNames.push(`rt-r-${keyMap[key]}-${value}`);
        }
        break;
      }
      case 'width':
      case 'minWidth':
      case 'maxWidth':
      case 'height':
      case 'minHeight':
      case 'maxHeight': {
        classNames.push(`rt-r-${keyMap[key]}`);
        styles[key] = options[key];
        break;
      }
      case 'position': {
        classNames.push(`rt-r-${keyMap[key]}-${options[key]}`);
        break;
      }
      case 'inset':
      case 'top':
      case 'right':
      case 'bottom':
      case 'left': {
        const value = options[key];
        if (typeof value === 'string') {
          classNames.push(`rt-r-${keyMap[key]}`);
          styles[key] = value;
        } else {
          classNames.push(`rt-r-${keyMap[key]}-${value}`);
        }
        break;
      }
      case 'overflow':
      case 'overflowX':
      case 'overflowY': {
        classNames.push(`rt-r-${keyMap[key]}-${options[key]}`);
        break;
      }
      case 'flexBasis': {
        classNames.push(`rt-r-${keyMap[key]}`);
        styles[key] = options[key];
        break;
      }
      case 'flexShrink':
      case 'flexGrow': {
        classNames.push(`rt-r-${keyMap[key]}-${options[key]}`);
        break;
      }
      case 'gridArea':
      case 'gridColumn':
      case 'gridColumnStart':
      case 'gridColumnEnd':
      case 'gridRow':
      case 'gridRowStart':
      case 'gridRowEnd': {
        classNames.push(`rt-r-${keyMap[key]}`);
        styles[key] = options[key];
        break;
      }
    }
  }
  // @ts-ignore
  classNames.push(css(styles));
  return classNames;
};
