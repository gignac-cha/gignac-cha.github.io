// 화면 표기용 문자열 가공을 담당하는 순수 함수 계층입니다. DOM 의존이 없어 vitest 로 단독 검증할 수 있습니다.

// 수치를 한국어 로케일 천단위 구분으로 표기합니다. (Intl 은 Node/브라우저 모두 제공)
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

// uuid 를 앞자리만 남겨 축약합니다(테이블에서 폭 절약). 원문이 더 짧으면 그대로 둡니다.
export function shortenUuid(uuid: string, headLength = 8): string {
  if (typeof uuid !== 'string' || uuid.length <= headLength) {
    return uuid ?? '';
  }
  return `${uuid.slice(0, headLength)}…`;
}

// 문자열을 최대 길이로 자르고 말줄임표를 붙입니다.
export function truncateText(text: string, maximumLength: number): string {
  if (typeof text !== 'string' || text.length <= maximumLength) {
    return text ?? '';
  }
  if (maximumLength <= 1) {
    return '…';
  }
  return `${text.slice(0, maximumLength - 1)}…`;
}

// href 를 짧은 표시형으로 다듬습니다. 스킴(https://)과 www. 를 걷어내고 필요하면 길이를 자릅니다.
export function shortenHref(href: string, maximumLength = 48): string {
  if (typeof href !== 'string' || href.length === 0) {
    return '';
  }
  const withoutScheme = href.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const trimmed = withoutScheme.replace(/\/$/, '');
  return truncateText(trimmed.length > 0 ? trimmed : withoutScheme, maximumLength);
}

// arguments(JSON 배열 문자열)를 사람이 읽기 좋은 짧은 요약으로 만듭니다.
// - 빈 배열이면 '—'.
// - 각 항목을 콤마로 잇고 최대 길이로 자릅니다.
// - JSON 파싱 실패 시 원문을 잘라 반환합니다.
export function summarizeArguments(argumentsText: string, maximumLength = 60): string {
  if (typeof argumentsText !== 'string' || argumentsText.trim().length === 0) {
    return '—';
  }

  try {
    const parsed: unknown = JSON.parse(argumentsText);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return '—';
      }
      const joined = parsed
        .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join(', ');
      return truncateText(joined, maximumLength);
    }
    // 배열이 아니면 원문 자체를 요약합니다.
    return truncateText(argumentsText, maximumLength);
  } catch {
    return truncateText(argumentsText, maximumLength);
  }
}

// received_at 타임스탬프(ISO 또는 SQL 형식)를 "MM-DD HH:mm" 로 표기합니다.
// 시간대 변환을 하지 않고 문자열 구성요소를 그대로 씁니다(결정적·테스트 가능).
export function formatTimestamp(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) {
    return text;
  }
  const [, , month, day, hour, minute] = match;
  return `${month}-${day} ${hour}:${minute}`;
}

// 비율(0~1)을 정수 퍼센트 문자열로 만듭니다(막대 폭 라벨 등).
export function formatPercentage(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return '0%';
  }
  return `${Math.round(ratio * 100)}%`;
}
