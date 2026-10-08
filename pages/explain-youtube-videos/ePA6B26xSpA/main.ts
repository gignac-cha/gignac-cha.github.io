import { rememberPosition, seekFromHash } from '../shared/permalink';
import { createPlayback } from '../shared/playback';
import { setupIndexDock } from '../shared/index-dock';
import { setupPip } from '../shared/pip';
import { renderSceneIndex } from '../shared/scene-index';
import { syncScenes, type Scene } from '../shared/scenes';
import { setupSplitter } from '../shared/splitter';
import { renderTimeline } from '../shared/timeline';
import { setupTimelineDock } from '../shared/timeline-dock';
import { loadPlayer } from '../shared/youtube';
import { createAlexNetTricksScene } from './scenes/alexnet-tricks/scene';
import { createAlphaFoldScene } from './scenes/alphafold/scene';
import { createAlphaGoScene } from './scenes/alphago/scene';
import { createAlphaGoMovesScene } from './scenes/alphago-moves/scene';
import { createAlphaGoZeroScene } from './scenes/alphago-zero/scene';
import { createArtificialNeuronScene } from './scenes/artificial-neuron/scene';
import { createAttentionScene } from './scenes/attention/scene';
import { createBackpropagationScene } from './scenes/backpropagation/scene';
import { createBatchNormalizationScene } from './scenes/batch-normalization/scene';
import { createBertScene } from './scenes/bert/scene';
import { createBertSearchScene } from './scenes/bert-search/scene';
import { createChatGPTScene } from './scenes/chatgpt/scene';
import { createChatGptPiecesScene } from './scenes/chatgpt-pieces/scene';
import { createClipScene } from './scenes/clip/scene';
import { createCnnScene } from './scenes/cnn/scene';
import { createContextWindowScene } from './scenes/context-window/scene';
import { createDeepBeliefNetScene } from './scenes/deep-belief-net/scene';
import { createDeepBlueScene } from './scenes/deep-blue/scene';
import { createDeepQNetworkScene } from './scenes/deep-q-network/scene';
import { createDepthScene } from './scenes/depth/scene';
import { createEmergenceScene } from './scenes/emergence/scene';
import { createEncoderDecoderScene } from './scenes/encoder-decoder/scene';
import { createFewShotScene } from './scenes/few-shot/scene';
import {
  createGanScene,
  createGanWeaknessScene,
} from './scenes/gan/scene';
import { createGpt2Scene } from './scenes/gpt2/scene';
import { createGpt3LimitsScene } from './scenes/gpt3-limits/scene';
import { createGpt4MultimodalScene } from './scenes/gpt4-multimodal/scene';
import { createGpt4oScene } from './scenes/gpt4o/scene';
import { createGpt5RouterScene } from './scenes/gpt5-router/scene';
import { createGpuScene } from './scenes/gpu/scene';
import { createImageNetErrorRateScene } from './scenes/imagenet-error-rate/scene';
import { createImageNetLabelingScene } from './scenes/imagenet-labeling/scene';
import { createLimitsScene } from './scenes/limits/scene';
import { createLstmScene } from './scenes/lstm/scene';
import { createNextWordScene } from './scenes/next-word/scene';
import { createPerceptronScene } from './scenes/perceptron/scene';
import { createReasoningModelScene } from './scenes/reasoning-model/scene';
import { createResidualNetworkScene } from './scenes/residual-network/scene';
import { createInstructGptScene, createRlhfScene } from './scenes/rlhf/scene';
import { createRnnScene } from './scenes/rnn/scene';
import { createGpt3ScaleScene, createScalingLawsScene } from './scenes/scaling-laws/scene';
import { createSelfAttentionScene } from './scenes/self-attention/scene';
import { createSeq2SeqScene } from './scenes/seq2seq/scene';
import { createSkipConnectionsScene } from './scenes/skip-connections/scene';
import { createStableDiffusionScene } from './scenes/stable-diffusion/scene';
import { createSvmScene } from './scenes/svm/scene';
import { createTestTimeComputeScene } from './scenes/test-time-compute/scene';
import { createToolAgentScene } from './scenes/tool-agent/scene';
import { createTransformerEverywhereScene } from './scenes/transformer-everywhere/scene';
import { createTransformerTranslationScene } from './scenes/transformer-translation/scene';
import { createVanishingGradientScene } from './scenes/vanishing-gradient/scene';
import { createWord2VecScene } from './scenes/word2vec/scene';
import { createXorScene } from './scenes/xor/scene';

// 영상 순서대로 나열한다. 각 장면의 시간 구간과 세부 단계는 장면 폴더의 scene.ts에 있다.
const scenes: Scene[] = [
  createChatGPTScene(),
  createArtificialNeuronScene(),
  createPerceptronScene(),
  createXorScene(),
  createBackpropagationScene(),
  createVanishingGradientScene(),
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
  createResidualNetworkScene(),
  createBatchNormalizationScene(),
  createSkipConnectionsScene(),
  createDeepQNetworkScene(),
  createAlphaGoScene(),
  createAlphaGoMovesScene(),
  createAlphaGoZeroScene(),
  createSelfAttentionScene(),
  createTransformerTranslationScene(),
  createTransformerEverywhereScene(),
  createEncoderDecoderScene(),
  createNextWordScene(),
  createBertScene(),
  createBertSearchScene(),
  createGpt2Scene(),
  createScalingLawsScene(),
  createGpt3ScaleScene(),
  createFewShotScene(),
  createEmergenceScene(),
  createAlphaFoldScene(),
  createClipScene(),
  createStableDiffusionScene(),
  createGpt3LimitsScene(),
  createRlhfScene(),
  createInstructGptScene(),
  createChatGptPiecesScene(),
  createGpt4MultimodalScene(),
  createGpt4oScene(),
  createReasoningModelScene(),
  createTestTimeComputeScene(),
  createToolAgentScene(),
  createGpt5RouterScene(),
  createContextWindowScene(),
  createLimitsScene(),
];

// 30:00 까지 장면 작업을 마쳤다. 그 뒤는 재생 바와 장면 영역에 '준비 중'으로 표시한다. 전부 끝나면 지운다.
const coverage = { exploredUntil: 1800 };

const element = (id: string) => document.getElementById(id)!;

// 화면 배치는 저장된 상태로 플레이어를 기다리지 않고 바로 잡는다. 새로고침해도 그 화면 그대로.
setupSplitter(element('layout'), element('splitter'));
setupPip(element('pip-toggle') as HTMLButtonElement, element('video-panel'));
setupIndexDock(element('scene-index'), element('layout'));
setupTimelineDock(element('timeline-panel'), element('timeline-top'), element('timeline-bottom'));

const player = await loadPlayer('video');
// 장면·목록·재생 바는 매 프레임 보간한 같은 시계를 본다(2배속에서도 끊기지 않게).
const playback = createPlayback(player);
syncScenes(playback, element('scenes'), scenes, coverage);
renderSceneIndex(playback, element('scene-index'), scenes, coverage);
renderTimeline(playback, element('timeline'), scenes, coverage);
seekFromHash(player);
rememberPosition(player, 'ePA6B26xSpA');
