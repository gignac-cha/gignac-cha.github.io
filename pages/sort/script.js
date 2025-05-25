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

  const refreshState = state => {
    state.data = state.data ?? data;
    state.elements = state.elements ?? Array.from(elements.items.querySelectorAll('.item'));
    state.comparison = state.comparison ?? 0;
    state.swapOperation = state.swapOperation ?? 0;
  };
  const swapData = (data, i, j) => {
    [data[i], data[j]] = [data[j], data[i]];
  };
  const swapElements = (elements, i, j) => {
    [elements[i], elements[j]] = [elements[j], elements[i]];
    elements[i].style.left = `${12 * i}px`;
    elements[j].style.left = `${12 * j}px`;
  };
  const resetElements = elements => {
    for (const item of elements) {
      item.classList.remove('selected');
      item.querySelector('.bar').classList.remove('selected-1', 'selected-2', 'selected-3');
    }
  };
  const selectElements = (elements, i, j) => {
    elements[i].querySelector('.bar').classList.add('selected-1');
    elements[j].querySelector('.bar').classList.add('selected-2');
  };
  const setSorted = (elements, i) => {
    elements[i].classList.add('sorted');
    elements[i].querySelector('.bar').classList.add('sorted');
  };

  setTimeout(function update(state = {}) {
    if (global.algorithm !== state.algorithm) {
      state = {};
    }
    if (global.sorting) {
      state.algorithm = global.algorithm;
      switch (global.algorithm) {
        case 'bubble': {
          refreshState(state);
          state.i = state.i ?? 0;
          if (state.i < state.data.length) {
            state.j = state.j ?? 0;
            resetElements(state.elements);
            selectElements(state.elements, state.j, state.j + 1);
            state.comparison++;
            if (state.data[state.j] > state.data[state.j + 1]) {
              state.swapOperation++;
              swapData(state.data, state.j, state.j + 1);
              swapElements(state.elements, state.j, state.j + 1);
            }
            if (state.j < state.data.length - 1 - state.i - 1) {
              state.j++;
            } else {
              setSorted(state.elements, state.j + 1);
              state.j = 0;
              state.i++;
            }
            elements.debug.textContent = `Item count: ${state.data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            resetElements(state.elements);
            setSorted(state.elements, 0);
            global.algorithm = null;
            global.sorting = false;
            elements.debug.textContent = `All items sorted!\nItem count: ${state.data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          }
          break;
        }
        case 'selection': {
          refreshState(state);
          state.i = state.i ?? 0;
          if (state.i < data.length) {
            state.minimum = state.minimum ?? state.i;
            elements.items.querySelector('.line').style.bottom = `${data[state.minimum]}%`;
            state.j = state.j ?? state.i + 1;
            if (state.j < data.length) {
              resetElements(state.elements);
              selectElements(state.elements, state.i, state.j);
              state.elements[state.minimum].classList.add('selected');
              state.elements[state.minimum].querySelector('.bar').classList.add('selected-3');
              state.comparison++;
              if (data[state.j] < data[state.minimum]) {
                state.minimum = state.j;
              }
              state.j++;
            } else {
              if (state.i < state.minimum) {
                state.swapOperation++;
                swapData(state.data, state.i, state.minimum);
                swapElements(state.elements, state.i, state.minimum);
              }
              setSorted(state.elements, state.i);
              state.i++;
              state.j = state.i;
              state.minimum = state.i;
            }
            elements.debug.textContent = `Item count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            resetElements(state.elements);
            setSorted(state.elements, 0);
            elements.items.querySelector('.line').remove();
            global.algorithm = null;
            global.sorting = false;
            elements.debug.textContent = `All items sorted!\nItem count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          }
          break;
        }
        case 'insertion': {
          refreshState(state);
          state.i = state.i ?? 0;
          if (state.i < data.length) {
            state.j = state.j ?? state.i;
            resetElements(state.elements);
            if (state.j > 0) {
              state.comparison++;
              if (data[state.j] < data[state.j - 1]) {
                selectElements(state.elements, state.j, state.j - 1);
                state.swapOperation++;
                swapData(state.data, state.j, state.j - 1);
                swapElements(state.elements, state.j, state.j - 1);
                state.j--;
              } else {
                setSorted(state.elements, state.j);
                state.i++;
                state.j = state.i;
              }
            } else {
              setSorted(state.elements, state.j);
              state.i++;
              state.j = state.i;
            }
            elements.debug.textContent = `Item count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          } else {
            resetElements(state.elements);
            setSorted(state.elements, 0);
            global.algorithm = null;
            global.sorting = false;
            elements.debug.textContent = `All items sorted!\nItem count: ${data.length}\nComparison count: ${state.comparison}\nSwap operation count: ${state.swapOperation}`;
          }
          break;
        }
      }
    }
    setTimeout(update, 1000 / global.speed, state);
  });
});
