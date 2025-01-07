import { span } from '../element.js';
import { css } from '../styleManager.js';

/**
 *
 * @param {Partial<{
 * size: Radix.Number.PositiveThree
 * variant: 'classic' | 'surface' | 'soft'
 * color: Radix.Color
 * radius: 'none' | 'small' | 'medium' | 'large' | 'full'
 * } & { value?: number, onChange?: (value: number) => void }>} options
 */
export const Slider = ({ size, variant, color, radius, value = 0, onChange } = {}) => {
  const state = { left: 0, pointerDown: false };
  /** @type {HTMLSpanElement} */
  let sliderRoot;
  /** @type {HTMLSpanElement} */
  let sliderRange;
  /** @type {HTMLSpanElement} */
  let sliderThumbContainer;
  const onValueChange = () => {
    sliderRange.style.left = '0%';
    sliderRange.style.right = `${100 - value}%`;
    sliderThumbContainer.style.left = `calc(${value}% + 4.56px)`;
    onChange?.(value);
  };
  return (sliderRoot = span({
    classList: [
      'rt-SliderRoot',
      size && `rt-r-size-${size}`,
      variant && `rt-variant-${variant}`,
      // @ts-ignore
      css({ '--radix-slider-thumb-transform': 'translateX(-50%)' }),
    ],
    dataset: { accentColor: color, radius, orientation: 'horizontal' },
    onpointermove: (event) => {
      if (state.pointerDown) {
        // TODO: apply mouse offset
        value = Math.max(
          0,
          Math.min(((event.clientX - sliderRoot.getBoundingClientRect().left) / sliderRoot.clientWidth) * 100, 100),
        );
        onValueChange();
      }
    },
  })(
    span({
      classList: ['rt-SliderTrack'],
      dataset: { accentColor: color, radius, orientation: 'horizontal' },
    })(
      (sliderRange = span({
        classList: ['rt-SliderRange'],
        dataset: { accentColor: color, radius, orientation: 'horizontal' },
        style: { left: '0%', right: `${100 - value}%` },
      })()),
    ),
    (sliderThumbContainer = span({
      classList: [
        css({
          position: 'absolute',
          transform: 'var(--radix-slider-thumb-transform)',
        }),
      ],
      style: { left: `calc(${value}% + 4.56px)` },
    })(
      span({
        classList: ['rt-SliderThumb'],
        dataset: { orientation: 'horizontal', radixCollectionItem: '' },
        onpointerdown: () => (state.pointerDown = true),
        onpointerup: () => (state.pointerDown = false),
      })(),
    )),
  ));
};
