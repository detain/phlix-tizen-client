/**
 * RT-052 (review tizen__casualgamer #4) — the recommendations error state
 * must lead with the catalog copy, never with a raw exception message.
 *
 * Pre-cure the catch arm did `e instanceof Error ? e.message : tTizen(...)`,
 * i.e. the TRANSPORT name (axios-style "Network Error", stack-flavored text)
 * replaced the localized headline whenever the throw carried one — the exact
 * inverted priority that made a TV show English wire-speak where the catalog
 * promised localized copy (and where the vendored 7-locale table already
 * ships the right sentence). The cure keeps the headline pinned to
 * `recommendations.failed` across all locales and moves the raw message to a
 * subordinate detail line, so the diagnostic survives for support without
 * evicting the translated copy.
 *
 * The screen has no @phlix/ui or router seam that can mount without fakes, so
 * the module graph is mocked exactly like ParentalControlsWireShape.test.ts
 * (forward-importActual keeps the real i18n string exports genuine); the
 * fetcher is driven to fail two ways — an Error-carrying throw and a bare
 * string throw — which is the whole behavioral contract of the catch arm.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import RecommendationsScreen from '@/screens/RecommendationsScreen.vue';
import { TIZEN_EN } from '@/i18n/tizen/locales/en';

/** What the NEXT constructed ApiClient's get() will do (set per case). */
const behavior: { rejectWith: unknown } = { rejectWith: new Error('Network Error') };

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
  useApiBase: () => ({ value: 'http://server.test' }),
  useMediaApiBase: () => ({ value: 'http://server.test' }),
  ApiClient: class {
    async get<T = unknown>(): Promise<T> {
      throw behavior.rejectWith;
    }
  },
}));

describe('RecommendationsScreen — RT-052 error-copy priority', () => {
  it('an Error-carrying failure shows the catalog headline, not the raw message', async () => {
    behavior.rejectWith = new Error('Network Error');
    const wrapper = mount(RecommendationsScreen, { global: { plugins: [createPinia()] } });
    await flushPromises();

    const headline = wrapper.find('.recommendations-screen__error p');
    expect(headline.exists()).toBe(true);
    // Pre-cure this node carried the transport's 'Network Error' verbatim.
    expect(headline.text()).toBe(TIZEN_EN.recommendations.failed);

    // The raw message survives as a subordinate diagnostic line — useful to
    // support, never as the localized surface copy.
    const detail = wrapper.find('.recommendations-screen__error-detail');
    expect(detail.exists()).toBe(true);
    expect(detail.text()).toBe('Network Error');
  });

  it('a non-Error throw keeps the catalog headline and shows NO detail line', async () => {
    behavior.rejectWith = 'bare string refusal';
    const wrapper = mount(RecommendationsScreen, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(wrapper.find('.recommendations-screen__error p').text()).toBe(
      TIZEN_EN.recommendations.failed,
    );
    // Nothing Error-shaped was thrown — inventing a detail line would print
    // 'null'; the headline is the whole story for this arm.
    expect(wrapper.find('.recommendations-screen__error-detail').exists()).toBe(false);
  });
});
