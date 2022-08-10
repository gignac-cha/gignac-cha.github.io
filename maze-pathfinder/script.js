function random(...args) {
  const r = Math.random();
  if (args.length === 1) {
    const [first] = args;
    if (Number.isInteger(first)) {
      return Math.floor(r * first);
    } else if (Array.isArray(first)) {
      const array = first;
      return array[random(array.length)];
    }
  } else if (args.length === 2) {
    const [start, end] = args;
    if (Number.isInteger(start) && Number.isInteger(end)) {
      return Math.floor(start + r * (end - start));
    }
  }
  return r;
}

function range(value, start, end) {
  return start <= value && value < end;
}

function createMaze(width, height) {
  const maze = Array.from(new Array(width)).map(() => Array.from(new Array(height)).map(() => 0));
  for (let i = 0; i < 100; ++i) {
    const x = random(width);
    const y = random(height);
    if (range(x, 0, 10) && range(y, 0, 10)) {
      continue;
    } else if (range(x, width - 10, width) && range(y, height - 10, height)) {
      continue;
    }
    const a = random(2);
    const d = random([-1, 1]);
    const l = random(5, 10);
    try {
      if (a) {
        for (let j = 0; j < l && range(x + d * j, 0, width); ++j) {
          maze[y][x + d * j] = 9;
        }
      } else {
        for (let j = 0; j < l && range(y + d * j, 0, height); ++j) {
          maze[y + d * j][x] = 9;
        }
      }
    } catch (e) {
      console.error({ x, y, a, d, l });
      throw e;
    }
  }
  return maze;
}

const g = {
  fps: 60,
  play: true,
  width: 50,
  height: 50,
  size: 10,
  stack: [],
  path: [],
  queue: [],
  directions: [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ],
  current: { x: 0, y: 0 },
};
g.goal = { x: g.width - 1, y: g.height - 1 };
g.lastDirection = g.directions[0];

window.addEventListener('load', e => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  canvas.width = 1 + g.size * g.width + 1;
  canvas.height = 1 + g.size * g.height + 1;

  const button = document.createElement('button');
  document.body.appendChild(button);
  button.innerText = '||';
  button.addEventListener('click', e => {
    button.innerText = g.play ? '|>' : '||';
    g.play = !g.play;
  });

  const maze = createMaze(g.width, g.height);
  maze[g.goal.y][g.goal.x] = 2;

  setTimeout(update = () => {
    const { width, height } = canvas;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);

    context.beginPath();
    context.strokeStyle = 'white';
    context.moveTo(0, 0);
    context.lineTo(width, 0);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.lineTo(0, 0);
    context.stroke();
    context.closePath();

    for (let y = 0; y < g.height; ++y) {
      for (let x = 0; x < g.width; ++x) {
        if (maze[y][x] === 0) {
          context.fillStyle = 'gray';
        } else if (maze[y][x] === 1) {
          context.fillStyle = 'lightblue';
        } else if (maze[y][x] === 8) {
          context.fillStyle = 'lightpink';
        } else if (maze[y][x] === 9) {
          context.fillStyle = 'black';
        }
        context.fillRect(1 + g.size * x, 1 + g.size * y, g.size, g.size);
      }
    }
    context.fillStyle = 'green';
    g.path.forEach(({ x, y }) =>
      context.fillRect(1 + g.size * x + g.size / 4, 1 + g.size * y + g.size / 4, g.size / 2, g.size / 2)
    );
    context.fillStyle = 'lightgreen';
    context.fillRect(1 + g.size * g.current.x, 1 + g.size * g.current.y, g.size, g.size);
    context.fillStyle = 'red';
    context.fillRect(1 + g.size * g.goal.x, 1 + g.size * g.goal.y, g.size, g.size);

    setTimeout(update, 1000 / g.fps);
  });

  setTimeout(find = () => {
    let goal = false;
    let fail = false;
    if (g.play) {
      if (g.stack.length === 0) {
        const { x, y } = g.current;
        g.directions
          .reverse()
          .filter(({ dx }) => range(x + dx, 0, g.width))
          .filter(({ dy }) => range(y + dy, 0, g.height))
          .filter(({ dx, dy }) => maze[y + dy][x + dx] === 0)
          .forEach(({ dx, dy }) => g.stack.push({ x: x + dx, y: y + dy }));
      } else {
        const { current } = g;
        const { x, y } = current;
        const index = g.directions.indexOf(g.directions.find(({ dx, dy }) => dx === g.lastDirection.dx && dy === g.lastDirection.dy));
        const rotatedDirections = [...g.directions.slice(index), ...g.directions.slice(0, index)];
        const edgeFiltered = rotatedDirections
          .reverse()
          .filter(({ dx }) => range(x + dx, 0, g.width))
          .filter(({ dy }) => range(y + dy, 0, g.height));
        if (edgeFiltered.some(({ dx, dy }) => maze[y + dy][x + dx] === 2)) {
          goal = true;
          g.path.push(current);
          maze[y][x] = 1;
          g.current = g.goal;
        } else {
          const pathFiltered = edgeFiltered.filter(({ dx, dy }) => maze[y + dy][x + dx] === 0);
          pathFiltered.forEach(({ dx, dy }) => g.stack.push({ x: x + dx, y: y + dy }));
          if (pathFiltered.length > 0) {
            g.path.push(current);
            maze[y][x] = 1;
            g.current = g.stack.pop();
            g.lastDirection = { dx: g.current.x - x, dy: g.current.y - y };
          } else {
            maze[y][x] = 8;
            if (g.path.length > 0) {
              g.current = g.path.pop();
            } else {
              fail = true;
            }
          }
        }
      }
    }
    if (goal) {
      console.log('path found');
    } else if (fail) {
      console.error('path not found');
    } else {
      setTimeout(find, 1000 / (g.fps / 1));
    }
  });
});
