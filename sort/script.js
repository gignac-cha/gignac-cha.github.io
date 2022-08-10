window.addEventListener('load', e => {
  const elements = {
    bubble: document.querySelector('#bubble'),
    generate: document.querySelector('#generate'),
    reset: document.querySelector('#reset'),
    toggle: document.querySelector('#toggle'),
    speed: document.querySelector('#speed'),
    items: document.querySelector('#items'),
    debug: document.querySelector('#debug'),
  };

  const global = {
    algorithm: null,
    sorting: false,
    speed: 1,
  };

  elements.speed.value = global.speed;

  const getRandomReal = n => Math.random() * n;
  const getRandom = n => Math.floor(getRandomReal(n));
  const shuffle = array => array.sort(() => getRandom(2) * 2 - 1);

  const data = [];

  const resetButtons = () => {
    elements.bubble.classList.add('btn-dark');
    elements.bubble.classList.remove('disabled');
    global.algorithm = null;
  };
  const reset = () => {
    global.sorting = false;
    elements.toggle.classList.add('pause');
    toggle(false);
    data.length = 0;
    elements.items.innerHTML = '';
    elements.debug.innerHTML = '';
  };
  const toggle = on => {
    if (on) {
      elements.toggle.classList.add('btn-warning');
      elements.toggle.classList.remove('btn-success');
      elements.toggle.classList.add('pause');
      elements.toggle.textContent = 'Pause';

      global.sorting = true;
    } else {
      elements.toggle.classList.add('btn-success');
      elements.toggle.classList.remove('btn-warning');
      elements.toggle.classList.remove('pause');
      elements.toggle.textContent = 'Start';

      global.sorting = false;
    }
  };

  elements.bubble.addEventListener('click', e => {
    resetButtons();
    elements.bubble.classList.remove('btn-dark');
    elements.bubble.classList.add('disabled');
    global.algorithm = 'bubble';
  });
  elements.generate.addEventListener('click', e => {
    reset();
    data.push(...new Array(100).fill().map((_, i) => i + 1));
    shuffle(data);
    for (let i = 0; i < data.length; ++i) {
      const item = document.createElement('div');
      item.classList.add('item');
      item.style.left = `${(10 + 2) * i}px`;
      elements.items.appendChild(item);

      const bar = document.createElement('div');
      bar.classList.add('bar');
      bar.style.height = `${data[i]}%`;
      item.appendChild(bar);
    }
    elements.debug.textContent = `Item count: ${data.length}`;
  });
  elements.reset.addEventListener('click', e => {
    resetButtons();
    reset();
  });
  elements.toggle.addEventListener('click', e => {
    if (!global.algorithm) {
      elements.debug.textContent = 'Please select the sorting algorithm.';
      return;
    }
    toggle(!elements.toggle.classList.contains('pause'));
  });
  elements.speed.addEventListener('change', e => {
    global.speed = parseInt(elements.speed.value);
  });

  setTimeout(update = (state = {}) => {
    if (global.sorting) {
      switch (global.algorithm) {
        case 'bubble': {
          state.elements = state.elements ?? Array.from(elements.items.querySelectorAll('.item'));
          state.comparison = state.comparison ?? 0;
          state.swapOperation = state.swapOperation ?? 0;
          state.i = state.i ?? 0;
          if (state.i < data.length) {
            state.j = state.j ?? 0;
            for (const item of state.elements) {
              item.querySelector('.bar').classList.remove('selected-1', 'selected-2');
            }
            state.elements[state.j].querySelector('.bar').classList.add('selected-1');
            state.elements[state.j + 1].querySelector('.bar').classList.add('selected-2');
            state.comparison++;
            if (data[state.j] > data[state.j + 1]) {
              state.swapOperation++;
              [data[state.j], data[state.j + 1]] = [data[state.j + 1], data[state.j]];
              [state.elements[state.j], state.elements[state.j + 1]] = [state.elements[state.j + 1], state.elements[state.j]];
              state.elements[state.j].style.left = `${(10 + 2) * state.j}px`;
              state.elements[state.j + 1].style.left = `${(10 + 2) * (state.j + 1)}px`;
            }
            if (state.j < data.length - 1 - state.i - 1) {
              state.j++;
            } else {
              const item = state.elements[state.j + 1];
              item.classList.add('sorted');
              item.querySelector('.bar').classList.add('sorted');
              state.j = 0;
              state.i++;
            }
            elements.debug.textContent = `Item count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            const item = state.elements[0];
            item.classList.add('sorted');
            item.querySelector('.bar').classList.add('sorted');
            global.algorithm = null;
            global.sorting = false;
            elements.debug.textContent = `All items sorted!\nItem count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          }
          break;
        }
      }
    }
    setTimeout(update, 1000 / global.speed, global.algorithm ? state : {});
  });
});
