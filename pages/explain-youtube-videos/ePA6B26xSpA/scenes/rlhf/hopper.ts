import { clamp, ease, lerp, setAttributes, svg } from '../../../shared/diagram.ts';

// 2017년 연구(사람의 선호로 배우는 강화 학습)의 가상 로봇 "호퍼": 몸통·허벅지·정강이·발로 된 외다리 로봇.
// 발바닥 가운데를 원점(0, 0)으로 그리고, 자세는 재생 시간만으로 정한다.
export interface Pose {
  x: number;
  y: number;
  // 몸 전체 회전(도). pivot 을 축으로 돈다.
  rotate: number;
  pivot: { x: number; y: number };
  // 무릎 굽힘(0 = 곧게, 1 = 깊이 웅크림).
  crouch: number;
}

const segment = { torso: 62, thigh: 46, shin: 50, foot: 44 };

export const createHopper = (parent: Element) => {
  const group = svg('g', { class: 'hopper' }, parent);
  const body = svg('g', {}, group);
  const torso = svg('line', { class: 'hopper-torso' }, body);
  const thigh = svg('line', {}, body);
  const shin = svg('line', {}, body);
  const foot = svg('line', {}, body);
  const joints = [0, 1, 2].map(() => svg('circle', { r: 6, class: 'hopper-joint' }, body));

  const place = (pose: Pose) => {
    // 웅크릴수록 무릎이 앞으로 나가고 엉덩이가 내려간다.
    const knee = { x: 18 * pose.crouch, y: -segment.shin * Math.cos(pose.crouch * .9) };
    const hip = { x: 0, y: knee.y - segment.thigh * Math.cos(pose.crouch * .9) };
    const top = { x: -10 * pose.crouch, y: hip.y - segment.torso };
    const toOneDecimal = (n: number) => n.toFixed(1);
    setAttributes(foot, { x1: -segment.foot / 2, y1: 0, x2: segment.foot / 2, y2: 0 });
    setAttributes(shin, { x1: 0, y1: 0, x2: toOneDecimal(knee.x), y2: toOneDecimal(knee.y) });
    setAttributes(thigh, { x1: toOneDecimal(knee.x), y1: toOneDecimal(knee.y), x2: toOneDecimal(hip.x), y2: toOneDecimal(hip.y) });
    setAttributes(torso, { x1: toOneDecimal(hip.x), y1: toOneDecimal(hip.y), x2: toOneDecimal(top.x), y2: toOneDecimal(top.y) });
    [{ x: 0, y: 0 }, knee, hip].forEach((point, i) => setAttributes(joints[i], { cx: toOneDecimal(point.x), cy: toOneDecimal(point.y) }));
    setAttributes(body, { transform: `translate(${toOneDecimal(pose.x)} ${toOneDecimal(pose.y)}) rotate(${toOneDecimal(pose.rotate)} ${toOneDecimal(pose.pivot.x)} ${toOneDecimal(pose.pivot.y)})` });
  };
  return { group, place };
};

const foot = { x: 0, y: 0 };
const center = { x: 0, y: -90 };
const rest: Pose = { x: 0, y: 0, rotate: 0, pivot: foot, crouch: 0 };

// 비교용 짧은 동작들(1.6초 주기로 되풀이).
export const motions = {
  // 앞으로 고꾸라진다.
  fall: (t: number): Pose => ({ ...rest, rotate: 82 * ease(clamp(t / 1.1)), crouch: .2 * clamp(t / .4) }),
  // 제자리에서 깡충깡충.
  hop: (t: number): Pose => {
    const phase = (t % .8) / .8;
    return { ...rest, y: -70 * Math.sin(Math.PI * phase) ** 2, crouch: .5 * (1 - Math.sin(Math.PI * phase)) };
  },
  // 뒤로 젖히며 뛰어오르다 반쯤 돈다.
  arch: (t: number): Pose => {
    const air = clamp((t - .3) / .9);
    return { ...rest, y: -120 * Math.sin(Math.PI * air), rotate: -150 * ease(air), pivot: center, crouch: t < .3 ? t / .3 * .6 : .3 };
  },
  // 뒤로 벌러덩.
  topple: (t: number): Pose => ({ ...rest, rotate: -88 * ease(clamp(t / 1.2)), crouch: .1 }),
};

// 공중제비: 웅크렸다가 뛰어올라 뒤로 한 바퀴 돌고 착지한다.
export const backflip = (t: number, crouchAt: number, jumpAt: number, landAt: number): Pose => {
  if (t < jumpAt) {
    return { ...rest, crouch: .7 * ease(clamp((t - crouchAt) / (jumpAt - crouchAt))) };
  }
  if (t < landAt) {
    const air = (t - jumpAt) / (landAt - jumpAt);
    return { ...rest, y: -230 * 4 * air * (1 - air), rotate: -360 * ease(air), pivot: center, crouch: lerp(.2, .8, Math.sin(Math.PI * air)) };
  }
  const settle = clamp((t - landAt) / .35);
  return { ...rest, crouch: .6 * (1 - ease(settle)) };
};
