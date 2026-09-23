import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// S501 T-11 — interactive rating input. `@phlix/ui`'s auth + toast stores are the
// only external surface; mock them the way every other SFC suite in this repo does.
const mocks = vi.hoisted(() => ({
  setRating: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these two must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
  useAuthStore: () => ({ client: { setRating: mocks.setRating } }),
  useToastStore: () => ({ error: mocks.error }),
}));

import UserRatingPicker from '@/components/UserRatingPicker.vue';

function fullCount(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.star-btn--full').length;
}

describe('UserRatingPicker', () => {
  beforeEach(() => {
    mocks.setRating.mockReset().mockResolvedValue(undefined);
    mocks.error.mockReset();
  });

  it('renders the current rating as filled stars and a numeric label', () => {
    const wrapper = mount(UserRatingPicker, {
      props: { mediaId: 'm1', userRating: 8 },
    });

    // 8 / 10 → round(8 / 2) = 4 active stars.
    expect(fullCount(wrapper)).toBe(4);
    expect(wrapper.findAll('.star-btn')).toHaveLength(5);
    expect(wrapper.find('.rating-value').text()).toBe('8 / 10');
  });

  it('shows the "Not rated" state for a null rating', () => {
    const wrapper = mount(UserRatingPicker, {
      props: { mediaId: 'm1', userRating: null },
    });

    expect(fullCount(wrapper)).toBe(0);
    expect(wrapper.find('.rating-value--unset').exists()).toBe(true);
    expect(wrapper.find('.rating-value--unset').text()).toBe('Not rated');
  });

  it('submits a new rating on click and emits rating-changed', async () => {
    const wrapper = mount(UserRatingPicker, {
      props: { mediaId: 'm1', userRating: 8 },
    });

    // Third star (1-indexed starIdx 3) → 3 * 2 = 6, different from current 8.
    await wrapper.findAll('.star-btn').at(2)!.trigger('click');
    await flushPromises();

    expect(mocks.setRating).toHaveBeenCalledWith('m1', 6);
    expect(wrapper.emitted('rating-changed')).toEqual([[6]]);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('toggles the same star off (clears the rating) rather than re-setting it', async () => {
    const wrapper = mount(UserRatingPicker, {
      props: { mediaId: 'm1', userRating: 8 },
    });

    // Fourth star → 4 * 2 = 8 === current → clears to null.
    await wrapper.findAll('.star-btn').at(3)!.trigger('click');
    await flushPromises();

    expect(mocks.setRating).toHaveBeenCalledWith('m1', null);
    expect(wrapper.emitted('rating-changed')).toEqual([[null]]);
  });

  it('surfaces a toast and emits nothing when the save fails', async () => {
    mocks.setRating.mockRejectedValueOnce(new Error('offline'));
    const wrapper = mount(UserRatingPicker, {
      props: { mediaId: 'm1', userRating: null },
    });

    await wrapper.findAll('.star-btn').at(1)!.trigger('click');
    await flushPromises();

    expect(mocks.setRating).toHaveBeenCalledWith('m1', 4);
    expect(wrapper.emitted('rating-changed')).toBeUndefined();
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(String(mocks.error.mock.calls[0]![0])).toContain('Failed to save rating');
  });
});
