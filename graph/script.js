import Canvas from '../modules/canvas.js';
import { canvas, fragment, sup } from './element.js';
import { Button } from './radix-ui/Button.js';
import { Code } from './radix-ui/Code.js';
import { Flex } from './radix-ui/Flex.js';
import { TextField } from './radix-ui/TextField.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  /** @type {number[]} */
  const equation = [0];
  const onClicks = {
    /**
     *
     * @param {MouseEvent} event
     * @returns
     */
    addCoefficient: (event) => {
      equationPanel.insertBefore(createCoefficientPanel(equation.length), equationPanel.firstElementChild);
      equation.push(0);
      if (event.currentTarget instanceof HTMLButtonElement) {
        event.currentTarget.setAttribute('disabled', '');
        event.currentTarget.classList.remove('rt-variant-soft');
        event.currentTarget.classList.add('rt-variant-outline');
      }
    },
  };
  /**
   *
   * @param {number} index
   * @returns
   */
  const createCoefficientPanel = (index) =>
    fragment(
      Button({ size: 4, variant: 'soft', p: 4, onclick: onClicks.addCoefficient })('➕'),
      Flex.Column({ maxWidth: '4rem' })(
        TextField.Root({
          id: `coefficient-${index}`,
          type: 'number',
          value: '0',
          size: 3,
          variant: 'surface',
          onchange: (event) => {
            if (event.currentTarget instanceof HTMLInputElement) {
              console.log(event.currentTarget.value);
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
        canvasElement,
      ),
    ),
  );

  requestAnimationFrame(() => {
    const canvas = new Canvas(canvasElement);
    canvas.width = canvasElement.clientWidth;
    canvas.height = canvasElement.clientHeight;
    let previousTime = 0;
    /**
     *
     * @param {number} x
     */
    const f = (x) => 200 + Math.sin(x / 100) * 100;
    /** @type {{ x: number, y: number }[]} */
    const previewPoints = [];
    for (let x = 0; x < canvas.width; ++x) {
      previewPoints.push({ x, y: f(x) });
    }
    /** @type {{ x: number, y: number }[]} */
    const points = [];
    /** @type {FrameRequestCallback} */
    const update = (time) => {
      requestAnimationFrame(update);
      canvas.clear();
      const x = time / 10;
      const y = f(x);
      points.push({ x, y });
      for (const [index, { x, y }] of previewPoints.entries()) {
        if (index > 0) {
          const start = previewPoints.at(index - 1);
          if (start) {
            canvas.line(start, { x, y }, 'gray').stroke();
          }
        }
      }
      for (const [index, { x, y }] of points.entries()) {
        if (index > 0) {
          const start = points.at(index - 1);
          if (start) {
            canvas.line(start, { x, y }, '#0f0').stroke();
          }
        }
      }
      canvas.circle(x, y, 5, 'red').stroke();
      previousTime = time;
    };
    requestAnimationFrame(update);
  });
});

('➖➗');
