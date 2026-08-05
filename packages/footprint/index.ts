// Side-effect entry — the package's default export path (`.`). Importing this module fires exactly
// one automatic pageview and re-exports step for manual events; that is the package's "zero extra
// code" contract: `import '@scope/footprint'` and tracking begins. Consumers who want step()
// WITHOUT the import-time pageview import the pure core through the './step' subpath
// (footprint.ts), which has no side effect at all — the split makes opting out an import path,
// not a configuration flag. It is also what lets the generated manifest pin
// `sideEffects: ["./index.js"]` (see publish.ts): this file is the only module a bundler may not
// tree-shake, so the auto-fire always survives here while every other module — including the core
// this re-exports from — stays prunable. Both halves are pinned by footprint.test.ts: the main
// suites import './index.ts' and assert the pageview fires, and the 'manual-only entry (./step,
// no auto-fire)' suite asserts importing footprint.ts alone stays silent.
export { step } from './footprint.ts';
// The namespaced surface (`footprint.step`) — re-exported rather than rebuilt so both entries
// serve the identical object; see the default-export comment in footprint.ts for why it exists.
export { default } from './footprint.ts';

import { fireAutoPageview } from './footprint.ts';

fireAutoPageview();
