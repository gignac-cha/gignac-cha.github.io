// OpenAI가 2019년 2월 GPT-2를 소개하며 공개한 실제 예시("Better Language Models and Their Implications").
// 첫머리는 사람이 썼고, 이어지는 글은 GPT-2가 10번 생성한 것 중 하나다. 원문 그대로 옮긴다.

type Segment = [content: string, mark?: 'andes' | 'unicorn'];

export const prompt: Segment[][] = [
  [['In a shocking finding, scientist discovered a herd of '], ['unicorns', 'unicorn'], [' living in a remote,']],
  [['previously unexplored valley, in the '], ['Andes Mountains', 'andes'], ['. Even more surprising to the']],
  [['researchers was the fact that the '], ['unicorns', 'unicorn'], [' spoke perfect English.']],
];

export const promptGloss = '충격적인 발견: 안데스 산맥의 외딴 계곡에서 유니콘 무리가 발견됐다. 더 놀라운 건 유니콘들이 완벽한 영어를 했다는 것.';

export const continuation = [
  'The scientist named the population, after their distinctive horn, Ovid\'s Unicorn. ',
  'These four-horned, silver-white unicorns were previously unknown to science. ',
  'Now, after almost two centuries, the mystery of what sparked this odd ',
  'phenomenon is finally solved. ',
  'Dr. Jorge Pérez, an evolutionary biologist from the University of La Paz, and ',
  'several companions, were exploring the Andes Mountains when they found a small ',
  'valley, with no other animals or humans.',
];

export const continuationGloss = '과학자들은 독특한 뿔을 따서 이 무리를 ‘오비드의 유니콘’이라 불렀다. 뿔이 넷 달린 은백색 유니콘은…';
