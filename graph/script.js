import { Flex } from './radix-ui/Flex.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  document.body.appendChild(Theme(Flex.Row({ p: 4 })('hi')));
});
