/**
 * i18n seam wiring tests — THE proof that a client-supplied catalog override
 * actually reaches the rendered strings of `@phlix/ui`.
 *
 * Three layers, deepest first in importance:
 *  1. END-TO-END against the REAL v0.99.6 `@phlix/ui` bundle (no mocks): a fake
 *     override `{ common: { retry: 'ZZZ-TEST' } }` passed to the real
 *     `createPhlixApp()` must surface as 'ZZZ-TEST' through the real
 *     `useMessages().t` inside a mounted component, while untouched keys keep
 *     their English defaults. The component is mounted with the provide-context
 *     the real app factory produced (`app._context.provides`), so the config
 *     spread + `'phlixConfig'` provide + inject + merge + resolve chain is the
 *     production code path, not a re-implementation.
 *  2. merge-semantics pins via ui's exported `mergeMessages` (per-group spread;
 *     unknown groups dropped) — documenting exactly what a locale file may do.
 *  3. Pure unit coverage of the client's own `resolveLocale` priority table and
 *     catalog lookup.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createPhlixApp, mergeMessages, useMessages } from '@phlix/ui';
import type { PhlixAppConfig, PhlixMessagesConfig } from '@phlix/ui';
import {
  resolveLocale,
  messagesForLocale,
  normalizeLocaleTag,
  isSupportedLocale,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
} from '@/i18n';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// 1. End-to-end through the REAL @phlix/ui factory + composable
// ---------------------------------------------------------------------------

/** The real config object `createPhlixApp` spread + provided under 'phlixConfig'. */
function providedPhlixConfig(application: ReturnType<typeof createPhlixApp>): PhlixAppConfig {
  return realProvides(application).phlixConfig as PhlixAppConfig;
}

/**
 * Vue's internal provide storage of the REAL app instance. `_context.provides`
 * is stable across Vue 3.x and reading it is the only way to observe what the
 * factory provided WITHOUT mounting the full router-driven app (whose guards
 * init auth over the network). The probe components below consume this same
 * object through the real inject() path, via VTU's `global.provide` option.
 */
function realProvides(application: ReturnType<typeof createPhlixApp>): Record<string, unknown> {
  return (application as unknown as { _context: { provides: Record<string, unknown> } })._context
    .provides;
}

/** A minimal component resolved through ui's REAL `useMessages()` composable. */
function probeComponent(keys: readonly string[]) {
  return defineComponent({
    name: 'I18nProbe',
    setup() {
      const { t } = useMessages();
      return () =>
        h(
          'div',
          keys.map((key) => h('span', { 'data-key': key }, t(key as never))),
        );
    },
  });
}

describe('end-to-end: client messages override reaches ui-rendered strings (real @phlix/ui, no mocks)', () => {
  const OVERRIDE: PhlixMessagesConfig = { common: { retry: 'ZZZ-TEST' } };

  const app = createPhlixApp({
    app: 'server',
    apiBase: 'http://phlix.invalid',
    messages: OVERRIDE,
  });

  it('createPhlixApp carries the client override into the provided phlixConfig', () => {
    const provided = providedPhlixConfig(app);
    // Same reference: the factory spreads the consumer config verbatim, and
    // useMessages() injects THIS object.
    expect(provided.messages).toBe(OVERRIDE);
    expect(provided.messages?.common?.retry).toBe('ZZZ-TEST');
  });

  it('useMessages().t renders the override through the real inject→merge→resolve chain', () => {
    const wrapper = mount(probeComponent(['common.retry', 'common.close']), {
      global: { provide: realProvides(app) },
    });
    // The overridden string wins end-to-end…
    expect(wrapper.find('[data-key="common.retry"]').text()).toBe('ZZZ-TEST');
    // …while a sibling key in the SAME group keeps its ui English default
    // (per-group partial spread, not whole-group replacement).
    expect(wrapper.find('[data-key="common.close"]').text()).toBe('Close');
    wrapper.unmount();
  });

  it('omitting messages renders the untouched English default (behavior-preservation pin)', () => {
    const baseline = createPhlixApp({ app: 'server', apiBase: 'http://phlix.invalid' });
    const wrapper = mount(probeComponent(['common.retry']), {
      global: { provide: realProvides(baseline) },
    });
    expect(wrapper.find('[data-key="common.retry"]').text()).toBe('Retry');
    wrapper.unmount();
  });

  it('the shipped en catalog (empty override) renders byte-identical English', () => {
    const enApp = createPhlixApp({
      app: 'server',
      apiBase: 'http://phlix.invalid',
      messages: messagesForLocale(resolveLocale({ navigatorLanguage: 'en-US' })),
    });
    const wrapper = mount(probeComponent(['common.retry', 'common.close', 'player.play', 'shell.browse']), {
      global: { provide: realProvides(enApp) },
    });
    // ui defaults at resolved v0.99.6 — any drift here is a ui-side change, not
    // this wiring.
    expect(wrapper.find('[data-key="common.retry"]').text()).toBe('Retry');
    expect(wrapper.find('[data-key="common.close"]').text()).toBe('Close');
    expect(wrapper.find('[data-key="player.play"]').text()).toBe('Play');
    expect(wrapper.find('[data-key="shell.browse"]').text()).toBe('Browse');
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// 2. Merge semantics of the seam we wire (ui's own exported function)
// ---------------------------------------------------------------------------

describe('ui mergeMessages semantics the client catalog relies on', () => {
  it('overrides merge per group; keys not overridden fall back to DEFAULT_MESSAGES', () => {
    const merged = mergeMessages({ common: { retry: 'ZZZ-TEST' } });
    expect(merged.common.retry).toBe('ZZZ-TEST');
    expect(merged.common.close).toBe('Close');
  });

  it('an unknown top-level group is DROPPED (merge iterates only default groups)', () => {
    const bogus = { not_a_group: { anything: 'X' }, common: { retry: 'ZZZ-TEST' } } as unknown as PhlixMessagesConfig;
    const merged = mergeMessages(bogus);
    expect(merged).not.toHaveProperty('not_a_group');
    expect(merged.common.retry).toBe('ZZZ-TEST');
  });

  it('a null group override degrades to the English default instead of throwing', () => {
    const merged = mergeMessages({ common: null } as unknown as PhlixMessagesConfig);
    expect(merged.common.retry).toBe('Retry');
  });

  it('always returns a fresh object — never the DEFAULT_MESSAGES reference', () => {
    expect(mergeMessages()).not.toBe(mergeMessages());
  });
});

// ---------------------------------------------------------------------------
// 3. The client module itself: parsing, priority table, registry lookup
// ---------------------------------------------------------------------------

describe('normalizeLocaleTag', () => {
  it('parses BCP-47 tags to a lowercase primary subtag', () => {
    expect(normalizeLocaleTag('en-US')).toBe('en');
    expect(normalizeLocaleTag('ES_es')).toBe('es');
    expect(normalizeLocaleTag('  zh-Hans-CN ')).toBe('zh');
  });

  it('maps EVERY Portuguese signal to the one shipped pt catalog (pt_BR)', () => {
    // Region-aware exception to the primary-subtag rule (docblock in
    // src/i18n/index.ts): collapsing pt to bare 'pt' would drop the only key
    // the registry has, degrading every pt device to English.
    expect(normalizeLocaleTag('pt')).toBe('pt_BR');
    expect(normalizeLocaleTag('pt_BR')).toBe('pt_BR');
    expect(normalizeLocaleTag('PT_br')).toBe('pt_BR');
    expect(normalizeLocaleTag('pt-PT')).toBe('pt_BR'); // European pt sees Brazilian, not English
    expect(normalizeLocaleTag('pt-419')).toBe('pt_BR');
  });

  it('yields null for empty/whitespace/absent signals', () => {
    expect(normalizeLocaleTag('')).toBeNull();
    expect(normalizeLocaleTag('   ')).toBeNull();
    expect(normalizeLocaleTag(null)).toBeNull();
    expect(normalizeLocaleTag(undefined)).toBeNull();
  });
});

describe('isSupportedLocale', () => {
  it('accepts every registered locale and rejects the rest', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
    // Genuinely unsupported (post 6-locale build-out): raw subtags that never
    // key a catalog. 'pt' is deliberately rejected BEFORE normalization —
    // the registry key is the region tag 'pt_BR' (see normalizeLocaleTag).
    expect(isSupportedLocale('zz')).toBe(false);
    expect(isSupportedLocale('ko')).toBe(false);
    expect(isSupportedLocale('pt')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale('constructor')).toBe(false); // prototype keys never count
  });
});

describe('resolveLocale priority (explicit → env → navigator → fallback)', () => {
  it('explicit beats env and navigator', () => {
    expect(resolveLocale({ explicit: 'en', env: 'zz', navigatorLanguage: 'zz' })).toBe('en');
  });

  it('env beats navigator', () => {
    expect(resolveLocale({ env: 'en', navigatorLanguage: 'zz-ZZ' })).toBe('en');
  });

  it('navigator is used when no higher signal exists', () => {
    expect(resolveLocale({ env: null, navigatorLanguage: 'en-GB' })).toBe('en');
  });

  it('unsupported signals fall through to the fallback locale', () => {
    // Post 6-locale build-out the genuinely-unsupported probes carry the
    // original intent: es/fr/de ARE supported now (pinned by the matrix in
    // tests/unit/i18nLocales.test.ts), so zz/xx/kl prove the same walk.
    expect(resolveLocale({ explicit: 'zz', env: 'xx_YY', navigatorLanguage: 'kl-GL' })).toBe(FALLBACK_LOCALE);
  });

  it('a higher-priority UNSUPPORTED signal does not veto a lower supported one', () => {
    // 'zz' parses but has no catalog → the walk continues to the next signal.
    expect(resolveLocale({ explicit: 'zz-ZZ', env: null, navigatorLanguage: 'en_US' })).toBe('en');
  });

  it('a higher-priority SUPPORTED regional signal wins outright', () => {
    // Mirror pin of the law above, post build-out: 'es-ES' parses AND has a
    // catalog, so it resolves to 'es' without consulting lower signals.
    expect(resolveLocale({ explicit: 'es-ES', env: 'ja', navigatorLanguage: 'de' })).toBe('es');
  });

  it('reads VITE_PHLIX_LOCALE from the environment when no explicit slot is passed', () => {
    vi.stubEnv('VITE_PHLIX_LOCALE', 'en');
    expect(resolveLocale({ navigatorLanguage: 'de-DE' })).toBe('en');
  });

  it('an unsupported explicit signal falls through to a supported env value', () => {
    vi.stubEnv('VITE_PHLIX_LOCALE', 'en');
    // explicit 'zz' is junk; env 'en' is the next supported signal.
    expect(resolveLocale({ explicit: 'zz', navigatorLanguage: 'zz' })).toBe('en');
  });

  it('never returns anything outside SUPPORTED_LOCALES', () => {
    const probes = ['', '   ', 'x', 'en-Latn-US', 'EN', 'en_US', null, undefined] as const;
    for (const explicit of probes) {
      for (const env of probes) {
        for (const nav of probes) {
          const locale = resolveLocale({ explicit, env, navigatorLanguage: nav });
          expect(SUPPORTED_LOCALES).toContain(locale);
        }
      }
    }
  });
});

describe('messagesForLocale', () => {
  it('en resolves to an empty override (ui English defaults pass through untouched)', () => {
    expect(messagesForLocale('en')).toEqual({});
    expect(messagesForLocale('EN-US')).toEqual({});
  });

  it('unsupported/mistyped locales select the fallback catalog without throwing', () => {
    expect(messagesForLocale('klingon')).toEqual(messagesForLocale(FALLBACK_LOCALE));
    expect(messagesForLocale('')).toEqual(messagesForLocale(FALLBACK_LOCALE));
  });

  it('returns a fresh top-level object per call (registry constants are unshared)', () => {
    const a = messagesForLocale('en');
    const b = messagesForLocale('en');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('the result is a legal PhlixMessagesConfig for the ui seam (type-level pin)', () => {
    const cfg: PhlixMessagesConfig = messagesForLocale(resolveLocale({ navigatorLanguage: 'en-US' }));
    expect(cfg).toBeDefined();
  });
});
