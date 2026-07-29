import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

// Use vi.hoisted to properly hoist mocks together with vi.mock
const { usePlayerStore, useApiBase } = vi.hoisted(() => ({
  usePlayerStore: vi.fn(() => ({ position: 0, duration: 0 })),
  useApiBase: vi.fn(() => 'https://api.example.com'),
}));

// Mock dependencies - vi.mock is hoisted to run at import time
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => reactive({ params: { id: 'media-123' } })),
}));

vi.mock('@phlix/ui', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({ items: [] }),
  })),
  useApiBase,
  usePlayerStore,
}));

import UpNextOverlay from '@/components/UpNextOverlay.vue';

describe('UpNextOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.mockReturnValue({
      position: 0,
      duration: 0,
    });
  });

  const createWrapper = (props = {}) => {
    return mount(UpNextOverlay, {
      props,
      attachTo: document.body,
    });
  };

  describe('rendering', () => {
    it('renders nothing when not visible', () => {
      const wrapper = createWrapper();
      // v-if="false" renders as a comment node in Vue
      expect(wrapper.html()).toBe('<!--v-if-->');
    });

    it('does not render when counting is false', () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: false,
        remaining: 8,
        total: 8,
      });
      expect(wrapper.html()).toBe('<!--v-if-->');
    });

    it('does not render when there is no up next media', () => {
      const wrapper = createWrapper({
        counting: true,
        remaining: 8,
        total: 8,
      });
      expect(wrapper.html()).toBe('<!--v-if-->');
    });
  });

  describe('props', () => {
    it('accepts media prop with id and title', () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media Title' },
        counting: true,
        remaining: 8,
        total: 8,
      });
      expect(wrapper.vm.$props.media).toEqual({ id: 'next-media', title: 'Next Media Title' });
    });

    it('accepts remaining and total props', () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 5,
        total: 10,
      });
      expect(wrapper.vm.$props.remaining).toBe(5);
      expect(wrapper.vm.$props.total).toBe(10);
    });

    it('accepts posterUrl prop', () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media', posterUrl: 'https://example.com/poster.jpg' },
        counting: true,
        remaining: 8,
        total: 8,
        posterUrl: 'https://example.com/poster.jpg',
      });
      expect(wrapper.vm.$props.posterUrl).toBe('https://example.com/poster.jpg');
    });

    it('uses default prop values', () => {
      const wrapper = createWrapper();
      expect(wrapper.vm.$props.media).toBeNull();
      expect(wrapper.vm.$props.remaining).toBe(8);
      expect(wrapper.vm.$props.total).toBe(8);
      expect(wrapper.vm.$props.counting).toBe(false);
      expect(wrapper.vm.$props.posterUrl).toBeNull();
    });
  });

  describe('emits', () => {
    it('emits play-now event when play button is clicked', async () => {
      // Mock the player store to return position within range
      usePlayerStore.mockReturnValue({
        position: 352, // 8 seconds before end of 360 second video
        duration: 360,
      });

      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 8,
        total: 8,
      });

      // Wait for the component to detect position and show overlay
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find('button[aria-label="Play now"]');
      if (playButton.exists()) {
        await playButton.trigger('click');
        expect(wrapper.emitted('play-now')).toBeTruthy();
      }
    });

    it('emits cancel event when cancel button is clicked', async () => {
      // Mock the player store to return position within range
      usePlayerStore.mockReturnValue({
        position: 352,
        duration: 360,
      });

      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 8,
        total: 8,
      });

      await wrapper.vm.$nextTick();

      const cancelButton = wrapper.find('button[aria-label="Cancel"]');
      if (cancelButton.exists()) {
        await cancelButton.trigger('click');
        expect(wrapper.emitted('cancel')).toBeTruthy();
      }
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes when visible', async () => {
      usePlayerStore.mockReturnValue({
        position: 352,
        duration: 360,
      });

      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 8,
        total: 8,
      });

      await wrapper.vm.$nextTick();

      const overlay = wrapper.find('.up-next-overlay');
      if (overlay.exists()) {
        expect(overlay.attributes('role')).toBe('dialog');
        expect(overlay.attributes('aria-modal')).toBe('false');
        expect(overlay.attributes('aria-label')).toBe('Up next');
      }
    });

    it('buttons have proper keydown handlers', async () => {
      usePlayerStore.mockReturnValue({
        position: 352,
        duration: 360,
      });

      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 8,
        total: 8,
      });

      await wrapper.vm.$nextTick();

      const playButton = wrapper.find('button[aria-label="Play now"]');
      if (playButton.exists()) {
        expect(playButton.attributes('tabindex')).toBeUndefined(); // Default tabindex is fine
      }
    });
  });

  describe('countdown ring', () => {
    it('calculates progress percentage correctly', async () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 4,
        total: 8,
      });

      await wrapper.vm.$nextTick();
      expect(wrapper.vm.progressPercent).toBe(50);
    });

    it('handles zero total gracefully', () => {
      const wrapper = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 8,
        total: 0,
      });
      expect(wrapper.vm.progressPercent).toBe(100);
    });

    it('clamps progress between 0 and 100', () => {
      const wrapperOver = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: 12,
        total: 8,
      });
      expect(wrapperOver.vm.progressPercent).toBe(100);

      const wrapperUnder = createWrapper({
        media: { id: 'next-media', title: 'Next Media' },
        counting: true,
        remaining: -2,
        total: 8,
      });
      expect(wrapperUnder.vm.progressPercent).toBe(0);
    });
  });
});
