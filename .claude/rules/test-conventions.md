---
paths:
  - tests/**
---

# Test Conventions

- Vitest + jsdom + `@vue/test-utils` (`vitest.config.ts`, `npm test`). There is no Jest and no Babel in this repo.
- Tests live flat in `tests/unit/*.test.ts`, co-located by module name (the `src/` tree is flat): `tests/unit/tizenBridge.test.ts` covers `src/tizenBridge.ts`, `tests/unit/hubRelay.test.ts` covers `src/api/hubRelay.ts`.
- Import the module under test via the `@` alias (`import { resolveAppConfig } from '@/resolveConfig';`) — `vitest.config.ts` maps `@` → `src/`.
- `tests/test-setup.ts` installs an in-memory `localStorage` mock and is loaded through `setupFiles` for every suite.
- Structure: outer `describe(<module>)` → nested `describe(<feature>)` → `it('…')`. See `tests/unit/tizenBridge.test.ts` for the canonical layout.
- Pure helpers (`resolveAppConfig`, `resolveDeviceId`, `wireTizenBridge`, `wirePendingPlayMediaDispatcher`, `parsePendingCommandFrame`) take structurally-typed deps — exercise them with fakes, no real Vue app or DOM.
- SFC suites (`tests/unit/UpNextOverlay.test.ts`, `tests/unit/SubtitleTrackList.test.ts`) mount the component with `@phlix/ui`'s `ApiClient` / `useApiBase` / `usePlayerStore` and `vue-router` stubbed via `vi.hoisted` + `vi.mock`.
- `tests/unit/main.test.ts` mocks `@phlix/ui`, `@phlix/contracts` and `vue`'s `createApp`. Any NEW named import added to `src/main.ts` must also be stubbed there, or it resolves to `undefined` and `boot()` throws.
- **Route gate**: `tests/unit/routeManifest.gate.test.ts` pins every request URL the client can put on the wire tuple-exact against the vendored `tests/fixtures/server-route-manifest.json`. Its per-file site counts are a pin, not a promise — adding, moving or removing a request site means updating that file's count there.
- Coverage is v8 and excludes `app/**`, `tests/`, `dist/`, and configs.
- ESLint turns `no-explicit-any` off inside tests; keep formatting consistent with neighbouring suites.
- Run a single file: `npx vitest run tests/unit/tizenBridge.test.ts`; a single test: `npx vitest run -t "BACK"`.
