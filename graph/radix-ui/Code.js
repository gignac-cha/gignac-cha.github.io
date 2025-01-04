import { code, pre } from '../element.js';

/**
 *
 * @template {'code' | 'pre'} T
 * @default T 'code'
 * @param {Partial<{
 * size: Radix.Number.Positive
 * variant: 'solid' | 'soft' | 'outline' | 'ghost'
 * weight: Responsive<'light' | 'regular' | 'medium' | 'bold'>
 * color: Radix.Color
 * wrap: Responsive<'wrap' | 'nowrap' | 'pretty' | 'balance'>
 * } & { as?: T }>} options
 */
export const Code = ({ size, variant, weight, color, wrap, as = 'code' }) => {
  return (as === 'code' ? code : pre)({
    classList: [
      'rt-reset',
      'rt-Code',
      size && `rt-r-size-${size}`,
      variant && `rt-variant-${variant}`,
      weight && `rt-r-weight-${weight}`,
      wrap && `rt-r-tw-${wrap}`,
    ],
    dataset: { accentColor: color },
  });
};
