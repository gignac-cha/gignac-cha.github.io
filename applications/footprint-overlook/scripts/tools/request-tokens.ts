// Guards against out-of-order responses when range presets are clicked in quick succession: each
// load takes a token, and a response is only rendered while its token is still the newest one.
// Without it the six requests of an earlier range can settle AFTER a later range's and overwrite
// the screen with stale data — a race that depends on network timing and is therefore invisible
// in manual testing. Pure and DOM-free, so the race is reproduced deterministically in
// request-tokens.test.ts.

export interface RequestTokenGuard {
  issue(): number;
  isCurrent(token: number): boolean;
}

export function createRequestTokenGuard(): RequestTokenGuard {
  let activeToken = 0;
  return {
    issue: () => (activeToken += 1),
    isCurrent: (token) => token === activeToken,
  };
}
