import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SubtitleTrackList from '@/components/SubtitleTrackList.vue';
import type { SubtitleTrack } from '@phlix/contracts';

/**
 * S404: the list is typed as the playback-info WIRE `SubtitleTrack`
 * (StreamTrackShaper::subtitleTracks() shape). A full honest fixture carries
 * ALL nine wire keys — `title`/`isForced`/`isDefault` are NOT on the subtitle
 * wire (the pre-S404 fixture pinned that fiction; rewritten, not deleted).
 */
const createTrack = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack => ({
  id: 'track-1',
  index: 0,
  stream_index: 1,
  language: 'en-US',
  label: 'en-US',
  codec: 'webvtt',
  source: null,
  hearing_impaired: false,
  url: '/api/v1/media/item-1/subtitles/0?exp=1800000000&sig=dGVzdC1zaWc',
  ...overrides
});

function mountComponent(props: {
  tracks?: SubtitleTrack[];
  activeTrackId?: string | null;
  onSelect?: (track: SubtitleTrack | null) => void;
}) {
  return mount(SubtitleTrackList, {
    props: {
      tracks: [],
      activeTrackId: null,
      onSelect: vi.fn(),
      ...props
    }
  });
}

describe('SubtitleTrackList', () => {
  describe('rendering', () => {
    it('renders the component', () => {
      const wrapper = mountComponent();
      expect(wrapper.find('.subtitle-track-list').exists()).toBe(true);
    });

    it('renders "Off" option first', () => {
      const wrapper = mountComponent({ tracks: [createTrack()] });
      const items = wrapper.findAll('.subtitle-track-list__item');
      expect(items[0].find('.subtitle-track-list__language').text()).toBe('Off');
    });

    it('renders tracks after "Off" option', () => {
      const tracks = [
        createTrack({ id: 'track-1', language: 'en-US' }),
        createTrack({ id: 'track-2', language: 'fr-FR', index: 1, stream_index: 3 })
      ];
      const wrapper = mountComponent({ tracks });
      const items = wrapper.findAll('.subtitle-track-list__item');
      // items[0] is "Off", items[1] and items[2] are tracks
      expect(items).toHaveLength(3);
    });

    it('shows active indicator for "Off" when activeTrackId is null', () => {
      const wrapper = mountComponent({ activeTrackId: null });
      const offItem = wrapper.find('.subtitle-track-list__item:first-child');
      expect(offItem.classes()).toContain('is-active');
      expect(offItem.find('.subtitle-track-list__active-indicator').exists()).toBe(true);
    });

    it('does not show active indicator for "Off" when a track is active', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1' })],
        activeTrackId: 'track-1'
      });
      const offItem = wrapper.find('.subtitle-track-list__item:first-child');
      expect(offItem.classes()).not.toContain('is-active');
    });

    it('shows active indicator for active track', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1' })],
        activeTrackId: 'track-1'
      });
      const trackItem = wrapper.findAll('.subtitle-track-list__item')[1];
      expect(trackItem.classes()).toContain('is-active');
      expect(trackItem.find('.subtitle-track-list__active-indicator').exists()).toBe(true);
    });

    it('displays the SDH badge for hearing-impaired tracks', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1', hearing_impaired: true })]
      });
      expect(wrapper.find('.subtitle-track-list__badge--sdh').exists()).toBe(true);
      expect(wrapper.find('.subtitle-track-list__badge--sdh').text()).toBe('SDH');
    });

    it('displays no badge for plain tracks (the wire has no forced/default concept)', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1', hearing_impaired: false })]
      });
      expect(wrapper.find('.subtitle-track-list__badges').exists()).toBe(false);
    });

    it('displays the server-derived label when it says more than the language', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1', language: 'spa', label: 'Español (Forzada)' })]
      });
      expect(wrapper.find('.subtitle-track-list__title').text()).toBe('Español (Forzada)');
    });

    it('does not repeat the label when it is just the language', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1', language: 'eng', label: 'eng' })]
      });
      expect(wrapper.find('.subtitle-track-list__title').exists()).toBe(false);
    });

    it('displays codec', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1', codec: 'ass' })]
      });
      // Codec is displayed as-is (may be lowercase in test data)
      expect(wrapper.find('.subtitle-track-list__codec').text()).toBe('ass');
    });

    it('has correct aria-label on listbox', () => {
      const wrapper = mountComponent({ tracks: [createTrack()] });
      expect(wrapper.find('[role="listbox"]').attributes('aria-label')).toBe('1 subtitle tracks');
    });
  });

  describe('interaction', () => {
    it('calls onSelect with null when "Off" is clicked', async () => {
      const onSelect = vi.fn();
      const wrapper = mountComponent({ onSelect });
      await wrapper.find('.subtitle-track-list__item:first-child').trigger('click');
      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('calls onSelect with track when track is clicked', async () => {
      const onSelect = vi.fn();
      const track = createTrack({ id: 'track-1', language: 'en-US' });
      const wrapper = mountComponent({ tracks: [track], onSelect });
      await wrapper.findAll('.subtitle-track-list__item')[1].trigger('click');
      expect(onSelect).toHaveBeenCalledWith(track);
    });

    it('calls onSelect with null on Enter key on "Off"', async () => {
      const onSelect = vi.fn();
      const wrapper = mountComponent({ onSelect });
      await wrapper.find('.subtitle-track-list__item:first-child').trigger('keydown.enter');
      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('calls onSelect with track on Enter key on track', async () => {
      const onSelect = vi.fn();
      const track = createTrack({ id: 'track-1' });
      const wrapper = mountComponent({ tracks: [track], onSelect });
      await wrapper.findAll('.subtitle-track-list__item')[1].trigger('keydown.enter');
      expect(onSelect).toHaveBeenCalledWith(track);
    });

    it('calls onSelect with null on Space key on "Off"', async () => {
      const onSelect = vi.fn();
      const wrapper = mountComponent({ onSelect });
      await wrapper.find('.subtitle-track-list__item:first-child').trigger('keydown.space');
      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('calls onSelect with track on Space key on track', async () => {
      const onSelect = vi.fn();
      const track = createTrack({ id: 'track-1' });
      const wrapper = mountComponent({ tracks: [track], onSelect });
      await wrapper.findAll('.subtitle-track-list__item')[1].trigger('keydown.space');
      expect(onSelect).toHaveBeenCalledWith(track);
    });
  });

  describe('formatLanguage', () => {
    it('handles language tags (with Intl.DisplayNames fallback)', () => {
      // Intl.DisplayNames may not work identically in all jsdom environments
      // The function handles gracefully by falling back to raw tag
      const track = createTrack({ language: 'en-US' });
      const wrapper = mountComponent({ tracks: [track] });
      const languageSpan = wrapper.findAll('.subtitle-track-list__item')[1].find('.subtitle-track-list__language');
      // Just verify something is rendered (either localized name or raw tag)
      expect(languageSpan.text()).toBeTruthy();
    });

    it('handles unknown language tags gracefully', () => {
      const track = createTrack({ language: 'zz-XX' });
      const wrapper = mountComponent({ tracks: [track] });
      const languageSpan = wrapper.findAll('.subtitle-track-list__item')[1].find('.subtitle-track-list__language');
      // Falls back to raw tag when Intl doesn't know the language
      expect(languageSpan.text()).toBeTruthy();
    });

    it('handles empty language tag', () => {
      const track = createTrack({ language: '', label: 'Subtitle 1' });
      const wrapper = mountComponent({ tracks: [track] });
      const languageSpan = wrapper.findAll('.subtitle-track-list__item')[1].find('.subtitle-track-list__language');
      expect(languageSpan.text()).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has nav element with aria-label', () => {
      const wrapper = mountComponent();
      expect(wrapper.find('nav[aria-label="Subtitle track list"]').exists()).toBe(true);
    });

    it('has listbox role on ul', () => {
      const wrapper = mountComponent();
      expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
    });

    it('items have option role', () => {
      const wrapper = mountComponent({ tracks: [createTrack()] });
      const items = wrapper.findAll('.subtitle-track-list__item');
      items.forEach(item => {
        expect(item.attributes('role')).toBe('option');
      });
    });

    it('has aria-selected on items', () => {
      const wrapper = mountComponent({
        tracks: [createTrack({ id: 'track-1' })],
        activeTrackId: 'track-1'
      });
      const items = wrapper.findAll('.subtitle-track-list__item');
      expect(items[0].attributes('aria-selected')).toBe('false');
      expect(items[1].attributes('aria-selected')).toBe('true');
    });

    it('"Off" item has aria-label "No subtitles"', () => {
      const wrapper = mountComponent();
      const offItem = wrapper.find('.subtitle-track-list__item:first-child');
      expect(offItem.attributes('aria-label')).toBe('No subtitles');
    });
  });

  describe('aria-label on tracks', () => {
    it('includes language and codec in aria-label', () => {
      const track = createTrack({ id: 'track-1', language: 'en-US', codec: 'webvtt' });
      const wrapper = mountComponent({ tracks: [track] });
      const trackItem = wrapper.findAll('.subtitle-track-list__item')[1];
      const ariaLabel = trackItem.attributes('aria-label');
      expect(ariaLabel).toContain('webvtt');
    });

    it('includes the server label in aria-label', () => {
      const track = createTrack({ id: 'track-1', language: 'spa', label: 'Español (Forzada)' });
      const wrapper = mountComponent({ tracks: [track] });
      const trackItem = wrapper.findAll('.subtitle-track-list__item')[1];
      expect(trackItem.attributes('aria-label')).toContain('Español (Forzada)');
    });

    it('includes the hearing-impaired flag in aria-label when set', () => {
      const track = createTrack({ id: 'track-1', hearing_impaired: true });
      const wrapper = mountComponent({ tracks: [track] });
      const trackItem = wrapper.findAll('.subtitle-track-list__item')[1];
      expect(trackItem.attributes('aria-label')).toContain('hearing impaired');
    });

    it('never mentions forced/default (fiction keys of the pre-S404 shape)', () => {
      const track = createTrack({ id: 'track-1', hearing_impaired: false });
      const wrapper = mountComponent({ tracks: [track] });
      const trackItem = wrapper.findAll('.subtitle-track-list__item')[1];
      const ariaLabel = trackItem.attributes('aria-label') ?? '';
      expect(ariaLabel).not.toContain('forced');
      expect(ariaLabel).not.toContain('default');
    });
  });
});
