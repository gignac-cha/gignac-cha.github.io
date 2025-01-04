import { fragment, main } from '../element.js';

/**
 *
 * @param  {(string | HTMLElement)[]} children
 * @returns
 */
export const Theme = (...children) => {
  const element = main({ classList: ['rt-Flex', 'rt-r-direction-column'] })(...children);

  /**
   *
   * @param {'light' | 'dark'} colorScheme
   */
  const changeColorScheme = (colorScheme) => {
    const html = document.querySelector('html');
    if (html) {
      html.classList.remove('light-theme');
      html.classList.remove('dark-theme');
      html.classList.add(`${colorScheme}-theme`);
    }

    const parentElement = element.parentElement;
    if (parentElement) {
      parentElement.dataset['isRootTheme'] = 'true';
      parentElement.dataset['accentColor'] = 'indigo';
      parentElement.dataset['grayGolor'] = 'slate';
      parentElement.dataset['hasBackground'] = 'true';
      parentElement.dataset['panelBackground'] = 'translucent';
      parentElement.dataset['radius'] = 'medium';
      parentElement.dataset['scaling'] = '100%';
      parentElement.classList.add('radix-themes');
    }
  };

  const mediaListQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaListQuery.addEventListener('change', (event) => {
    changeColorScheme(event.matches ? 'dark' : 'light');
  });

  requestAnimationFrame(() => changeColorScheme(mediaListQuery.matches ? 'dark' : 'light'));

  return element;
};
