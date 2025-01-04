import { Code } from './radix-ui/Code.js';
import { Flex } from './radix-ui/Flex.js';
import { TextField } from './radix-ui/TextField.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  document.body.appendChild(
    Theme(
      Flex.Row({ p: 4, gapY: 4 })(
        Flex.Column({ gapX: 4, align: 'center' })(
          Code({ size: 9, variant: 'outline' })('y'),
          Code({ size: 9, variant: 'ghost' })('='),
          Flex.Column({ maxWidth: '4rem' })(
            TextField.Root({ id: 'coefficient-0', type: 'number', value: '0', size: 3, variant: 'surface' })(),
          ),
        ),
      ),
    ),
  );
});
