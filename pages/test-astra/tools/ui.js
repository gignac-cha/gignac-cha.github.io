const iconPaths = {
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  shuffle:
    '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  download:
    '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

export function createIcon(name) {
  if (!Object.hasOwn(iconPaths, name)) throw new RangeError(`Unknown icon: ${name}`);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('width', '24');
  icon.setAttribute('height', '24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconPaths[name];
  return icon;
}

export function setIcon(button, name) {
  button.replaceChildren(createIcon(name));
}

export function initializeIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((button) => setIcon(button, button.dataset.icon));
}

export function createNotice(element, duration = 2600) {
  let timer;
  function clear() {
    clearTimeout(timer);
    element.classList.remove('visible');
  }
  function show(message, permanent = false) {
    clear();
    element.textContent = message;
    element.classList.add('visible');
    if (!permanent) timer = setTimeout(clear, duration);
  }
  return { show, clear };
}

export async function downloadCanvas(
  canvas,
  { filename, caption, color, minimumFontSize = 14, left = 20, bottom = 20 },
) {
  const image = document.createElement('canvas');
  image.width = canvas.width;
  image.height = canvas.height;
  const context = image.getContext('2d');
  if (!context) throw new Error('Image context unavailable');
  context.drawImage(canvas, 0, 0);
  context.font = `italic ${Math.max(minimumFontSize, Math.round(image.width / 85))}px Georgia`;
  context.fillStyle = color;
  context.fillText(caption, left, image.height - bottom);
  const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image unavailable');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

export function initializeFullscreen(button, notify) {
  button.hidden = !document.fullscreenEnabled;
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('Fullscreen is unavailable');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    const label = active ? 'Exit fullscreen' : 'Fullscreen';
    button.setAttribute('aria-label', label);
    button.dataset.tip = label;
    setIcon(button, active ? 'minimize' : 'maximize');
  });
}
