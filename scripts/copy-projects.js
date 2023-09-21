const { rm, mkdir, cp } = require('shelljs');
rm('-rf', 'docs');
mkdir('-p', 'docs');
cp('index/*', 'docs/');
const projects = [
  'cardioid',
  'clock',
  'dot-adjacent-points',
  'dot-blur',
  'dot-focus',
  'dot-wave',
  'maze-pathfinder',
  'shortest-path',
  'snow-effect',
  'sort',
  'video-shadow',
  'waterfall',
  'wave-function-collapse',
];
for (const project of projects) {
  cp('-rf', project, 'docs/');
}
mkdir('-p', 'docs/modules');
cp('modules/*.js', 'docs/modules/');
