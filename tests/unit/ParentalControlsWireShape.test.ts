import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ParentalControlsPage from '@/pages/ParentalControlsPage.vue';
import { clearTizenLocale, setTizenLocale } from '@/i18n/tizen';
import { ES_TIZEN_MESSAGES } from '@/i18n/tizen/locales/es';

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

/**
 * RT-054: the schedules GET payload is a per-case knob so one test can serve
 * a poison row beside a healthy one. beforeEach restores the healthy default.
 */
const HEALTHY_SCHEDULES: unknown[] = [SCHEDULE];
let schedulesPayload: unknown[] = HEALTHY_SCHEDULES;

/**
 * RT-099 (w13-L4): per-verb failure knobs. A rejected mutation must SURFACE
 * (role=alert notice) instead of vanishing into a silent catch; the knobs are
 * consumed once so one failing call cannot leak into the next.
 */
let failNext: { post?: boolean; delete?: boolean } = {};

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
        return { schedules: schedulesPayload } as T;
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
      if (failNext.post) { failNext.post = false; throw new Error('mock POST rejected'); }
      return {} as T;
    }

    async put<T = unknown>(url: string, body?: unknown): Promise<T> {
      apiCalls.push({ method: 'PUT', url, body });
      return {} as T;
    }

    async delete<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ method: 'DELETE', url });
      if (failNext.delete) { failNext.delete = false; throw new Error('mock DELETE rejected'); }
      return {} as T;
    }
  }
}));

describe('ParentalControlsPage wire shape (S325b)', () => {
  beforeEach(() => {
    apiCalls.length = 0;
    schedulesPayload = HEALTHY_SCHEDULES;
    failNext = {};
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

  // ── R1-F1: section headers ride the catalog, not bare literals ──────────

  it('section headers render from the catalog — Spanish mount shows the es values, not English', async () => {
    // The pre-fix defect: the two `h2.section__title` headings (Blocked Tags,
    // Stream Limits) were bare template literals while their sibling tabs at
    // the top of the page already resolved through tTizen. This is the REAL
    // render proof: mount the component with the own-catalog locale pinned to
    // es and read the headings back out of the DOM. (v-show keeps hidden tabs
    // mounted, so both headings are present whichever tab is active.)
    setTizenLocale('es');
    try {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();

      const tags = wrapper.get('h2#tab-tags').text();
      const limits = wrapper.get('h2#tab-limits').text();
      expect(tags).toBe(ES_TIZEN_MESSAGES.parentalControls.tabBlockedTags);
      expect(limits).toBe(ES_TIZEN_MESSAGES.parentalControls.tabStreamLimits);
      // And demonstrably NOT the old hardcoded English.
      expect(tags).not.toBe('Blocked Tags');
      expect(limits).not.toBe('Stream Limits');
    } finally {
      clearTizenLocale();
    }
  });

  // ── RT-053 (review tizen__exploiter #6) — the add/edit form is conditional ──

  it('RT-053: the schedule form is hidden at rest and opens only on Add or Edit', async () => {
    // Pre-cure the form's v-if carried a literal `|| true` (vestigial from the
    // scaffold), so the add/edit panel was ALWAYS rendered on first paint —
    // the "empty slate" the exploiter review flagged, and a focus-pollution
    // source on a D-pad device. The cure gates it on an explicit open intent.
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();
    expect(wrapper.find('#schedule-name').exists()).toBe(false);

    await wrapper.find('.section__action').trigger('click'); // + Add Schedule
    expect(wrapper.find('#schedule-name').exists()).toBe(true);

    await wrapper.find('.cancel-btn').trigger('click');
    expect(wrapper.find('#schedule-name').exists()).toBe(false);

    await wrapper.find('.action-btn').trigger('click'); // Edit the seeded row
    expect(wrapper.find('#schedule-name').exists()).toBe(true);
  });

  it('RT-053: saving a schedule closes the form (the terminal success path)', async () => {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();
    await wrapper.find('.section__action').trigger('click');
    await wrapper.find('#schedule-name').setValue('Closing window');
    await wrapper.find('.save-btn').trigger('click');
    await flushPromises();
    expect(wrapper.find('#schedule-name').exists()).toBe(false);
  });

  // ── RT-054 (review tizen__exploiter #5) — one poison row cannot blank the panel ──

  it('RT-054: a row with null times is dropped while its healthy sibling still renders', async () => {
    // The server DTO carries SQL NULL verbatim into an unset time column.
    // Pre-cure `formatTime(null)` threw inside the render — EVERY schedule,
    // every field, vanished with it (blank panel, no error surface).
    schedulesPayload = [
      SCHEDULE,
      { id: 8, profileId: 'prof-1', name: 'Broken', start_time: null, end_time: null, days_of_week: null, is_active: true },
    ];
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();

    const items = wrapper.findAll('.schedule-item');
    expect(items).toHaveLength(1);
    expect(items[0].find('.schedule-item__name').text()).toBe('Weekday window');
    expect(items[0].find('.schedule-item__time').text()).toContain('9:00');
  });
  // ---- RT-099 (w13-L4, tizen__exploiter#2): parental guards are not one-shot doors ----
  describe('RT-099 mutation guards', () => {
    it('a held ENTER on the tag field fires exactly ONE POST (keyup no longer bypasses the in-flight guard)', async () => {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();
      const input = wrapper.find('.tag-input');
      await input.setValue('noir-x');
      // TWO keyup.enter beats without letting the first POST settle — the era
      // this test reddens on had the guard ONLY on the button's :disabled, so
      // a held/rapid Enter minted a duplicate POST /profiles/{pid}/tags per
      // repeat and the server happily inserted N identical blocked tags.
      await input.trigger('keyup', { key: 'Enter' });
      await input.trigger('keyup', { key: 'Enter' });
      expect(apiCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/tags'))).toHaveLength(1);
      await flushPromises();
    });

    it('the in-flight gate lets exactly one POST per Enter burst through and releases for the next intent', async () => {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();
      const input = wrapper.find('.tag-input');
      await input.setValue('noir-y');
      await input.trigger('keyup', { key: 'Enter' });
      expect(wrapper.find('.add-tag-btn').attributes('disabled')).toBeDefined(); // mid-flight
      // A third intent while the first POST is still pending: guard holds.
      await input.trigger('keyup', { key: 'Enter' });
      expect(apiCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/tags'))).toHaveLength(1);
      await flushPromises();
      // The burst settled as ONE success. A fresh intent after the gate
      // released must POST again (the guard is per-flight, not per-session):
      // clearing the field re-disables the button (needs text), so setValue
      // first, and assert the SECOND POST lands — the observable half of the
      // re-render race this suite must not lose.
      await input.setValue('');
      await input.setValue('noir-z');
      await input.trigger('keyup', { key: 'Enter' });
      await flushPromises();
      expect(apiCalls.filter((c) => c.method === 'POST' && c.url.endsWith('/tags'))).toHaveLength(2);
    });

    it('a rejected schedule DELETE surfaces the localized notice, keeps the rows, and re-arms the button', async () => {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();
      expect(wrapper.find('.mutation-notice').exists()).toBe(false);
      failNext.delete = true;
      await wrapper.find('.schedule-item .action-btn--danger').trigger('click');
      await flushPromises();
      const notice = wrapper.find('.mutation-notice');
      expect(notice.exists()).toBe(true);
      expect(notice.attributes('role')).toBe('alert');
      expect(notice.text()).toBe('That schedule could not be deleted — try again.');
      expect(wrapper.findAll('.schedule-item')).toHaveLength(1); // healthy rows NOT blanked
      expect(wrapper.find('.schedule-item .action-btn--danger').attributes('disabled')).toBeUndefined();
      expect(apiCalls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    });

    it('a rejected tag POST surfaces the localized notice and preserves what the user typed', async () => {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();
      const input = wrapper.find('.tag-input');
      await input.setValue('noir-z');
      failNext.post = true;
      await input.trigger('keyup', { key: 'Enter' });
      await flushPromises();
      const notice = wrapper.find('.mutation-notice');
      expect(notice.exists()).toBe(true);
      expect(notice.text()).toBe('The blocked-tag change could not be saved — try again.');
      expect((input.element as HTMLInputElement).value).toBe('noir-z');
    });

    it('a later successful mutation clears a previous failure notice', async () => {
      const wrapper = mount(ParentalControlsPage);
      await flushPromises();
      failNext.delete = true;
      await wrapper.find('.schedule-item .action-btn--danger').trigger('click');
      await flushPromises();
      expect(wrapper.find('.mutation-notice').exists()).toBe(true);
      await wrapper.find('.schedule-item .action-btn--danger').trigger('click'); // retry succeeds
      await flushPromises();
      expect(wrapper.find('.mutation-notice').exists()).toBe(false);
    });
  });
});
