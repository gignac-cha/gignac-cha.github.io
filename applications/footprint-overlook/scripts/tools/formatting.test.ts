import { describe, expect, it } from 'vitest';

import {
  formatCount,
  formatPercentage,
  formatTimestamp,
  shortenHref,
  shortenUuid,
  summarizeArguments,
  truncateText,
} from './formatting.ts';

describe('formatCount', () => {
  it('천단위 구분 기호를 넣는다', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
  });

  it('소수는 반올림한다', () => {
    expect(formatCount(3.6)).toBe('4');
  });

  it('비정상 값은 0 이다', () => {
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('shortenUuid', () => {
  it('앞 8자리만 남기고 말줄임표를 붙인다', () => {
    expect(shortenUuid('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567…');
  });

  it('짧은 문자열은 그대로 둔다', () => {
    expect(shortenUuid('abcd')).toBe('abcd');
  });

  it('headLength 를 조절할 수 있다', () => {
    expect(shortenUuid('123e4567-e89b', 4)).toBe('123e…');
  });
});

describe('truncateText', () => {
  it('최대 길이를 넘으면 자르고 말줄임표를 붙인다', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcd…');
  });

  it('최대 길이 이하면 그대로 둔다', () => {
    expect(truncateText('abc', 5)).toBe('abc');
  });

  it('경계 길이에서는 자르지 않는다', () => {
    expect(truncateText('abcde', 5)).toBe('abcde');
  });
});

describe('shortenHref', () => {
  it('스킴과 www. 를 걷어낸다', () => {
    expect(shortenHref('https://www.example.com/blog/post')).toBe('example.com/blog/post');
    expect(shortenHref('http://example.com/')).toBe('example.com');
  });

  it('길면 자른다', () => {
    expect(shortenHref('https://example.com/very/long/path/segment/here', 20)).toBe('example.com/very/lo…');
  });

  it('빈 문자열은 빈 문자열이다', () => {
    expect(shortenHref('')).toBe('');
  });
});

describe('summarizeArguments', () => {
  it('JSON 배열을 콤마로 잇는다', () => {
    expect(summarizeArguments('["click","header"]')).toBe('click, header');
  });

  it('빈 배열이면 대시', () => {
    expect(summarizeArguments('[]')).toBe('—');
  });

  it('빈/공백 문자열이면 대시', () => {
    expect(summarizeArguments('')).toBe('—');
    expect(summarizeArguments('   ')).toBe('—');
  });

  it('숫자/객체 항목은 JSON 으로 직렬화해 잇는다', () => {
    expect(summarizeArguments('[1,{"a":2}]')).toBe('1, {"a":2}');
  });

  it('길면 자른다', () => {
    expect(summarizeArguments('["aaaaaaaaaa","bbbbbbbbbb"]', 10)).toBe('aaaaaaaaa…');
  });

  it('JSON 이 아니면 원문을 요약한다', () => {
    expect(summarizeArguments('not-json')).toBe('not-json');
  });
});

describe('formatTimestamp', () => {
  it('ISO 타임스탬프를 MM-DD HH:mm 로 표기한다', () => {
    expect(formatTimestamp('2026-07-16T13:45:22Z')).toBe('07-16 13:45');
  });

  it('SQL 형식(공백 구분)도 처리한다', () => {
    expect(formatTimestamp('2026-07-16 09:05:00')).toBe('07-16 09:05');
  });

  it('형식이 맞지 않으면 원문을 돌려준다', () => {
    expect(formatTimestamp('unknown')).toBe('unknown');
  });
});

describe('formatPercentage', () => {
  it('비율을 정수 퍼센트로 만든다', () => {
    expect(formatPercentage(0.5)).toBe('50%');
    expect(formatPercentage(1)).toBe('100%');
  });

  it('0 이하나 비정상 값은 0% 다', () => {
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(-1)).toBe('0%');
    expect(formatPercentage(Number.NaN)).toBe('0%');
  });
});
