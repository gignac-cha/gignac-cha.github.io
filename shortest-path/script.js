import Canvas from '../modules/canvas.js';
import { random } from '../modules/random.js';
import { range } from '../modules/range.js';
import FPS from '../modules/fps.js';

const canvas = new Canvas();

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};
window.addEventListener('load', e => {
  canvas.element = document.querySelector('#canvas');

  const fps = new FPS();
  fps.element.classList.add('fps');
  document.body.appendChild(fps.element);

  resize();

  const { width, height } = canvas;

  const elements = {
    synchronous: document.querySelector('#synchronous'),
    asynchronous: document.querySelector('#asynchronous'),
  };

  const nodeRadius = 5;

  const mouse = {};
  const state = {};

  elements.synchronous.addEventListener('click', e => {
    state.asynchronous = false;
  });
  elements.asynchronous.addEventListener('click', e => {
    state.asynchronous = true;
  });

  canvas.addEventListener('click', e => {
    const x = e.clientX;
    const y = e.clientY;
    const p = { x, y };
    mouse.clicked = p;
    const node = [...nodes]
      .filter(node => getDistance(p, node) < nodeRadius * 2)
      .sort((a, b) => getDistance(p, a) - getDistance(p, b))
      .shift();
    if (node) {
      if (state.selectedNode1) {
        state.selectedNode2 = node;
        findShortestPath(state.selectedNode1, state.selectedNode2);
      } else {
        state.selectedNode1 = node;
      }
    } else {
      state.selectedNode1 = null;
      state.selectedNode2 = null;
    }
  });
  canvas.addEventListener('mousemove', e => {
    const x = e.clientX;
    const y = e.clientY;
    const p = { x, y };
    mouse.move = p;
    state.focusedNode = [...nodes]
      .filter(node => getDistance(p, node) < nodeRadius)
      .sort((a, b) => getDistance(p, a) - getDistance(p, b))
      .shift();
  });

  const getDistance = (p1, p2) => ((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2) ** .5;

  const nodes = [];
  const edges = [];
  const distances = [];
  const paths = [];
  const pathDistances = [];
  const temporaryPaths = [];

  const addNode = () => {
    const node1 = {
      i: nodes.length,
      x: random(canvas.width / 10, canvas.width / 10 * 9),
      y: random(canvas.height / 10, canvas.height / 10 * 9),
    };
    nodes.push(node1);
    range(distances.length).forEach(i => distances[i].push(getDistance(node1, nodes[i])));
    distances.push(nodes.map(node2 => getDistance(node1, node2)));
    range(paths.length).forEach(i => paths[i].push([]));
    paths.push(range(nodes.length, () => []));
    range(pathDistances.length).forEach(i => pathDistances[i].push(Infinity));
    pathDistances.push(range(nodes.length, Infinity));
    range(temporaryPaths.length).forEach(i => temporaryPaths[i].push(Infinity));
    temporaryPaths.push(range(nodes.length, Infinity));
  };
  const resetEdges = () => {
    edges.length = 0;
    range(nodes.length).forEach(() => edges.push([]));
    for (const node1 of nodes) {
      const adjacents = nodes.map(node2 => ({ ...node2, distance: getDistance(node1, node2) }));
      adjacents.sort((a, b) => a.distance - b.distance);
      adjacents.shift();
      adjacents.splice(3);
      edges[node1.i].push(...adjacents);
      for (const adjacent1 of adjacents) {
        if (!edges[adjacent1.i].find(adjacent2 => adjacent2.i === node1.i)) {
          edges[adjacent1.i].push(node1);
        }
      }
    }
  };
  const findShortestPath = (start, goal) => {
    if (paths[start.i][goal.i].length === 0) {
      const shortest = { path: [], distance: Infinity };
      const queue = [{ node: start, path: [start.i], distance: 0 }];
      const visited = range(nodes.length, false);
      const task = (node, path, distance) => {
        if (paths[start.i][node.i].length > 0) {
          if (distance < pathDistances[start.i][node.i]) {
            paths[start.i][node.i] = path;
            pathDistances[start.i][node.i] = distance;
          }
        } else {
          paths[start.i][node.i] = path;
          pathDistances[start.i][node.i] = distance;
        }
        if (distance < shortest.distance) {
          if (node.i === goal.i) {
            shortest.path = path;
            shortest.distance = distance;
          } else {
            visited[node.i] = true;
            for (const adjacent of edges[node.i]) {
              if (!visited[adjacent.i]) {
                queue.push({ node: adjacent, path: [...path, adjacent.i], distance: distance + distances[node.i][adjacent.i] });
              }
            }
          }
        }
      };
      const taskEnded = () => {
        paths[start.i][goal.i] = shortest.path;
      };
      if (state.asynchronous) {
        setTimeout(function update() {
          if (queue.length > 0) {
            const { node, path, distance } = queue.shift();
            task(node, path, distance);
            temporaryPaths[start.i][goal.i] = path;
            setTimeout(update);
          } else {
            taskEnded();
          }
        });
      } else {
        while (queue.length > 0) {
          const { node, path, distance } = queue.shift();
          task(node, path, distance);
        }
        taskEnded();
      }
    }
  };

  document.querySelector('#add').addEventListener('click', e => {
    range(100).forEach(() => addNode());
    resetEdges();
  });

  requestAnimationFrame(function update() {
    requestAnimationFrame(update);

    canvas.clear();

    for (let i = 0; i < edges.length; ++i) {
      for (const node of edges[i]) {
        canvas.line(nodes[i], node, 'white').stroke();
      }
    }

    if (state.selectedNode1 && state.selectedNode2) {
      let path = paths[state.selectedNode1.i][state.selectedNode2.i];
      if (path.length === 0) {
        path = temporaryPaths[state.selectedNode1.i][state.selectedNode2.i];
      }
      const lines = [];
      for (let i = 0; i < path.length - 1; ++i) {
        lines.push({ start: nodes[path[i]], end: nodes[path[i + 1]] });
      }
      canvas.lines(lines, 'red', 5).stroke();
    }

    for (const node of nodes) {
      canvas.circle(node.x, node.y, nodeRadius, 'gray').fill();
      canvas.circle(node.x, node.y, nodeRadius, 'white').stroke();
    }
    for (const node of nodes) {
      if (state.selectedNode1 && state.selectedNode1.i === node.i) {
        canvas.circle(node.x, node.y, nodeRadius * 2, 'blue').fill();
        canvas.circle(node.x, node.y, nodeRadius * 2, 'white').stroke();
      } else if (state.selectedNode2 && state.selectedNode2.i === node.i) {
        canvas.circle(node.x, node.y, nodeRadius * 2, 'red').fill();
        canvas.circle(node.x, node.y, nodeRadius * 2, 'white').stroke();
      } else if (state.focusedNode && state.focusedNode.i === node.i) {
        canvas.circle(node.x, node.y, nodeRadius * 1.5, 'green').fill();
        canvas.circle(node.x, node.y, nodeRadius * 1.5, 'white').stroke();
      }
      // canvas.text(`${node.i}`, node.x, node.y, 'white', 24, { horizontal: 'center', vertical: 'middle' }).fill();
      // canvas.text(`${node.i}`, node.x, node.y, 'red', 24, { horizontal: 'center', vertical: 'middle' }).stroke();
    }
  });
});
window.addEventListener('resize', e => {
  resize();
});
