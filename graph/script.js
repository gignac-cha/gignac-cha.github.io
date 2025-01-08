import Canvas from '../modules/canvas.js';
import { canvas, fragment, sup } from './element.js';
import { Button } from './radix-ui/Button.js';
import { Code } from './radix-ui/Code.js';
import { Container } from './radix-ui/Container.js';
import { Flex } from './radix-ui/Flex.js';
import { Slider } from './radix-ui/Slider.js';
import { Text } from './radix-ui/Text.js';
import { TextField } from './radix-ui/TextField.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  const state = {
    /**
     *
     * @param {number} x
     */
    f: (x) => Math.sin((x / 360) * 2 * Math.PI) * 100,

    /** @type {{ x: number, y: number }[]} */
    previewPoints: [],
    /** @type {{ x: number, y: number }[]} */
    points: [],

    index: 0,

    signalFrequency: 1,
    windingFrequency: 1,
    /** @type {HTMLSpanElement | undefined} */
    signalFrequencyText: undefined,
    /** @type {HTMLSpanElement | undefined} */
    windingFrequencyText: undefined,
  };

  /** @type {number[]} */
  const equation = [0];
  /**
   *
   * @param {number} index
   * @returns
   */
  const createCoefficientPanel = (index) =>
    fragment(
      Button({
        size: 4,
        variant: 'soft',
        p: 4,
        onclick: (event) => {
          equationPanel.insertBefore(createCoefficientPanel(equation.length), equationPanel.firstElementChild);
          equation.push(0);
          if (event.currentTarget instanceof HTMLButtonElement) {
            event.currentTarget.setAttribute('disabled', '');
            event.currentTarget.classList.remove('rt-variant-soft');
            event.currentTarget.classList.add('rt-variant-outline');
          }
        },
      })('➕'),
      Flex.Column({ maxWidth: '4rem' })(
        TextField.Root({
          id: `coefficient-${index}`,
          type: 'number',
          value: '0',
          size: 3,
          variant: 'surface',
          onchange: (event) => {
            if (event.currentTarget instanceof HTMLInputElement) {
              equation[index] = parseFloat(event.currentTarget.value);
              state.f = (x) => {
                // x = (x - previousTime) / 1000;
                return equation.entries().reduce((y, [index, coefficent]) => y + coefficent * x ** index, 0) / 1000;
              };
              state.previewPoints.length = 0;
              state.previewPoints.push(...makePreview());
              state.points.length = 0;
              state.index = 0;
            }
          },
        })(),
      ),
      Code({ size: 8, variant: 'ghost' })('✖️'),
      Code({ size: 8, variant: 'outline' })('x', sup()(`${index}`)),
    );
  const equationPanel = Flex.Column({ gap: 4, align: 'center' })(createCoefficientPanel(0));
  const canvasElement = canvas({ classList: ['rt-r-fg-1'] })();
  document.body.appendChild(
    Theme(
      Flex.Row({ p: 4, gapY: 4, flexGrow: 1 })(
        Flex.Column({ gapX: 4, align: 'center' })(
          Code({ size: 9, variant: 'outline' })('y'),
          Code({ size: 8, variant: 'ghost' })('🟰'),
          equationPanel,
        ),
        Container({ size: 4 })(
          Flex.Row({ gapY: 4 })(
            Flex.Row({ gapY: 2 })(
              Flex.Column({ gapX: 2 })(
                Text()('Signal Frequency'),
                (state.signalFrequencyText = Text({ align: 'right', style: { flexGrow: '1' } })(
                  `${state.signalFrequency}`,
                )),
              ),
              Slider({
                size: 3,
                variant: 'surface',
                onChange: (value) => {
                  state.signalFrequency = value;
                  if (state.signalFrequencyText) {
                    state.signalFrequencyText.textContent = value.toFixed(2);
                  }
                },
              }),
            ),
            Flex.Row({ gapY: 2 })(
              Flex.Column({ gapX: 2 })(
                Text()('Winding Frequency'),
                (state.windingFrequencyText = Text({ align: 'right', style: { flexGrow: '1' } })(
                  `${state.windingFrequency}`,
                )),
              ),
              Slider({
                size: 3,
                variant: 'surface',
                onChange: (value) => {
                  state.windingFrequency = value;
                  if (state.windingFrequencyText) {
                    state.windingFrequencyText.textContent = value.toFixed(2);
                  }
                },
              }),
            ),
            Button({ size: 4, variant: 'soft', onclick: () => (state.index = 0) })('Reset'),
          ),
        ),
        canvasElement,
      ),
    ),
  );

  /**
   *
   * @param {number} x
   * @returns {number}
   */
  const f = (x) => Math.sin(x);
  /**
   *
   * @param {number} x
   * @returns {number}
   */
  const g = (x) => Math.cos(x);
  /**
   *
   * @param {number} x
   * @returns {number}
   */
  state.f = (x) => {
    // x = (x / 360) * 2 * Math.PI;
    // const y = f(g(x - 1) + 2) * 3 * g(f(x + 4) - 5) * 6;
    // return y * 10;
    return Math.sin(2 * x) + Math.sin(3 * x);
  };

  const makePreview = () => new Array(window.innerWidth).fill(0).map((_, x) => ({ x, y: state.f(x) }));
  state.previewPoints.push(...makePreview());

  let previousTime = 0;
  requestAnimationFrame(() => {
    const canvas = new Canvas(canvasElement);
    /**
     *
     * @param {{ x: number, y: number }} param0
     * @returns {{ x: number, y: number }}
     */
    const convertPoint = ({ x, y }) => ({ x: x, y: window.innerHeight / 2 - y });
    /** @type {FrameRequestCallback} */
    const update = (time) => {
      requestAnimationFrame(update);

      canvas.width = canvasElement.clientWidth;
      canvas.height = canvasElement.clientHeight;

      canvas.clear();

      // const x = state.index;
      // const y = state.f(x);
      // state.points.push({ x, y });
      // for (const [index, end] of state.previewPoints.entries()) {
      //   if (index > 0) {
      //     const start = state.previewPoints.at(index - 1);
      //     if (start) {
      //       canvas.line(convertPoint(start), convertPoint(end), 'gray').stroke();
      //     }
      //   }
      // }
      // for (const [index, end] of state.points.entries()) {
      //   if (index > 0) {
      //     const start = state.points.at(index - 1);
      //     if (start) {
      //       canvas.line(convertPoint(start), convertPoint(end), '#0f0').stroke();
      //     }
      //   }
      // }
      // const convertedPoint = convertPoint({ x, y });
      // canvas.circle(convertedPoint.x, convertedPoint.y, 5, 'red').stroke();
      // previousTime = time;

      /**
       *
       * @param {{ x: number, y: number }} param0
       * @returns {{ x: number, y: number }}
       */
      const convertPoint = ({ x, y }) => ({ x: canvas.width / 2 + x, y: canvas.height / 2 - y });

      // const x = state.index;
      // const r = (x / 360) * 2 * Math.PI;
      // {
      //   const y = Math.sin(r) * 100 + 100;
      //   const p = convertPoint({ x, y });
      //   canvas.dot(p.x, p.y - canvas.height / 4, '#0f0').fill();
      // }
      // {
      //   const l = Math.sin(r * 1.22) * 100 + 100;
      //   const x = Math.cos(r) * l;
      //   const y = Math.sin(r) * l;
      //   const p = convertPoint({ x, y });
      //   canvas.dot(p.x - canvas.width / 4, p.y, '#0f0').fill();
      // }
      // {
      //   const y = Math.cos(2 * r) * 100;
      //   const p = convertPoint({ x, y });
      //   canvas.dot(p.x, p.y, '#0f0').fill();
      // }
      // {
      //   const y = (Math.sin(r) + Math.cos(2 * r)) * 100;
      //   const p = convertPoint({ x, y });
      //   canvas.dot(p.x, p.y + canvas.height / 4, '#0f0').fill();
      // }
      for (let x = -canvas.width; x < canvas.width; ++x) {
        const r = (x / 360) * 2 * Math.PI;
        const y = state.f(state.signalFrequency * r) * 100;
        const p = convertPoint({ x, y });
        canvas.dot(p.x, p.y - canvas.height / 4, '#0f0').fill();
      }

      for (let d = 0; d < 360; ++d) {
        const r = (d / 360) * 2 * Math.PI;
        const l = state.f((state.signalFrequency * r) / state.windingFrequency) + 1;
        const x = Math.cos(r) * l * 100;
        const y = Math.sin(r) * l * 100;
        const p = convertPoint({ x, y });
        canvas.dot(p.x - canvas.width / 4, p.y + canvas.height / 4, '#0f0').fill();
      }

      for (let x = 0; x < canvas.width; ++x) {
        const windingFrequency = x / 100;
        /** @type {number[]} */
        const values = [];
        for (let d = 0; d < 360; ++d) {
          const r = (d / 360) * 2 * Math.PI;
          const l = state.f((state.signalFrequency * r) / windingFrequency) + 1;
          const x = Math.cos(r) * l;
          values.push(x);
        }
        const y = (values.reduce((previousValue, currentValue) => previousValue + currentValue) / values.length) * 200;
        const p = convertPoint({ x, y });
        canvas.dot(p.x, p.y - (canvas.height / 4) * 0, '#f0f').fill();
      }

      state.index++;
    };
    requestAnimationFrame(update);
  });
});

('➖➗');
