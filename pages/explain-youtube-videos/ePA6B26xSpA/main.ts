import { seekFromHash } from '../shared/permalink';
import { renderSceneIndex } from '../shared/scene-index';
import { syncScenes, type Scene } from '../shared/scenes';
import { loadPlayer } from '../shared/youtube';
import { createAlexNetTricksScene } from './scenes/alexnet-tricks/scene';
import { createArtificialNeuronScene } from './scenes/artificial-neuron/scene';
import { createAttentionScene } from './scenes/attention/scene';
import { createBackpropagationScene } from './scenes/backpropagation/scene';
import { createChatGPTScene } from './scenes/chatgpt/scene';
import { createCnnScene } from './scenes/cnn/scene';
import { createDeepBeliefNetScene } from './scenes/deep-belief-net/scene';
import { createDeepBlueScene } from './scenes/deep-blue/scene';
import { createDepthScene } from './scenes/depth/scene';
import {
  createGanScene,
  createGanWeaknessScene,
} from './scenes/gan/scene';
import { createGpuScene } from './scenes/gpu/scene';
import { createImageNetErrorRateScene } from './scenes/imagenet-error-rate/scene';
import { createImageNetLabelingScene } from './scenes/imagenet-labeling/scene';
import { createLstmScene } from './scenes/lstm/scene';
import { createPerceptronScene } from './scenes/perceptron/scene';
import { createRnnScene } from './scenes/rnn/scene';
import { createSeq2SeqScene } from './scenes/seq2seq/scene';
import { createSvmScene } from './scenes/svm/scene';
import { createWord2VecScene } from './scenes/word2vec/scene';
import { createXorScene } from './scenes/xor/scene';

// 영상 순서대로 나열한다. 각 장면의 시간 구간과 세부 단계는 장면 폴더의 scene.ts에 있다.
const scenes: Scene[] = [
  createChatGPTScene(),
  createArtificialNeuronScene(),
  createPerceptronScene(),
  createXorScene(),
  createBackpropagationScene(),
  createSvmScene(),
  createCnnScene(),
  createRnnScene(),
  createLstmScene(),
  createDeepBlueScene(),
  createDeepBeliefNetScene(),
  createGpuScene(),
  createImageNetLabelingScene(),
  createImageNetErrorRateScene(),
  createAlexNetTricksScene(),
  createWord2VecScene(),
  createSeq2SeqScene(),
  createAttentionScene(),
  createGanScene(),
  createGanWeaknessScene(),
  createDepthScene(),
];

const player = await loadPlayer('video');
syncScenes(player, document.getElementById('scenes')!, scenes);
renderSceneIndex(player, document.getElementById('scene-index')!, scenes);
seekFromHash(player);
