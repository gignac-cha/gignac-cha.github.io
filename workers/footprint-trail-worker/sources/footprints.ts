export type Footprint = {
  receivedAt: string;
  uuid: string | undefined;
  origin: string | undefined;
  href: string | undefined;
  userAgent: string | undefined;
  arguments_: unknown[];
  cf: Record<string, unknown> | undefined;
  payload: Record<string, unknown>;
};

export type FootprintContext = {
  receivedAt: string;
  origin: string | undefined;
  userAgent: string | undefined;
  cf: Record<string, unknown> | undefined;
};

// 스트림(→ R2 Parquet)에 적재되는 한 행. 스키마 안정성을 위해 중첩 값은 JSON 문자열로 저장합니다.
export type FootprintRecord = {
  received_at: string;
  uuid: string | null;
  origin: string | null;
  href: string | null;
  user_agent: string | null;
  arguments: string;
  cf: string | null;
  payload: string;
};

export const parsePayload = (bodyText: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const buildFootprint = (
  payload: Record<string, unknown>,
  context: FootprintContext,
): Footprint => {
  const location =
    typeof payload.location === 'object' && payload.location !== null
      ? (payload.location as Record<string, unknown>)
      : undefined;
  return {
    receivedAt: context.receivedAt,
    uuid: stringOrUndefined(payload.uuid),
    origin: context.origin,
    href: stringOrUndefined(location?.href),
    userAgent: context.userAgent,
    arguments_: Array.isArray(payload.arguments) ? payload.arguments : [],
    cf: context.cf,
    payload,
  };
};

export const toRecord = (footprint: Footprint): FootprintRecord => ({
  received_at: footprint.receivedAt,
  uuid: footprint.uuid ?? null,
  origin: footprint.origin ?? null,
  href: footprint.href ?? null,
  user_agent: footprint.userAgent ?? null,
  arguments: JSON.stringify(footprint.arguments_),
  cf: footprint.cf ? JSON.stringify(footprint.cf) : null,
  payload: JSON.stringify(footprint.payload),
});
