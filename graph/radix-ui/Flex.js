import { section } from '../element.js';
import { convertToClassNames } from './layout.js';

/**
 * @typedef {{
 * direction: Responsive<'row' | 'column' | 'row-reverse' | 'column-reverse'>
 * gap: Responsive<Union<string, Radix.Number.Zero | Radix.Number.Positive>>
 * gapX: Responsive<Union<string, Radix.Number.Zero | Radix.Number.Positive>>
 * gapY: Responsive<Union<string, Radix.Number.Zero | Radix.Number.Positive>>
 * } & Radix.LayoutOptions} FlexOptions
 */

/**
 *
 * @param {Partial<Omit<FlexOptions, 'direction'> & { reverse?: true }>} options
 */
const Row = (options = {}) => {
  return Flex({ direction: options.reverse ? 'column-reverse' : 'column', ...options });
};

/**
 *
 * @param {Partial<Omit<FlexOptions, 'direction'> & { reverse?: true }>} options
 */
const Column = (options = {}) => {
  return Flex({ direction: options.reverse ? 'row-reverse' : 'row', ...options });
};

export const Flex = Object.assign(
  /**
   *
   * @param {Partial<FlexOptions>} options
   */
  ({ direction, gap, gapX, gapY, ...layoutOptions } = {}) => {
    return section({
      classList: [
        'rt-Flex',
        direction && `rt-r-fd-${direction}`,
        gap && `rt-r-gap-${gap}`,
        gapX && `rt-r-cg-${gapX}`,
        gapY && `rt-r-rg-${gapY}`,
        ...convertToClassNames(layoutOptions),
      ],
    });
  },
  { Row, Column },
);
