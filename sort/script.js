import { shuffle } from '../modules/random.js';
import { range } from '../modules/range.js';

window.addEventListener('load', e => {
  const elements = {
    bubble: document.querySelector('#bubble'),
    selection: document.querySelector('#selection'),
    insertion: document.querySelector('#insertion'),
    merge: document.querySelector('#merge'),
    heap: document.querySelector('#heap'),
    quick: document.querySelector('#quick'),
    generate: document.querySelector('#generate'),
    reset: document.querySelector('#reset'),
    toggle: document.querySelector('#toggle'),
    speed: document.querySelector('#speed'),
    items: document.querySelector('#items'),
    debug: document.querySelector('#debug'),
  };
  const algorithmButtons = [
    [elements.bubble, 'bubble'],
    [elements.selection, 'selection'],
    [elements.insertion, 'insertion'],
    [elements.merge, 'merge'],
    [elements.heap, 'heap'],
    [elements.quick, 'quick'],
  ];

  const global = {
    algorithm: null,
    sorting: false,
    speed: 1,
  };

  elements.speed.value = global.speed;

  const data = [];

  const resetButtons = () => {
    for (const [button, algorithm] of algorithmButtons) {
      button.classList.add('btn-dark');
      button.classList.remove('disabled');
    }
    global.algorithm = null;
  };
  const reset = () => {
    global.sorting = false;
    elements.toggle.classList.add('pause');
    toggle(false);
    elements.toggle.setAttribute('disabled', '');
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

  for (const [button, algorithm] of algorithmButtons) {
    button.addEventListener('click', e => {
      resetButtons();
      reset();
      button.classList.remove('btn-dark');
      button.classList.add('disabled');
      global.algorithm = algorithm;
    });
  }
  elements.generate.addEventListener('click', e => {
    reset();
    data.push(...range(100, i => i + 1));
    shuffle(data);
    elements.toggle.removeAttribute('disabled');
    for (let i = 0; i < data.length; ++i) {
      const item = document.createElement('div');
      item.classList.add('item');
      item.style.left = `${12 * i}px`;
      elements.items.appendChild(item);

      const bar = document.createElement('div');
      bar.classList.add('bar');
      bar.style.height = `${data[i]}%`;
      item.appendChild(bar);
    }
    switch (global.algorithm) {
      case 'selection': {
        const line = document.createElement('div');
        line.classList.add('line');
        line.style.bottom = `0%`;
        elements.items.appendChild(line);
        break;
      }
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

  setTimeout(function update(state = {}) {
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
              state.elements[state.j].style.left = `${12 * state.j}px`;
              state.elements[state.j + 1].style.left = `${12 * (state.j + 1)}px`;
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
        case 'selection': {
          state.elements = state.elements ?? Array.from(elements.items.querySelectorAll('.item'));
          state.comparison = state.comparison ?? 0;
          state.swapOperation = state.swapOperation ?? 0;
          state.i = state.i ?? 0;
          if (state.i < data.length) {
            state.minimum = state.minimum ?? state.i;
            elements.items.querySelector('.line').style.bottom = `${data[state.minimum]}%`;
            state.j = state.j ?? state.i + 1;
            if (state.j < data.length) {
              for (const item of state.elements) {
                item.classList.remove('selected');
                item.querySelector('.bar').classList.remove('selected-1', 'selected-2', 'selected-3');
              }
              state.elements[state.i].querySelector('.bar').classList.add('selected-1');
              state.elements[state.minimum].classList.add('selected');
              state.elements[state.minimum].querySelector('.bar').classList.add('selected-3');
              state.elements[state.j].querySelector('.bar').classList.add('selected-2');
              state.comparison++;
              if (data[state.j] < data[state.minimum]) {
                state.minimum = state.j;
              }
              state.j++;
            } else {
              if (state.i < state.minimum) {
                state.swapOperation++;
                [data[state.i], data[state.minimum]] = [data[state.minimum], data[state.i]];
                [state.elements[state.i], state.elements[state.minimum]] = [state.elements[state.minimum], state.elements[state.i]];
                state.elements[state.i].style.left = `${12 * state.i}px`;
                state.elements[state.minimum].style.left = `${12 * state.minimum}px`;
              }
              const item = state.elements[state.i];
              item.classList.add('sorted');
              item.querySelector('.bar').classList.add('sorted');
              state.i++;
              state.j = state.i;
              state.minimum = state.i;
            }
            elements.debug.textContent = `Item count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            for (const item of state.elements) {
              item.classList.remove('selected');
              item.querySelector('.bar').classList.remove('selected-1', 'selected-2', 'selected-3');
            }
            const item = state.elements[0];
            item.classList.add('sorted');
            item.querySelector('.bar').classList.add('sorted');
            elements.items.querySelector('.line').remove();
            global.algorithm = null;
            global.sorting = false;
            elements.debug.textContent = `All items sorted!\nItem count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          }
          break;
        }
        case 'insertion': {
          state.elements = state.elements ?? Array.from(elements.items.querySelectorAll('.item'));
          state.comparison = state.comparison ?? 0;
          state.swapOperation = state.swapOperation ?? 0;
          state.i = state.i ?? 0;
          if (state.i < data.length) {
            state.j = state.j ?? state.i;
            for (const item of state.elements) {
              item.querySelector('.bar').classList.remove('selected-1', 'selected-2');
            }
            if (state.j > 0) {
              state.comparison++;
              if (data[state.j] < data[state.j - 1]) {
                state.elements[state.j].querySelector('.bar').classList.add('selected-1');
                state.elements[state.j - 1].querySelector('.bar').classList.add('selected-2');
                state.swapOperation++;
                [data[state.j], data[state.j - 1]] = [data[state.j - 1], data[state.j]];
                [state.elements[state.j], state.elements[state.j - 1]] = [state.elements[state.j - 1], state.elements[state.j]];
                state.elements[state.j].style.left = `${12 * state.j}px`;
                state.elements[state.j - 1].style.left = `${12 * (state.j - 1)}px`;
                state.j--;
              } else {
                state.elements[state.j].classList.add('sorted');
                state.elements[state.j].querySelector('.bar').classList.add('sorted');
                state.i++;
                state.j = state.i;
              }
            } else {
              state.elements[state.j].classList.add('sorted');
              state.elements[state.j].querySelector('.bar').classList.add('sorted');
              state.i++;
              state.j = state.i;
            }
            elements.debug.textContent = `Item count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            for (const item of state.elements) {
              item.classList.remove('selected');
              item.querySelector('.bar').classList.remove('selected-1', 'selected-2');
            }
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
