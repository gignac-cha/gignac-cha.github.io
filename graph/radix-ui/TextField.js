import { input, section } from '../element.js';

export const TextField = {
  /**
   *
   * @param {Partial<{
   * size: Radix.Number.PositiveThree
   * variant: 'classic' | 'surface' | 'soft'
   * color: Radix.Color
   * radius: 'none' | 'small' | 'medium' | 'large' | 'full'
   * } & Omit<HTMLInputElement, 'classList'>>} options
   * @returns
   */
  Root: ({ size, variant, color, radius, ...restOptions }) => {
    /**
     *
     * @param {(string | HTMLElement)[]} children
     */
    return (...children) =>
      section({
        classList: ['rt-TextFieldRoot', size && `rt-r-size-${size}`, variant && `rt-variant-${variant}`],
        dataset: { accentColor: color, radius },
      })(
        input({
          classList: ['rt-reset', 'rt-TextFieldInput'],
          ...restOptions,
        })(...children),
      );
  },
  Slot: () => {},
};
