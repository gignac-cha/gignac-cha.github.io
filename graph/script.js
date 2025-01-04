import { fragment } from './element.js';
import { Button } from './radix-ui/Button.js';
import { Code } from './radix-ui/Code.js';
import { Flex } from './radix-ui/Flex.js';
import { TextField } from './radix-ui/TextField.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  /** @type {number[]} */
  const equation = [0];
  const createEquationPane
  const onClicks = {
    plusCoefficient: () => {
      equationsPanel.insertBefore(
        fragment(
          Button({ size: 4, variant: 'soft', p: 4, onclick: onClicks.plusCoefficient })('+'),
          Flex.Column({ maxWidth: '4rem' })(
            TextField.Root({
              id: `coefficient-${equation.length}`,
              type: 'number',
              value: '0',
              size: 3,
              variant: 'surface',
            })(),
          ),
        ),
        equationsPanel.firstElementChild,
      );
    },
  };
  const equationsPanel = Flex.Column({ gap: 4, align: 'center' })(
    Button({ size: 4, variant: 'soft', p: 4, onclick: onClicks.plusCoefficient })('+'),
    Flex.Column({ maxWidth: '4rem' })(
      TextField.Root({ id: 'coefficient-0', type: 'number', value: '0', size: 3, variant: 'surface' })(),
    ),
  );
  document.body.appendChild(
    Theme(
      Flex.Row({ p: 4, gapY: 4 })(
        Flex.Column({ gapX: 4, align: 'center' })(
          Code({ size: 9, variant: 'outline' })('y'),
          Code({ size: 9, variant: 'ghost' })('='),
          equationsPanel,
        ),
      ),
    ),
  );
});
