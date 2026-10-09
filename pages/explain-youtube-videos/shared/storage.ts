// 화면 배치 같은 개인 설정만 브라우저에 저장한다. 저장이 막힌 환경(사생활 보호 모드 등)에서도 기본값으로 동작한다.
const prefix = 'explain-youtube-videos:';

export const load = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(prefix + key);
    return value === null ? fallback : { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
};

export const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    // 저장하지 못해도 화면은 그대로 쓸 수 있다.
  }
};
