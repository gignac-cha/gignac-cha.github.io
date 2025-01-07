import { section } from '../element.js';

/**
 *
 * @param {Partial<{
 * size: Radix.Number.PositiveFour
 * }>} options
 * @returns
 */
export const Container = ({ size }) => {
  /**
   *
   * @param {(string | HTMLElement)[]} children
   */
  return (...children) =>
    section({
      classList: ['rt-Container', `rt-r-size-${size}`],
    })(
      section({
        classList: ['rt-ContainerInner'],
      })(...children),
    );
};
