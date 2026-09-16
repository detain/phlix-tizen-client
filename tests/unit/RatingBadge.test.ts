import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RatingBadge from '@/components/RatingBadge.vue';

/**
 * S501 T-11 — RatingBadge carried zero coverage (never imported by any suite)
 * while dead overlays held the best numbers. These are pragmatic render/label
 * pins for the pure score→star mask, not a gold-plated matrix.
 */

function starCounts(wrapper: ReturnType<typeof mount>) {
  return {
    full: wrapper.findAll('.star--full').length,
    half: wrapper.findAll('.star--half').length,
    empty: wrapper.findAll('.star--empty').length,
  };
}

describe('RatingBadge', () => {
  it('renders five full stars and the numerical label for a perfect score', () => {
    const wrapper = mount(RatingBadge, { props: { score: 10 } });

    expect(starCounts(wrapper)).toEqual({ full: 5, half: 0, empty: 0 });
    expect(wrapper.find('.score-label').text()).toBe('10.0 / 10');
    expect(wrapper.attributes('aria-label')).toBe('Rating: 10 out of 10');
  });

  it('shows half-star precision — 7.5 → three full, one half, one empty', () => {
    const wrapper = mount(RatingBadge, { props: { score: 7.5 } });

    expect(starCounts(wrapper)).toEqual({ full: 3, half: 1, empty: 1 });
    expect(wrapper.find('.score-label').text()).toBe('7.5 / 10');
  });

  it('rounds a whole-ish 9 down to four full + one half (score / 2 fill)', () => {
    const wrapper = mount(RatingBadge, { props: { score: 9 } });

    expect(starCounts(wrapper)).toEqual({ full: 4, half: 1, empty: 0 });
    expect(wrapper.find('.score-label').text()).toBe('9.0 / 10');
  });

  it('renders all empty stars for a zero score but still prints the label', () => {
    const wrapper = mount(RatingBadge, { props: { score: 0 } });

    expect(starCounts(wrapper)).toEqual({ full: 0, half: 0, empty: 5 });
    expect(wrapper.find('.score-label').text()).toBe('0.0 / 10');
  });

  it('renders an em-dash and an "unrated" aria-label for a null score', () => {
    const wrapper = mount(RatingBadge, { props: { score: null } });

    expect(starCounts(wrapper)).toEqual({ full: 0, half: 0, empty: 5 });
    expect(wrapper.find('.score-label').text()).toBe('—');
    expect(wrapper.attributes('aria-label')).toBe('Rating: unrated out of 10');
  });

  it('is a labelled image for assistive tech', () => {
    const wrapper = mount(RatingBadge, { props: { score: 5 } });

    expect(wrapper.find('.rating-badge').attributes('role')).toBe('img');
    // The decorative star row itself is hidden from AT (aria carries the value).
    expect(wrapper.find('.stars').attributes('aria-hidden')).toBe('true');
  });
});
