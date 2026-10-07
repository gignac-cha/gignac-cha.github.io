import { seekFromHash } from '../shared/permalink';
import { renderSceneIndex } from '../shared/scene-index';
import { syncScenes, type Scene } from '../shared/scenes';
import { loadPlayer } from '../shared/youtube';
import { createChatGPTScene } from './scenes/chatgpt/scene';
import { createCnnScene } from './scenes/cnn/scene';
import { createSvmScene } from './scenes/svm/scene';

// 영상 순서대로 나열한다. 각 장면의 시간 구간과 세부 단계는 장면 폴더의 scene.ts에 있다.
const scenes: Scene[] = [
  createChatGPTScene(),
  createSvmScene(),
  createCnnScene(),
];

const player = await loadPlayer('video');
syncScenes(player, document.getElementById('scenes')!, scenes);
renderSceneIndex(player, document.getElementById('scene-index')!, scenes);
seekFromHash(player);
