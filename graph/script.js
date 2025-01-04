import { main } from './element.js';
import { Theme } from './radix-ui/Theme.js';

window.addEventListener('load', () => {
  document.body.appendChild(Theme());
});
