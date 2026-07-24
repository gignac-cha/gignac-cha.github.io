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

// One row in the Pipelines stream — and therefore one row of the Iceberg table `footprint.trail`,
// because the stream's schema (stream-schema.json, kept in lockstep with this type) is what the
// R2 Data Catalog sink turns into table columns. The shape is deliberately FLAT, with every
// nested value pre-serialized to a JSON string: the browser payload evolves freely (new
// navigator/screen fields appear whenever the library grows), and mapping those objects to
// structured columns would turn every addition into an Iceberg schema migration. Instead, the
// handful of columns analytics actually filters and groups by (received_at, uuid, origin, href,
// user_agent) are promoted to real columns, and everything else rides inside the `payload` JSON
// string — queryable on demand, never a migration. Missing optional values are written as
// explicit `null` (not omitted) so every record carries the full column set; pinned by 'maps
// missing optional fields to null so the record schema stays stable' in footprints.test.ts.
// See https://developers.cloudflare.com/r2/data-catalog/ and, on why schema changes are worth
// avoiding, https://iceberg.apache.org/spec/#schema-evolution
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

// Only a JSON OBJECT is a footprint. Arrays and primitives are valid JSON but cannot carry the
// uuid/arguments/location shape buildFootprint() reads, so they are rejected here (the caller
// answers 400) instead of turning garbage into empty-but-stored records.
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

// Promotes the few query-relevant fields out of the raw payload, taking each from the most
// trustworthy source available: receivedAt is stamped SERVER-side (the client clock is neither
// trusted nor required), origin/userAgent come from request headers rather than the body (always
// present, and costlier to fake than a JSON field), and cf is Cloudflare's own request metadata
// (country, colo, ...) — enrichment the client could not provide at all. The full payload is kept
// verbatim alongside the promoted fields, so promotion never loses data.
// See https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
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
