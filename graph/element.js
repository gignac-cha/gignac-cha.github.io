import { entries } from './utilities.js';

/**
 *
 * @template {keyof HTMLElementTagNameMap} N
 * @param {N} tagName
 */
export const createElement = (tagName) => {
  /**
   *
   * @template {HTMLElementTagNameMap[N]} E
   * @param {Partial<Omit<{ [K in Extract<keyof E, string>]: E[K] }, 'style' | 'classList'> & { style: Partial<CSSStyleDeclaration>; classList: (string | 0 | false | undefined)[] }> | undefined} attributes
   */
  return (attributes = {}) => {
    const element = document.createElement(tagName);
    for (const [key, value] of entries(attributes)) {
      if (key === 'style') {
        if (typeof value === 'object' && value !== null) {
          for (const key in value) {
            if (key.startsWith('--')) {
              // @ts-ignore
              element.style.setProperty(key, value[key]);
            } else {
              // @ts-ignore
              element.style[key] = value[key];
            }
          }
          // Object.assign(element.style, value);
        }
      } else if (key === 'classList') {
        if (Array.isArray(value)) {
          element.classList.add(...value.filter((item) => typeof item === 'string'));
        }
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), (event) => value(event));
      } else if (key === 'dataset' && typeof value === 'object' && value !== null) {
        Object.assign(
          element.dataset,
          Object.fromEntries(Object.entries(value).filter(([key, value]) => typeof value !== 'undefined')),
        );
      } else {
        element.setAttribute(key, `${value}`);
      }
    }
    /**
     *
     * @param {(string | HTMLElement | DocumentFragment)[]} children
     */
    return (...children) => {
      for (const child of children) {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else {
          element.appendChild(child);
        }
      }
      return element;
    };
  };
};

export const a = createElement('a');
export const abbr = createElement('abbr');
export const address = createElement('address');
export const area = createElement('area');
export const article = createElement('article');
export const aside = createElement('aside');
export const audio = createElement('audio');
export const b = createElement('b');
export const base = createElement('base');
export const bdi = createElement('bdi');
export const bdo = createElement('bdo');
export const blockquote = createElement('blockquote');
export const body = createElement('body');
export const br = createElement('br');
export const button = createElement('button');
export const canvas = createElement('canvas');
export const caption = createElement('caption');
export const cite = createElement('cite');
export const code = createElement('code');
export const col = createElement('col');
export const colgroup = createElement('colgroup');
export const data = createElement('data');
export const datalist = createElement('datalist');
export const dd = createElement('dd');
export const del = createElement('del');
export const details = createElement('details');
export const dfn = createElement('dfn');
export const dialog = createElement('dialog');
export const div = createElement('div');
export const dl = createElement('dl');
export const dt = createElement('dt');
export const em = createElement('em');
export const embed = createElement('embed');
export const fieldset = createElement('fieldset');
export const figcaption = createElement('figcaption');
export const figure = createElement('figure');
export const footer = createElement('footer');
export const form = createElement('form');
export const h1 = createElement('h1');
export const h2 = createElement('h2');
export const h3 = createElement('h3');
export const h4 = createElement('h4');
export const h5 = createElement('h5');
export const h6 = createElement('h6');
export const head = createElement('head');
export const header = createElement('header');
export const hgroup = createElement('hgroup');
export const hr = createElement('hr');
export const html = createElement('html');
export const i = createElement('i');
export const iframe = createElement('iframe');
export const img = createElement('img');
export const input = createElement('input');
export const ins = createElement('ins');
export const kbd = createElement('kbd');
export const label = createElement('label');
export const legend = createElement('legend');
export const li = createElement('li');
export const link = createElement('link');
export const main = createElement('main');
export const map = createElement('map');
export const mark = createElement('mark');
export const menu = createElement('menu');
export const meta = createElement('meta');
export const meter = createElement('meter');
export const nav = createElement('nav');
export const noscript = createElement('noscript');
export const object = createElement('object');
export const ol = createElement('ol');
export const optgroup = createElement('optgroup');
export const option = createElement('option');
export const output = createElement('output');
export const p = createElement('p');
export const picture = createElement('picture');
export const pre = createElement('pre');
export const progress = createElement('progress');
export const q = createElement('q');
export const rp = createElement('rp');
export const rt = createElement('rt');
export const ruby = createElement('ruby');
export const s = createElement('s');
export const samp = createElement('samp');
export const script = createElement('script');
export const search = createElement('search');
export const section = createElement('section');
export const select = createElement('select');
export const slot = createElement('slot');
export const small = createElement('small');
export const source = createElement('source');
export const span = createElement('span');
export const strong = createElement('strong');
export const style = createElement('style');
export const sub = createElement('sub');
export const summary = createElement('summary');
export const sup = createElement('sup');
export const table = createElement('table');
export const tbody = createElement('tbody');
export const td = createElement('td');
export const template = createElement('template');
export const textarea = createElement('textarea');
export const tfoot = createElement('tfoot');
export const th = createElement('th');
export const thead = createElement('thead');
export const time = createElement('time');
export const title = createElement('title');
export const tr = createElement('tr');
export const track = createElement('track');
export const u = createElement('u');
export const ul = createElement('ul');
export const var_ = createElement('var');
export const video = createElement('video');
export const wbr = createElement('wbr');

/**
 *
 * @param {(string | HTMLElement)[]} children
 */
export const fragment = (...children) => {
  const fragment = document.createDocumentFragment();
  for (const child of children) {
    if (typeof child === 'string') {
      fragment.appendChild(document.createTextNode(child));
    } else {
      fragment.appendChild(child);
    }
  }
  return fragment;
};
