/**
 * ParentalControlsTimeStepper.test — m3 (deferred review, 2026-11-03).
 *
 * The schedule window used to be two native `<input type="time">` fields:
 * segment-editing text controls that a no-pointer, no-IME TV webview can
 * focus but never operate. The page now renders symbol stepper buttons
 * around an AM/PM readout. Three layers of law live here:
 *
 *   1. the PURE arithmetic (src/parentalTimeStepper.ts): quarter/hour steps,
 *      24-hour wrap in both directions, seconds-suffix shape preservation,
 *      and the pinned degradation of invalid stored times;
 *   2. the MOUNT law: a +15 press lands '08:15:00' in the POST body — the
 *      S325b/S502 wire-shape discipline extended through the stepper, which
 *      writes back into the very fields saveSchedule sends raw;
 *   3. the SOURCE law: no time input comes back, and the new buttons join
 *      the host 5px focus-ring family (docs/runtime-floor.md item 6).
 *
 * Mock shape is lifted from ParentalControlsWireShape.test.ts on purpose —
 * same verb-recording ApiClient, same fixtures — so the two files read as
 * one wire story.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flushPromises, mount } from '@vue/test-utils';
import ParentalControlsPage from '@/pages/ParentalControlsPage.vue';
import { stepTime, stepNumber, STEP_BANDWIDTH_KBPS } from '@/parentalTimeStepper';

const SCHEDULE = {
  id: 7,
  profileId: 'prof-1',
  name: 'Weekday window',
  start_time: '09:00',
  end_time: '17:00',
  days_of_week: ['mon'],
  is_active: false
};

const apiCalls: { method: string; url: string; body?: unknown }[] = [];

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() })
}));

vi.mock('@phlix/ui', async () => ({
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
        return { tags: [] } as T;
      }
      if (url.endsWith('/stream-limits')) {
        // v0.5.7 wire truth: the DTO rides the `{ stream_limits }` envelope
        // (server StreamLimitController; contracts StreamSession docblock).
        return {
          stream_limits: {
            profile_id: 'prof-1',
            max_concurrent_streams: 2,
            max_total_bandwidth_kbps: null
          }
        } as T;
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

describe('stepTime — the pure schedule-window arithmetic', () => {
  it('steps by quarters and hours on the HH:MM:SS default shape', () => {
    expect(stepTime('08:00:00', 15)).toBe('08:15:00');
    expect(stepTime('08:00:00', 60)).toBe('09:00:00');
    expect(stepTime('08:00:00', -15)).toBe('07:45:00');
  });

  it('preserves the seconds segment ONLY when the source had one', () => {
    expect(stepTime('09:00', 60)).toBe('10:00');
    expect(stepTime('09:00', 15)).toBe('09:15');
    expect(stepTime('08:00:30', 15)).toBe('08:15:30'); // untouched suffix
  });

  it('wraps the 24-hour clock in both directions', () => {
    expect(stepTime('23:30', 60)).toBe('00:30');
    expect(stepTime('23:45:00', 15)).toBe('00:00:00');
    expect(stepTime('00:30:00', -60)).toBe('23:30:00');
    expect(stepTime('00:00', -15)).toBe('23:45');
  });

  it('degrades unparsable or out-of-range times to stepping from midnight (pinned, never thrown)', () => {
    expect(stepTime('garbage', 15)).toBe('00:15');
    expect(stepTime('', 15)).toBe('00:15');
    expect(stepTime('24:60', 60)).toBe('01:00');
    // A matched suffix still survives the degradation — shape law first.
    expect(stepTime('99:99:59', 15)).toBe('00:15:59');
  });
});

describe('ParentalControlsPage schedule steppers — D-pad operation reaches the wire', () => {
  beforeEach(() => {
    apiCalls.length = 0;
  });

  /** Button order inside one group: -60, -15, +15, +60. */
  async function mountWithForm() {
    const wrapper = mount(ParentalControlsPage);
    await flushPromises();
    await wrapper.find('.section__action').trigger('click'); // + Add Schedule
    await flushPromises();
    return wrapper;
  }

  it('the form opens with readouts (not time inputs) on the 08:00/22:00 defaults', async () => {
    const wrapper = await mountWithForm();
    const readouts = wrapper.findAll('.time-stepper__value');
    expect(readouts).toHaveLength(2);
    expect(readouts[0].text()).toBe('8:00 AM');
    expect(readouts[1].text()).toBe('10:00 PM');
    expect(wrapper.find('input[type="time"]').exists()).toBe(false);
  });

  it('start +15 then save POSTs start_time 08:15:00 — seconds shape preserved on the wire', async () => {
    const wrapper = await mountWithForm();
    const startGroup = wrapper.findAll('.time-stepper')[0];
    await startGroup.findAll('button')[2].trigger('click'); // +15
    expect(wrapper.findAll('.time-stepper__value')[0].text()).toBe('8:15 AM');

    await wrapper.find('#schedule-name').setValue('Weekend window');
    await wrapper.findAll('.day-btn')[0].trigger('click'); // Mon
    await wrapper.find('.save-btn').trigger('click');
    await flushPromises();

    const post = apiCalls.find((c) => c.method === 'POST' && c.url.endsWith('/schedules'));
    expect(post).toBeTruthy();
    expect(post!.body).toEqual({
      name: 'Weekend window',
      start_time: '08:15:00',
      end_time: '22:00:00',
      days_of_week: ['mon'],
      is_active: true
    });
  });

  it('end -60 walks the other field only', async () => {
    const wrapper = await mountWithForm();
    const endGroup = wrapper.findAll('.time-stepper')[1];
    await endGroup.findAll('button')[0].trigger('click'); // -60
    expect(wrapper.findAll('.time-stepper__value')[0].text()).toBe('8:00 AM');
    expect(wrapper.findAll('.time-stepper__value')[1].text()).toBe('9:00 PM');
  });

  it('wraps 00:15 back to 23:45 purely on-screen — no negative hours reach the form', async () => {
    const wrapper = await mountWithForm();
    const startGroup = wrapper.findAll('.time-stepper')[0];
    // 08:00:00 minus eight hour-steps → 00:00:00, then one quarter back.
    for (let i = 0; i < 8; i += 1) {
      await startGroup.findAll('button')[0].trigger('click');
    }
    await startGroup.findAll('button')[1].trigger('click'); // -15
    expect(wrapper.findAll('.time-stepper__value')[0].text()).toBe('11:45 PM');
  });
});

describe('m3 source laws', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '../../src/pages/ParentalControlsPage.vue'), 'utf8');

  it('no native time input and no orphaned input ids come back', () => {
    expect(source).not.toMatch(/type="time"/);
    expect(source).not.toMatch(/schedule-start|schedule-end/);
  });

  it('the stepper buttons joined the host 5px focus-ring family', () => {
    expect(source).toMatch(
      /\.stepper-btn:focus-visible\s*\{\s*outline:\s*none;\s*box-shadow:\s*0 0 0 5px var\(--accent-ring/
    );
  });
});

// ---- RT-103 (w13-L4, gameux#4): the number sibling of the m3 stepper ----
// The limits form used to ship native type=number fields: pointer-only
// spinner arrows on a no-pointer panel. The page now wraps each field in
// symbol buttons driven by stepNumber — the same parse-don't-validate
// posture as stepTime: garbage input degrades to the field's own floor
// instead of poisoning the form.
describe('stepNumber (RT-103 pure arithmetic)', () => {
  it('steps a finite value by the delta inside the range', () => {
    expect(stepNumber(5, 1, 1, 10)).toBe(6);
    expect(stepNumber(5, -1, 1, 10)).toBe(4);
    expect(stepNumber(5000, STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(6000);
    expect(stepNumber(5000, -STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(4000);
  });

  it('clamps at both rails instead of wrapping or overshooting', () => {
    expect(stepNumber(10, 1, 1, 10)).toBe(10);
    expect(stepNumber(1, -1, 1, 10)).toBe(1);
    expect(stepNumber(0, -STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(0);
  });

  it('treats 0 (unlimited bandwidth) as the floor it is: stepping down stays unlimited', () => {
    expect(stepNumber(0, -STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(0);
    expect(stepNumber(0, STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(1000);
  });

  it('degrades null / undefined / non-finite to the field floor PLUS the delta', () => {
    expect(stepNumber(null, STEP_BANDWIDTH_KBPS, 0, 1_000_000)).toBe(1000);
    expect(stepNumber(undefined, 1, 1, 10)).toBe(2);
    expect(stepNumber(NaN, 1, 1, 10)).toBe(2);
    expect(stepNumber(Infinity, -1, 1, 10)).toBe(1); // garbage = floor, then the step
  });

  it('passes fractions through untouched by rounding (typing stays the precise path)', () => {
    expect(stepNumber(2.5, 1, 1, 10)).toBe(3.5);
  });
});
