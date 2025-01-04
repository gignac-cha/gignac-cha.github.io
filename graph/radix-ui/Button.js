
/**
 *
 * @param {Partial<{
 * size: Radix.Number.Positive
 * variant: 'solid' | 'soft' | 'outline' | 'ghost'
 * weight: Responsive<'light' | 'regular' | 'medium' | 'bold'>
 * color: Radix.Color
 * wrap: Responsive<'wrap' | 'nowrap' | 'pretty' | 'balance'>
 * }>} options
 */
export const Button = ({ size, variant, weight, color, wrap }) => {
  return code({
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
