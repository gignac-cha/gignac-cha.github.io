import { button } from '../element.js';
import { convertToClassNames } from './layout.js';

/**
 *
 * @param {Partial<{
 * size: Radix.Number.PositiveFour
 * variant: 'classic' | 'solid' | 'soft' | 'surface' | 'outline' | 'ghost'
 * color: Radix.Color
 * radius: 'none' | 'small' | 'medium' | 'large' | 'full'
 * } & HTMLButtonElement & Radix.LayoutOptions>} options
 */
export const Button = ({ size, variant, color, radius, ...layoutOptions } = {}) => {
  return button({
    classList: [
      'rt-reset',
      'rt-BaseButton',
      'rt-Button',
      size && `rt-r-size-${size}`,
      variant && `rt-variant-${variant}`,
      ...convertToClassNames(layoutOptions),
    ],
    dataset: { accentColor: color, radius },
  });
};
