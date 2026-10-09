import { rememberPosition, seekFromHash } from '../shared/permalink.ts';
import { createPlayback } from '../shared/playback.ts';
import { setupIndexDock } from '../shared/index-dock.ts';
import { setupPip } from '../shared/pip.ts';
import { renderSceneIndex } from '../shared/scene-index.ts';
import { syncScenes, type Scene } from '../shared/scenes.ts';
import { setupSplitter } from '../shared/splitter.ts';
import { renderTimeline } from '../shared/timeline.ts';
import { setupTimelineDock } from '../shared/timeline-dock.ts';
import { loadPlayer } from '../shared/youtube.ts';
import { createAlexNetTricksScene } from './scenes/alexnet-tricks/scene.ts';
import { createAlphaFoldScene } from './scenes/alphafold/scene.ts';
import { createAlphaGoScene } from './scenes/alphago/scene.ts';
import { createAlphaGoMovesScene } from './scenes/alphago-moves/scene.ts';
import { createAlphaGoZeroScene } from './scenes/alphago-zero/scene.ts';
import { createArtificialNeuronScene } from './scenes/artificial-neuron/scene.ts';
import { createAttentionScene } from './scenes/attention/scene.ts';
import { createBackpropagationScene } from './scenes/backpropagation/scene.ts';
import { createBatchNormalizationScene } from './scenes/batch-normalization/scene.ts';
import { createBertScene } from './scenes/bert/scene.ts';
import { createBertSearchScene } from './scenes/bert-search/scene.ts';
import { createChatGPTScene } from './scenes/chatgpt/scene.ts';
import { createChatGptPiecesScene } from './scenes/chatgpt-pieces/scene.ts';
import { createClipScene } from './scenes/clip/scene.ts';
import { createCnnScene } from './scenes/cnn/scene.ts';
import { createContextWindowScene } from './scenes/context-window/scene.ts';
import { createDeepBeliefNetScene } from './scenes/deep-belief-net/scene.ts';
import { createDeepBlueScene } from './scenes/deep-blue/scene.ts';
import { createDeepQNetworkScene } from './scenes/deep-q-network/scene.ts';
import { createDepthScene } from './scenes/depth/scene.ts';
import { createDiffusionScene } from './scenes/diffusion/scene.ts';
import { createEmergenceScene } from './scenes/emergence/scene.ts';
import { createEncoderDecoderScene } from './scenes/encoder-decoder/scene.ts';
import { createFewShotScene } from './scenes/few-shot/scene.ts';
import {
  createGanScene,
  createGanWeaknessScene,
} from './scenes/gan/scene.ts';
import { createGpt2Scene } from './scenes/gpt2/scene.ts';
import { createGpt3LimitsScene } from './scenes/gpt3-limits/scene.ts';
import { createGpt4MultimodalScene } from './scenes/gpt4-multimodal/scene.ts';
import { createGpt4oScene } from './scenes/gpt4o/scene.ts';
import { createGpt5RouterScene } from './scenes/gpt5-router/scene.ts';
import { createGpuScene } from './scenes/gpu/scene.ts';
import { createImageNetErrorRateScene } from './scenes/imagenet-error-rate/scene.ts';
import { createImageNetLabelingScene } from './scenes/imagenet-labeling/scene.ts';
import { createLimitsScene } from './scenes/limits/scene.ts';
import { createLstmScene } from './scenes/lstm/scene.ts';
import { createNextWordScene } from './scenes/next-word/scene.ts';
import { createPerceptronScene } from './scenes/perceptron/scene.ts';
import { createReasoningModelScene } from './scenes/reasoning-model/scene.ts';
import { createRecentHistoryScene, createRecentHistoryTodayScene } from './scenes/recent-history/scene.ts';
import { createResidualNetworkScene } from './scenes/residual-network/scene.ts';
import { createInstructGptScene, createRlhfScene } from './scenes/rlhf/scene.ts';
import { createRnnScene } from './scenes/rnn/scene.ts';
import { createGpt3ScaleScene, createScalingLawsScene } from './scenes/scaling-laws/scene.ts';
import { createSelfAttentionScene } from './scenes/self-attention/scene.ts';
import { createSeq2SeqScene } from './scenes/seq2seq/scene.ts';
import { createSkipConnectionsScene } from './scenes/skip-connections/scene.ts';
import { createStableDiffusionScene } from './scenes/stable-diffusion/scene.ts';
import { createSvmScene } from './scenes/svm/scene.ts';
import { createTestTimeComputeScene } from './scenes/test-time-compute/scene.ts';
import { createToolAgentScene } from './scenes/tool-agent/scene.ts';
import { createTransformerEverywhereScene } from './scenes/transformer-everywhere/scene.ts';
import { createTransformerTranslationScene } from './scenes/transformer-translation/scene.ts';
import { createVanishingGradientScene } from './scenes/vanishing-gradient/scene.ts';
import { createWord2VecScene } from './scenes/word2vec/scene.ts';
import { createXorScene } from './scenes/xor/scene.ts';

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
  createDiffusionScene(),
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
  createRecentHistoryScene(),
  createContextWindowScene(),
  createRecentHistoryTodayScene(),
  createLimitsScene(),
];

const element = (id: string) => document.getElementById(id)!;

// 화면 배치는 저장된 상태로 플레이어를 기다리지 않고 바로 잡는다. 새로고침해도 그 화면 그대로.
setupSplitter(element('layout'), element('splitter'));
setupPip(element('pip-toggle') as HTMLButtonElement, element('video-panel'));
setupIndexDock(element('scene-index'), element('layout'));
setupTimelineDock(element('timeline-panel'), element('timeline-top'), element('timeline-bottom'));

const player = await loadPlayer('video');
// 장면·목록·재생 바는 매 프레임 보간한 같은 시계를 본다(2배속에서도 끊기지 않게).
const playback = createPlayback(player);
syncScenes(playback, element('scenes'), scenes);
renderSceneIndex(playback, element('scene-index'), scenes);
renderTimeline(playback, element('timeline'), scenes);
seekFromHash(player);
rememberPosition(player, 'ePA6B26xSpA');
