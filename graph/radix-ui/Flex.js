import { section } from '../element.js';

/**
 *
 * @param {{
 * direction?: Responsive<'row' | 'column' | 'row-reverse' | 'column-reverse'>
 * gap?: Responsive<Union<string, "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9">>
 * gapX?: Responsive<Union<string, "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9">>
 * gapY?: Responsive<Union<string, "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9">>
 * }} parameters
 * @returns
 */
export const Flex = ({ direction, gap, gapX, gapY }) => {
  return section({ classList: ['rt-Flex', direction && `rt-r-direction-${direction}`, gap && `rt-r-gap-${gap}`, gapX && `rt-r-cg-${gapX}`, gapY && `rt-r-gapY-${gapY}`] });
};
