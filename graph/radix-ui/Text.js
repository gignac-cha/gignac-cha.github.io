import { div, label, p, span } from '../element.js';

/**
 *
 * @template {'span' | 'div' | 'label' | 'p'} N
 * @param {Partial<{
 * as: N
 * size: Radix.Number.Positive
 * weight: Responsive<'light' | 'regular' | 'medium' | 'bold'>
 * align: Responsive<'left' | 'center' | 'right'>
 * wrap: Responsive<'wrap' | 'nowrap' | 'pretty' | 'balance'>
 * color: Radix.Color
 * } & Omit<HTMLInputElement, 'classList'>>} options
 * @returns {N extends 'span' ? HTMLSpanElement : N extends 'div' ? HTMLDivElement : N extends 'label' ? HTMLLabelElement : N extends 'p' ? HTMLParagraphElement : never}
 */
export const Text = ({ as, size, weight, align, wrap, color }) => {
  const attributes = {
    classList: ['rt-Text', `rt-r-size-${size}`, `rt-r-weight-${weight}`, `rt-r-ta-${align}`, `rt-r-tw-${wrap}`],
    dataset: { accentColor: color },
  };
  switch (as) {
    default:
    case 'span':
      return span(attributes)();
    case 'div':
      return div(attributes)();
    case 'label':
      return label(attributes)();
    case 'p':
      return p(attributes)();
  }
};
