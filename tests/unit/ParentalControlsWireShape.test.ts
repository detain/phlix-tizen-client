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
 *
 * S502 (T-08/T-16) — the write half of the same wire truth. The mock below
 * records the HTTP VERB of every call (the old shape recorded url+body only,
 * which is exactly why an edit that POSTed to the create route — duplicating
 * a row server-side, because `createForProfile` always INSERTs and never
 * reads an id — could still pass). The edit path is now pinned to
 * `PUT /api/v1/profiles/{pid}/schedules/{scheduleId}` with a snake_case body
 * (`updateSchedule` reads only `name`/`start_time`/`end_time`/`days_of_week`/
 * `is_active` — camelCase there is a 400), and the create path is pinned to
 * stay `POST` to the collection.
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

/** S502: verb-recording capture — `{ method, url, body? }`, not just `{ url, body? }`. */
const apiCalls: { method: string; url: string; body?: unknown }[] = [];

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() })
}));

vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these two must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
  useApiBase: () => ({ value: 'http://server.test' }),
  useAuthStore: () => ({ user: { profileId: 'prof-1' } }),
  ApiClient: class {
    async get<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ method: 'GET', url });
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
      apiCalls.push({ method: 'POST', url, body });
      return {} as T;
    }

    async put<T = unknown>(url: string, body?: unknown): Promise<T> {
      apiCalls.push({ method: 'PUT', url, body });
      return {} as T;
    }

    async delete<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ method: 'DELETE', url });
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

    const post = apiCalls.find(c => c.method === 'POST' && c.url.endsWith('/tags'));
    expect(post).toBeTruthy();
    expect(post!.body).toEqual({ tag: 'crime', tag_type: 'blocked' });
  });

  // ── S502: schedule write verbs ───────────────────────────────────────────

  it('creates a schedule with POST to the collection — never a PUT (S502 AC1)', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    await wrapper.find('.section__action').trigger('click'); // + Add Schedule
    await wrapper.find('#schedule-name').setValue('Weekend window');
    await wrapper.findAll('.day-btn')[0].trigger('click'); // toggle Mon
    await wrapper.find('.save-btn').trigger('click');
    await flushPromises();

    const writes = apiCalls.filter(c => c.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('POST');
    expect(writes[0].url).toBe('/api/v1/profiles/prof-1/schedules');
    expect(writes[0].body).toEqual({
      name: 'Weekend window',
      start_time: '08:00:00',
      end_time: '22:00:00',
      days_of_week: ['mon'],
      is_active: true
    });
  });

  it('edits a schedule with PUT /schedules/{id} + snake_case body (S502 AC1)', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    await wrapper.find('.action-btn').trigger('click'); // Edit → startEditSchedule(SCHEDULE)
    await wrapper.find('.save-btn').trigger('click');
    await flushPromises();

    // The verb+URL+body tuple is pinned whole: the id must ride in the PATH
    // (server reads it from {scheduleId}), never in the body.
    const writes = apiCalls.filter(c => c.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect({ ...writes[0], url: writes[0].url }).toEqual({
      method: 'PUT',
      url: '/api/v1/profiles/prof-1/schedules/7',
      body: {
        name: 'Weekday window',
        start_time: '09:00',
        end_time: '17:00',
        days_of_week: ['mon'],
        is_active: false
      }
    });
  });

  it('tripwire: a regressed edit→POST (the T-08 duplicate-row defect) reddens here (S502 AC2)', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    await wrapper.find('.action-btn').trigger('click'); // edit the seeded SCHEDULE (id 7)
    await wrapper.find('.save-btn').trigger('click');
    await flushPromises();

    // If saveSchedule() ever reverts to the create route for edits, BOTH of
    // these redden: the create POST would duplicate a row server-side
    // (createForProfile always INSERTs; it never upserts an id from the body).
    expect(apiCalls.some(c => c.method === 'POST' && c.url.endsWith('/schedules'))).toBe(false);
    expect(apiCalls.some(c => c.method === 'PUT' && c.url === '/api/v1/profiles/prof-1/schedules/7')).toBe(true);
  });
});
