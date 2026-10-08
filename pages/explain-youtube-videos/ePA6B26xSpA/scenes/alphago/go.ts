import './go.scss';
import { setAttributes, svg, text } from '../../../shared/diagram';

// 실제 기보(SGF 좌표를 이어 붙인 것: 두 글자가 한 수, a=1 … s=19, 왼쪽 위부터). 흑이 먼저 둔다.
// 출처: Andries Brouwer 의 AlphaGo 기보 모음(homepages.cwi.nl/~aeb/go/games/games/AlphaGo/).
export const records = {
  // 2016년 3월 10일 구글 딥마인드 챌린지 매치 제2국. 흑 알파고, 백 이세돌. 흑 불계승.
  leeGame2: 'pddpcdqpopoqnqpqcnfqmpqnicdjpoqocpcqbqcobpbodobndqepdrcmjpcgedqfqepfndpiojoinjmhgpgqdndmfohphoeoenfnemelfmgnflgoekdkdlclehdipjqirfrgkdhnomrerdsffigkhminhlkokpgcdfidjcgedgcfchbhdhbihdhegdfdhcfeecghfcgiiihkikilimijjljjifkmklljlklolikjcicjmjnrmrlqlpmqnplrlmkhhgqcqdrcpcsdggcebdqbhijghjobpbpanbdeeegjhhejnfmfmerkfhelnhnglglhmgogkgnijhnakimijincmbodmcockrmsioipjojnirhrqlrlqmrmaobmlnknmobeaeafadmalaoaddbglbpnonercrfpiqhqqjrjks',
  // 2016년 3월 13일 제4국. 흑 알파고, 백 이세돌. 백 불계승(78수 L11).
  leeGame4: 'pddpcdqpopoqnqpqcnfqmppoiqechdcgedcjdcbpncqiepeodkfpckdjejeifiehfhbjfkfgggffgfmcmdlcnbidhcjgpjpiojoininhmhngmgminjmflinendmjlfmkmenflhqjkkikjighhjgehefdfckijjljkhjhmlnkolokpkplqknlkjiirkompgqlcpcooerlskrjhgijkmgifjjlklglflgmcheeebbgdgegenfodfdhimhkbnifgdfehfihbhcihogoorrgdncqprqrrfqgqfjcgrsfsesgrdblbkakclhninhpfreresdsahaikdiekckbgkibqhrhqsrsohslofsjninjoojp',
  // 알파고 제로가 혼자 둔 대국(Nature 2017 그림 5c): 학습 3시간·19시간·70시간째. 앞 120수.
  zero3h: 'mghjgmlnggnljllfjggokihfjmmeejnnlonhmhkojomokplpknkqlojplqkoipiojqjninhpjoiqhohnhmjngnfnfmeofpemfoepenfqdngpfngqdpeqdokmhoilimhnklmmhoomlmhnknlljokmhojnjjmkelokdmnjdqmilhnpljoinfognepfndpldrpjlkmqfsqmerlrhrnrhsphfrjkgrhnhqihhoipirkhjsjrlskr',
  zero19h: 'dppppdddqpqoqqpqroqnrnqmrmqlprorqrmqdceccccdebfcfbgcgbhciqckdjcjdidkcifkghgqcmgoemgliofmeqjlgrdgegehdhfgeffhcfeedfffbdbebccebfndejekfjgjgifihjgkihkhkilikjjhiiaebiafbgikifjijdjckckdjeicjjldijmhklkmllljjmilkkjnlmknlnkplglhjgpfoemgofpgogphohoi',
  zero70h: 'ddpddpppncocndpfqqpqqpqorornqnpormrpsnrqqrrrrelcqcnbmbobmcldnflblaqerdrfqgqfrbqiohlflgkglhnemeoelemdjckakecqcpdqfqeqepfrbqbrerbpcraqdrbqgrfpgqeofogpencndohpiqdleldkekdjejeififhgighhidhlnkolokpnrormqknlmkmllklipkkkijijhkjiimkomojcfhncidichgn',
};

export const SIZE = 19;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

// 두 글자 좌표 → 칸 번호(행 * 19 + 열, 왼쪽 위가 0).
export const parse = (record: string) => Array.from({ length: record.length / 2 }, (_, i) => (record.charCodeAt(i * 2 + 1) - 97) * SIZE + (record.charCodeAt(i * 2) - 97));

const neighbors = (index: number) => {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const result: number[] = [];
  if (row > 0) result.push(index - SIZE);
  if (row < SIZE - 1) result.push(index + SIZE);
  if (column > 0) result.push(index - 1);
  if (column < SIZE - 1) result.push(index + 1);
  return result;
};

// 한 수를 두고, 활로가 없어진 상대 돌을 들어낸다.
const play = (board: Int8Array, index: number, color: number) => {
  board[index] = color;
  const opponent = color === BLACK ? WHITE : BLACK;
  for (const start of neighbors(index)) {
    if (board[start] !== opponent) {
      continue;
    }
    const group = [start];
    const seen = new Set(group);
    let free = false;
    for (let k = 0; k < group.length && !free; k++) {
      for (const next of neighbors(group[k])) {
        if (board[next] === EMPTY) {
          free = true;
          break;
        }
        if (board[next] === opponent && !seen.has(next)) {
          seen.add(next);
          group.push(next);
        }
      }
    }
    if (!free) {
      for (const stone of group) {
        board[stone] = EMPTY;
      }
    }
  }
};

// n 수까지 둔 판(0 이면 빈 판). 처음 한 번 전부 계산해 둔다.
export const createReplay = (record: string) => {
  const moves = parse(record);
  const boards: Int8Array[] = [new Int8Array(SIZE * SIZE)];
  for (let n = 0; n < moves.length; n++) {
    const board = new Int8Array(boards[n]);
    play(board, moves[n], n % 2 === 0 ? BLACK : WHITE);
    boards.push(board);
  }
  return { moves, length: moves.length, at: (n: number) => boards[Math.max(0, Math.min(moves.length, Math.floor(n)))] };
};

// 바둑판 좌표 이름: 열은 I 를 건너뛴 A~T, 행은 아래에서부터 1~19.
export const pointName = (index: number) => `${'ABCDEFGHJKLMNOPQRST'[index % SIZE]}${SIZE - Math.floor(index / SIZE)}`;

// SVG 바둑판. update(board, last) 로 돌을 그린다.
export const createBoard = (parent: Element, { x, y, size, labels = false }: { x: number; y: number; size: number; labels?: boolean }) => {
  const group = svg('g', { class: 'go-board' }, parent);
  const pitch = size / (SIZE + 1);
  const origin = { x: x + pitch, y: y + pitch };
  const point = (index: number) => ({ x: origin.x + (index % SIZE) * pitch, y: origin.y + Math.floor(index / SIZE) * pitch });
  svg('rect', { class: 'go-wood', x, y, width: size, height: size, rx: size * .012 }, group);
  let lines = '';
  for (let i = 0; i < SIZE; i++) {
    lines += `M${origin.x},${origin.y + i * pitch}h${pitch * (SIZE - 1)}M${origin.x + i * pitch},${origin.y}v${pitch * (SIZE - 1)}`;
  }
  svg('path', { class: 'go-lines', d: lines, 'stroke-width': Math.max(size / 600, .8) }, group);
  for (const row of [3, 9, 15]) {
    for (const column of [3, 9, 15]) {
      const p = point(row * SIZE + column);
      svg('circle', { class: 'go-star', cx: p.x, cy: p.y, r: pitch * .1 }, group);
    }
  }
  if (labels) {
    for (let i = 0; i < SIZE; i++) {
      text(group, origin.x + i * pitch, y - pitch * .25, 'ABCDEFGHJKLMNOPQRST'[i], { class: 'go-label', 'font-size': pitch * .42 });
      text(group, x - pitch * .45, origin.y + i * pitch + pitch * .15, String(SIZE - i), { class: 'go-label', 'font-size': pitch * .42 });
    }
  }
  const overlay = svg('g', {}, group);
  const stonesLayer = svg('g', {}, group);
  const stones = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const p = point(index);
    return svg('circle', { cx: p.x, cy: p.y, r: pitch * .47, class: 'go-stone', opacity: 0 }, stonesLayer);
  });
  const marker = svg('circle', { class: 'go-last', r: pitch * .18, opacity: 0 }, group);
  const top = svg('g', {}, group);

  const update = (board: Int8Array, last?: number) => {
    for (let index = 0; index < stones.length; index++) {
      const color = board[index];
      const stone = stones[index];
      setAttributes(stone, { opacity: color === EMPTY ? 0 : 1 });
      if (color !== EMPTY) {
        stone.classList.toggle('black', color === BLACK);
        stone.classList.toggle('white', color === WHITE);
      }
    }
    if (last !== undefined && board[last] !== EMPTY) {
      const p = point(last);
      setAttributes(marker, { cx: p.x, cy: p.y, opacity: 1 });
      marker.classList.toggle('on-black', board[last] === BLACK);
    } else {
      setAttributes(marker, { opacity: 0 });
    }
  };

  return { group, overlay, top, point, pitch, stones, update };
};
