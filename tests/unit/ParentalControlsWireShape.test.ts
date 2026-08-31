import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ParentalControlsPage from '@/pages/ParentalControlsPage.vue';

/**
 * S325b — the tizen parental-controls page must read and write the WIRE
 * keys the server actually emits (snake_case), the shape @phlix/contracts
 * v0.4.4 finally declares.
 *
 * The page previously compiled against v0.4.3, whose camelCase
 * declaration was a LIE about the wire: `schedule.startTime`,
 * `schedule.isActive` and `t.tagType` read `undefined` at runtime against
 * the server's real `start_time` / `is_active` / `tag_type` emission
 * (`AccessSchedule::toArray()` / `ProfileTag::toArray()` on phlix-server).
 * Blank times, a never-showing Inactive badge, and an always-empty blocked-
 * tags list were the user-visible symptoms. This file pins the corrected
 * reads — and the canonical POST body spelling — so a future re-widening
 * reddens HERE instead of shipping undefined onto a TV.
 */

const SCHEDULE = {
  id: 7,
  profileId: 'prof-1',
  name: 'Weekday window',
  start_time: '09:00',
  end_time: '17:00',
  days_of_week: ['mon'],
  is_active: false
};

const TAGS = [
  { id: 1, profileId: 'prof-1', tag: 'noir', tag_type: 'blocked' },
  { id: 2, profileId: 'prof-1', tag: 'family', tag_type: 'allowed' }
];

const apiCalls: { url: string; body?: unknown }[] = [];

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() })
}));

vi.mock('@phlix/ui', () => ({
  useApiBase: () => ({ value: 'http://server.test' }),
  useAuthStore: () => ({ user: { profileId: 'prof-1' } }),
  ApiClient: class {
    async get<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ url });
      if (url.endsWith('/schedules')) {
        return { schedules: [SCHEDULE] } as T;
      }
      if (url.endsWith('/tags')) {
        return { tags: TAGS } as T;
      }
      if (url.endsWith('/stream-limits')) {
        return { max_streams: 2 } as T;
      }
      throw new Error('unexpected GET ' + url);
    }

    async post<T = unknown>(url: string, body?: unknown): Promise<T> {
      apiCalls.push({ url, body });
      return {} as T;
    }

    async delete<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ url });
      return {} as T;
    }
  }
}));

describe('ParentalControlsPage wire shape (S325b)', () => {
  beforeEach(() => {
    apiCalls.length = 0;
  });

  it('renders the server snake_case schedule fields instead of blanks', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    const time = wrapper.find('.schedule-item__time');
    expect(time.exists()).toBe(true);
    // Pre-fix these were formatTime(undefined)/formatDays(undefined) — the
    // rendered line carried none of the real values. formatTime renders a
    // 12-hour label ('9:00 AM'), so assert the formatted halves.
    expect(time.text()).toContain('9:00');
    expect(time.text()).toContain('5:00');
    expect(wrapper.find('.schedule-item__days').text()).toContain('Mon');

    // is_active:false must show the Inactive badge — with the camel read the
    // flag was undefined and the badge could never render.
    expect(wrapper.find('.schedule-item__badge').exists()).toBe(true);
  });

  it('filters blocked tags on the wire key tag_type', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    const items = wrapper.findAll('.tag-item');
    expect(items).toHaveLength(1);
    expect(items[0].find('.tag-item__label').text()).toBe('noir');
  });

  it('creates tags with the canonical tag_type spelling (not the S234 camelCase defect)', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    await wrapper.find('input.tag-input').setValue('crime');
    await wrapper.find('button.add-tag-btn').trigger('click');
    await flushPromises();

    const post = apiCalls.find(c => c.url.endsWith('/tags') && c.body !== undefined);
    expect(post).toBeTruthy();
    expect(post!.body).toEqual({ tag: 'crime', tag_type: 'blocked' });
  });
});
