import { button } from '../element.js';
import { convertToClassNames, extractLayoutOptions } from './layout.js';

/**
 *
 * @param {Partial<{
 * size: Radix.Number.PositiveFour
 * variant: 'classic' | 'solid' | 'soft' | 'surface' | 'outline' | 'ghost'
 * color: Radix.Color
 * radius: 'none' | 'small' | 'medium' | 'large' | 'full'
 * } & Omit<HTMLButtonElement, 'classList'> & Radix.LayoutOptions>} options
 */
export const Button = ({ size, variant, color, radius, ...restOptions } = {}) => {
  const options = extractLayoutOptions(restOptions);
  const layoutOptions = options.layoutOptions;
  restOptions = options.restOptions;
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
    ...restOptions,
  });
};
