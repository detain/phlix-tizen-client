import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RatingModal from '@/components/RatingModal.vue';

// S501 T-11 — the media-detail rating modal. Teleport is stubbed so the dialog
// renders inline under jsdom, and UserRatingPicker is stubbed (it has its own
// suite) so we can drive the child→parent event contract directly.
function mountModal(props: Partial<{ itemId: string; aggregateScore: number | null; visible: boolean }> = {}) {
  return mount(RatingModal, {
    props: {
      itemId: 'm1',
      aggregateScore: 8,
      visible: true,
      ...props,
    },
    global: {
      stubs: { Teleport: true, UserRatingPicker: true },
    },
  });
}

describe('RatingModal', () => {
  it('renders the dialog with header, aggregate badge and picker when visible', () => {
    const wrapper = mountModal();

    expect(wrapper.find('.rating-modal-overlay').exists()).toBe(true);
    expect(wrapper.find('.modal-title').text()).toBe('Rate This Title');
    // Aggregate badge renders for real; the picker is stubbed but present.
    expect(wrapper.find('.rating-badge').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'UserRatingPicker' }).exists()).toBe(true);
  });

  it('renders nothing when not visible', () => {
    const wrapper = mountModal({ visible: false });

    expect(wrapper.find('.rating-modal-overlay').exists()).toBe(false);
  });

  it('emits close from the explicit close button', async () => {
    const wrapper = mountModal();

    await wrapper.find('.close-btn').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits close on a backdrop click (the inner dialog stops propagation)', async () => {
    const wrapper = mountModal();

    await wrapper.find('.rating-modal-overlay').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits close on Escape while visible', () => {
    const wrapper = mountModal();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('relays a child rating change up as score-changed', async () => {
    const wrapper = mountModal();

    wrapper.findComponent({ name: 'UserRatingPicker' }).vm.$emit('rating-changed', 8);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('score-changed')).toEqual([[8]]);
  });
});
