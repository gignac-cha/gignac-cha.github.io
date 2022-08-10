import Canvas from '../modules/canvas.js';

window.addEventListener('load', e => {
  const canvas = new Canvas(document.querySelector('#canvas'));

  const elements = {
    debug: document.querySelector('#debug'),
  };

  const size = 10;
  const w = 50;
  const h = 50;
  const width = (1 + w + 1) * size;
  const height = (1 + h + 1) * size;
  canvas.width = width;
  canvas.height = height;

  const getRandomReal = n => Math.random() * n;
  const getRandom = n => Math.floor(getRandomReal(n));

  const STATE_EMPTY = 0;
  const STATE_WALL = 1;
  const STATE_CURRENT = 2;
  const STATE_PATH = 3;
  const STATE_VISITED = 4;
  const STATE_START = 8;
  const STATE_GOAL = 9;

  const createMaze = () => {
    const maze = new Array(w * h).fill(0);
    for (let i = 0; i < 100; ++i) {
      const x = getRandom(w);
      const y = getRandom(h);
      if (getRandom(100) < 50) {
        for (let j = 0, count = 5 + getRandom(5); j < count; ++j) {
          if (x + j < w) {
            maze[y * w + x + j] = STATE_WALL;
          }
        }
      } else {
        for (let j = 0, count = 5 + getRandom(5); j < count; ++j) {
          if (y + j < h) {
            maze[(y + j) * h + x] = STATE_WALL;
          }
        }
      }
    }
    maze[0] = STATE_START;
    maze[maze.length - 1] = STATE_GOAL;
    return maze;
  };

  const maze = createMaze();
  const position = { x: 0, y: 0 };
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 }
  ];
  const visited = [0];

  const count = {
    visited: 0,
    path: 0,
  };

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    canvas.clear();

    canvas.rectangle(0, 0, width, size, 'black').fill();
    canvas.rectangle(width - size, 0, size, height, 'black').fill();
    canvas.rectangle(0, height - size, width, size, 'black').fill();
    canvas.rectangle(0, 0, size, height, 'black').fill();

    for (let i = 0; i < maze.length; ++i) {
      const x = 1 + i % w;
      const y = 1 + Math.floor(i / h);
      switch (maze[i]) {
        case STATE_EMPTY:
          break;
        case STATE_WALL:
          canvas.rectangle(x * size, y * size, size, size, 'black').fill();
          break;
        case STATE_CURRENT:
          canvas.rectangle(x * size, y * size, size, size, 'green').fill();
          break;
        case STATE_PATH:
          canvas.rectangle(x * size, y * size, size, size, 'lightgreen').fill();
          canvas.rectangle(x * size + size / 4, y * size + size / 4, size / 2, size / 2, 'green').fill();
          break;
        case STATE_VISITED:
          canvas.rectangle(x * size, y * size, size, size, 'pink').fill();
          break;
        case STATE_START:
          canvas.rectangle(x * size, y * size, size, size, 'blue').fill();
          break;
        case STATE_GOAL:
          canvas.rectangle(x * size, y * size, size, size, 'red').fill();
          break;
      }
    }

    const key1 = position.y * w + position.x;
    if (maze[key1] === STATE_GOAL) {
      elements.debug.textContent = `Path found! (Visited count: ${count.visited}, Path length: ${count.path})`;
      return;
    }

    for (let i = 0; i < directions.length; ++i) {
      const { dx, dy } = directions[0];
      const x = position.x + dx;
      const y = position.y + dy;
      const key2 = y * w + x;
      if (0 <= x && x < w && 0 <= y && y < h) {
        if (maze[key2] === STATE_EMPTY) {
          position.x = x;
          position.y = y;
          if (maze[key1] !== STATE_START) {
            maze[key1] = STATE_PATH;
            visited.push(key1);
          }
          maze[key2] = STATE_CURRENT;
          count.visited++;
          count.path++;
          break;
        } else if (maze[key2] === STATE_GOAL) {
          position.x = x;
          position.y = y;
          maze[key1] = STATE_PATH;
          elements.debug.textContent = 'Path found!';
          count.visited++;
          count.path++;
          return;
        }
      }
      directions.push(directions.shift());
    }
    const key2 = position.y * w + position.x;
    if (key1 === key2) {
      if (visited.length > 0) {
        const key3 = visited.pop();
        const x = key3 % w;
        const y = Math.floor(key3 / h);
        position.x = x;
        position.y = y;
        maze[key2] = STATE_VISITED;
        maze[key3] = STATE_CURRENT;
        count.visited++;
        count.path--;
      } else {
        elements.debug.textContent = `Path not found! (Visited count: ${count.visited})`;
        return;
      }
    }

    elements.debug.textContent = `Finding path... (Visited count: ${count.visited}, Path length: ${count.path})`;
  });
});
