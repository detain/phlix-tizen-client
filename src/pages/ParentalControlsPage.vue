<script setup lang="ts">
/**
 * ParentalControlsPage — Manage access schedules, tag blocking, and stream limits.
 *
 * Provides TV-friendly D-pad navigation for parental control settings.
 * Integrates with the server's profile-scoped endpoints:
 *   GET/POST/PUT/DELETE /api/v1/profiles/{id}/schedules
 *   GET/POST/DELETE /api/v1/profiles/{id}/tags
 *   GET/PUT    /api/v1/profiles/{id}/stream-limits
 *
 * Route: /app/parental-controls  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase } from '@phlix/ui';
import { useAuthStore, type AuthUser } from '@phlix/ui';
import { tTizen, type TizenMessageKey } from '../i18n/tizen';
import { stepTime, stepNumber, STEP_QUARTER_MINUTES, STEP_HOUR_MINUTES, STEP_BANDWIDTH_KBPS } from '../parentalTimeStepper';
import { normalizeScheduleRows } from '../parentalScheduleRows';
import type {
  AccessSchedule,
  DayOfWeek,
  ProfileTag,
  ProfileStreamLimit
} from '@phlix/contracts';

const router = useRouter();
const apiBase = useApiBase();
const authStore = useAuthStore();

// The sealed AuthUser type does not declare profileId (unknown value space);
// the runtime shape from the login response is number|string. Narrow it here
// so the URL builders (M-TIZEN-28 seg()) receive a typed segment, never `{}`.
const profileId = computed<string | number>(() => {
  const raw = (authStore.user as AuthUser)?.profileId;
  return typeof raw === 'string' || typeof raw === 'number' ? raw : 0;
});

/**
 * M-TIZEN-28 (review tizen__exploiter): path-segment encoding at the URL
 * boundary. `profileId` arrives from the LOGIN RESPONSE and schedule/tag ids
 * from the server's list rows — all server-controlled strings. A crafted id
 * carrying `/` or `?` would re-point the authenticated request (carrying the
 * bearer token) at a DIFFERENT endpoint (`profiles/2%2F..%2Fother` stays one
 * segment; a raw `/` would not). encodeURI-Component is a no-op for the real
 * vocabulary (integers and UUIDs), so this is pure boundary hygiene — and it
 * makes the safe shape the only shape this page can write.
 */
function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

// ── State ──────────────────────────────────────────────────────────────────

const activeTab = ref<'schedules' | 'tags' | 'limits'>('schedules');

const schedules = ref<AccessSchedule[]>([]);
const blockedTags = ref<ProfileTag[]>([]);
const streamLimit = ref<ProfileStreamLimit | null>(null);

const loadingSchedules = ref(false);
const loadingTags = ref(false);
const loadingLimits = ref(false);

const errorSchedules = ref<string | null>(null);
const errorTags = ref<string | null>(null);
const errorLimits = ref<string | null>(null);

/**
 * w13: RT-099 (review tizen__exploiter #2) — inline mutation disclosures.
 * The section-level `errorX` panels REPLACE the whole list (load-failure
 * shape); a rejected add/remove/delete must not blank healthy rows, so each
 * mutation failure lands in one of these refs instead and renders as a small
 * role="alert" note inside the list branch. Cleared at the start of every new
 * mutation attempt (a retry, or any later press, resets the slate).
 */
const scheduleMutationError = ref<string | null>(null);
const tagMutationError = ref<string | null>(null);

/**
 * w13: RT-099 — per-row in-flight bookkeeping for the two DELETE paths. A Set
 * because the page can hold several rows and each id is independently busy;
 * the mirrored :disabled keeps the press that would double-fire visibly dead
 * (the guard inside the handler is the actual law — this is its shadow).
 */
const deletingScheduleIds = ref(new Set<number>());
const removingTagIds = ref(new Set<number>());

function scheduleDeleting(id: number): boolean {
  return deletingScheduleIds.value.has(id);
}

function tagRemoving(id: number): boolean {
  return removingTagIds.value.has(id);
}

// ── Schedule editing ───────────────────────────────────────────────────────

const editingSchedule = ref<AccessSchedule | null>(null);
/**
 * RT-053 (review tizen__exploiter #6): explicit open-intent flag for the
 * add/edit panel. The form's v-if carried a literal `|| true` from the
 * scaffold era, so the condition was constant-true and the editor rendered on
 * every first paint — hidden focus targets on a D-pad device and a misleading
 * "already editing" slate. The flag now opens on Add/Edit, closes on cancel
 * and on a successful save (the arms editingSchedule alone could not drive:
 * create keeps the id null while still being an open form).
 */
const scheduleFormOpen = ref(false);
const scheduleForm = ref({
  name: '',
  startTime: '08:00:00',
  endTime: '22:00:00',
  daysOfWeek: [] as DayOfWeek[],
  isActive: true
});
const savingSchedule = ref(false);

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: tTizen('days.mon'), value: 'mon' },
  { label: tTizen('days.tue'), value: 'tue' },
  { label: tTizen('days.wed'), value: 'wed' },
  { label: tTizen('days.thu'), value: 'thu' },
  { label: tTizen('days.fri'), value: 'fri' },
  { label: tTizen('days.sat'), value: 'sat' },
  { label: tTizen('days.sun'), value: 'sun' }
];

function startCreateSchedule(): void {
  editingSchedule.value = null;
  scheduleFormOpen.value = true;
  scheduleForm.value = {
    name: '',
    startTime: '08:00:00',
    endTime: '22:00:00',
    daysOfWeek: [],
    isActive: true
  };
}

function startEditSchedule(schedule: AccessSchedule): void {
  editingSchedule.value = schedule;
  scheduleFormOpen.value = true;
  scheduleForm.value = {
    name: schedule.name,
    // S325b: the server emits snake_case on the wire (AccessSchedule::toArray);
    // @phlix/contracts v0.4.4 declares those field names — v0.4.3's camelCase
    // declaration was the lie that let these reads compile as `undefined`.
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    daysOfWeek: [...schedule.days_of_week],
    isActive: schedule.is_active
  };
}

function cancelEditSchedule(): void {
  editingSchedule.value = null;
  scheduleFormOpen.value = false;
}

function toggleDay(day: DayOfWeek): void {
  const idx = scheduleForm.value.daysOfWeek.indexOf(day);
  if (idx >= 0) {
    scheduleForm.value.daysOfWeek.splice(idx, 1);
  } else {
    scheduleForm.value.daysOfWeek.push(day);
  }
}

async function saveSchedule(): Promise<void> {
  const pid = profileId.value;
  if (!pid) return;

  savingSchedule.value = true;
  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    if (editingSchedule.value) {
      // S502: an edit is an update, not a second create. The POST collection
      // route (AccessScheduleController::createForProfile) always INSERTs via
      // createSchedule and never reads an id from the body — the pre-S502
      // POST-with-id shipped a duplicate row on every save. PUT
      // /schedules/{scheduleId} (updateSchedule) is the matching verb; its id
      // travels in the URL, and it reads ONLY the snake_case keys below
      // (camelCase would arrive as "No valid fields to update" → 400).
      await client.put(
        `/api/v1/profiles/${seg(pid)}/schedules/${seg(editingSchedule.value.id)}`,
        {
          name: scheduleForm.value.name,
          start_time: scheduleForm.value.startTime,
          end_time: scheduleForm.value.endTime,
          days_of_week: scheduleForm.value.daysOfWeek,
          is_active: scheduleForm.value.isActive
        }
      );
    } else {
      await client.post(`/api/v1/profiles/${seg(pid)}/schedules`, {
        name: scheduleForm.value.name,
        start_time: scheduleForm.value.startTime,
        end_time: scheduleForm.value.endTime,
        days_of_week: scheduleForm.value.daysOfWeek,
        is_active: scheduleForm.value.isActive
      });
    }
    editingSchedule.value = null;
    scheduleFormOpen.value = false;
    await loadSchedules();
  } catch (_e) {
    // Keep editing open on error
  } finally {
    savingSchedule.value = false;
  }
}

async function deleteSchedule(scheduleId: number): Promise<void> {
  const pid = profileId.value;
  if (!pid) return;

  // w13: RT-099 — early exit while this row's delete is still in flight:
  // every press used to fire its own DELETE plus a full reload, and a held
  // remote key turned one intent into a request storm against one row.
  if (deletingScheduleIds.value.has(scheduleId)) return;
  deletingScheduleIds.value.add(scheduleId);
  scheduleMutationError.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.delete(`/api/v1/profiles/${seg(pid)}/schedules/${seg(scheduleId)}`);
    await loadSchedules();
  } catch {
    // w13: RT-099 — disclose, never pretend: the old bare catch let a rejected
    // DELETE look like a success until the reload proved otherwise (or didn't).
    scheduleMutationError.value = tTizen('parentalControls.scheduleDeleteFailed');
  } finally {
    deletingScheduleIds.value.delete(scheduleId);
  }
}

// ── Tag management ──────────────────────────────────────────────────────────

const newTagInput = ref('');
const addingTag = ref(false);

async function addTag(): Promise<void> {
  const tag = newTagInput.value.trim();
  if (!tag) return;

  const pid = profileId.value;
  if (!pid) return;

  // w13: RT-099 — the button's :disabled(addingTag) was never a guard: the
  // input's @keyup.enter called addTag directly, bypassing it, so a held
  // ENTER key fired one POST /profiles/{pid}/tags per repeat. The guard now
  // lives in the handler itself — every entry path obeys it.
  if (addingTag.value) return;
  addingTag.value = true;
  tagMutationError.value = null;
  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.post(`/api/v1/profiles/${seg(pid)}/tags`, {
      tag,
      // S325b: canonical spelling — the server's key. `tagType` was the S234
      // defect shape, kept alive only by the server's additive acceptance.
      tag_type: 'blocked'
    });
    newTagInput.value = '';
    await loadTags();
  } catch {
    // w13: RT-099 — disclose the rejection; the typed text survives so a
    // second press costs the viewer nothing they did not already type.
    tagMutationError.value = tTizen('parentalControls.tagMutationFailed');
  } finally {
    addingTag.value = false;
  }
}

async function removeTag(tagId: number): Promise<void> {
  const pid = profileId.value;
  if (!pid) return;

  // w13: RT-099 — per-row in-flight guard, mirroring deleteSchedule above.
  if (removingTagIds.value.has(tagId)) return;
  removingTagIds.value.add(tagId);
  tagMutationError.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.delete(`/api/v1/profiles/${seg(pid)}/tags/${seg(tagId)}`);
    await loadTags();
  } catch {
    // w13: RT-099 — disclose, never pretend.
    tagMutationError.value = tTizen('parentalControls.tagMutationFailed');
  } finally {
    removingTagIds.value.delete(tagId);
  }
}

// ── Stream limits ───────────────────────────────────────────────────────────

const limitForm = ref({
  maxConcurrentStreams: 1,
  maxTotalBandwidthKbps: null as number | null
});
const savingLimit = ref(false);
const editingLimit = ref(false);

function startEditLimit(): void {
  editingLimit.value = true;
  limitForm.value = {
    maxConcurrentStreams: streamLimit.value?.maxConcurrentStreams ?? 1,
    maxTotalBandwidthKbps: streamLimit.value?.maxTotalBandwidthKbps ?? null
  };
}

function cancelEditLimit(): void {
  editingLimit.value = false;
}

async function saveLimit(): Promise<void> {
  const pid = profileId.value;
  if (!pid) return;

  savingLimit.value = true;
  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.put(`/api/v1/profiles/${seg(pid)}/stream-limits`, {
      maxConcurrentStreams: limitForm.value.maxConcurrentStreams,
      maxTotalBandwidthKbps: limitForm.value.maxTotalBandwidthKbps
    });
    editingLimit.value = false;
    await loadStreamLimit();
  } catch {
    // Keep editing open
  } finally {
    savingLimit.value = false;
  }
}

// ── Data loading ────────────────────────────────────────────────────────────

async function loadSchedules(): Promise<void> {
  const pid = profileId.value;
  if (!pid) {
    errorSchedules.value = tTizen('parentalControls.noProfileSelected');
    return;
  }

  loadingSchedules.value = true;
  errorSchedules.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    // RT-054 (review tizen__exploiter #5): the list is PARSED, not cast. The
    // DTO carries SQL NULL verbatim into unset columns, and the old blind
    // `data.schedules ?? []` cast let a null time crash formatTime() inside
    // the v-for — blanking every healthy row with it. normalizeScheduleRows
    // (src/parentalScheduleRows.ts) drops only the poison rows.
    const data = await client.get<{ schedules: unknown }>(
      `/api/v1/profiles/${seg(pid)}/schedules`
    );
    schedules.value = normalizeScheduleRows(data.schedules);
  } catch (e) {
    errorSchedules.value = e instanceof Error ? e.message : tTizen('parentalControls.failedSchedules');
    schedules.value = [];
  } finally {
    loadingSchedules.value = false;
  }
}

async function loadTags(): Promise<void> {
  const pid = profileId.value;
  if (!pid) {
    errorTags.value = tTizen('parentalControls.noProfileSelected');
    return;
  }

  loadingTags.value = true;
  errorTags.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<{ tags: ProfileTag[] }>(
      `/api/v1/profiles/${seg(pid)}/tags`
    );
    blockedTags.value = (data.tags ?? []).filter(t => t.tag_type === 'blocked');
  } catch (e) {
    errorTags.value = e instanceof Error ? e.message : tTizen('parentalControls.failedTags');
    blockedTags.value = [];
  } finally {
    loadingTags.value = false;
  }
}

async function loadStreamLimit(): Promise<void> {
  const pid = profileId.value;
  if (!pid) {
    errorLimits.value = tTizen('parentalControls.noProfileSelected');
    return;
  }

  loadingLimits.value = true;
  errorLimits.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<ProfileStreamLimit>(
      `/api/v1/profiles/${seg(pid)}/stream-limits`
    );
    streamLimit.value = data;
  } catch (e) {
    errorLimits.value = e instanceof Error ? e.message : tTizen('parentalControls.failedStreamLimits');
    streamLimit.value = null;
  } finally {
    loadingLimits.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([loadSchedules(), loadTags(), loadStreamLimit()]);
}

// ── Navigation ──────────────────────────────────────────────────────────────

function goBack(): void {
  void router.back();
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? tTizen('parentalControls.timePm') : tTizen('parentalControls.timeAm');
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

/**
 * m3 (deferred review, 2026-11-03): the schedule form's two native
 * time-input fields were pointer-era controls on a no-pointer device —
 * focusable by D-pad, unusable past that. They are replaced by symbol
 * stepper buttons around an AM/PM readout; stepping writes back into
 * THE SAME scheduleForm fields saveSchedule sends raw, so every S325b/S502
 * wire-shape pin keeps its byte-for-byte meaning. (The m3 source law at the
 * bottom of tests/unit/ParentalControlsTimeStepper.test.ts greps this file —
 * keep the quoted attribute spelling out of comments here.)
 */
function stepScheduleTime(field: 'startTime' | 'endTime', deltaMinutes: number): void {
  scheduleForm.value = {
    ...scheduleForm.value,
    [field]: stepTime(scheduleForm.value[field], deltaMinutes)
  };
}

/**
 * w13: RT-103 (deferred review m3's number sibling): the stream-limit fields
 * were bare `type="number"` inputs — their only step affordance was the
 * pointer wheel/spinner arrows a TV remote cannot produce. These handlers drive
 * the new symbol buttons; the inputs STAY (typing a precise value is still the
 * fastest path when a keyboard is available), and the buttons round-trip
 * through the same v-model fields saveLimit sends raw, so the S502 PUT wire
 * shape is untouched. Streams step ±1 inside its 1..10 admission; bandwidth
 * steps ±1000 kbps (its display rung) from 0, where 0 keeps meaning
 * "unlimited" — pressing − on unlimited lands on 0, which already reads as
 * unlimited, and + starts a finite cap.
 */
function stepStreams(delta: number): void {
  limitForm.value = {
    ...limitForm.value,
    maxConcurrentStreams: stepNumber(limitForm.value.maxConcurrentStreams, delta, 1, 10)
  };
}

function stepBandwidth(delta: number): void {
  limitForm.value = {
    ...limitForm.value,
    maxTotalBandwidthKbps: stepNumber(limitForm.value.maxTotalBandwidthKbps, delta, 0, Number.MAX_SAFE_INTEGER)
  };
}

function formatDays(days: DayOfWeek[]): string {
  if (days.length === 0) return tTizen('parentalControls.noDaysSet');
  if (days.length === 7) return tTizen('parentalControls.everyDay');
  const dayLabels: Record<DayOfWeek, TizenMessageKey> = {
    mon: 'days.mon', tue: 'days.tue', wed: 'days.wed', thu: 'days.thu', fri: 'days.fri', sat: 'days.sat', sun: 'days.sun'
  };
  return days.map(d => tTizen(dayLabels[d])).join(', ');
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(loadAll);
</script>

<template>
  <div class="parental-controls">
    <header class="parental-controls__header">
      <button
        class="parental-controls__back"
        type="button"
        :aria-label="tTizen('common.goBack')"
        @click="goBack"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="parental-controls__title">
        {{ tTizen('parentalControls.title') }}
      </h1>
    </header>

    <nav
      class="parental-controls__tabs"
      role="tablist"
      :aria-label="tTizen('parentalControls.sectionsAria')"
    >
      <button
        role="tab"
        :aria-selected="activeTab === 'schedules'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'schedules' }]"
        @click="activeTab = 'schedules'"
      >
        {{ tTizen('parentalControls.tabSchedules') }}
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'tags'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'tags' }]"
        @click="activeTab = 'tags'"
      >
        {{ tTizen('parentalControls.tabBlockedTags') }}
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'limits'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'limits' }]"
        @click="activeTab = 'limits'"
      >
        {{ tTizen('parentalControls.tabStreamLimits') }}
      </button>
    </nav>

    <!-- ── Schedules ──────────────────────────────────────────────────────── -->
    <section
      v-show="activeTab === 'schedules'"
      role="tabpanel"
      aria-labelledby="tab-schedules"
      class="parental-controls__section"
    >
      <div class="section__header">
        <h2
          id="tab-schedules"
          class="section__title"
        >
          {{ tTizen('parentalControls.accessSchedules') }}
        </h2>
        <button
          v-if="!editingSchedule"
          type="button"
          class="section__action"
          @click="startCreateSchedule"
        >
          {{ tTizen('parentalControls.addSchedule') }}
        </button>
      </div>

      <div
        v-if="loadingSchedules"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <div class="tv-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
        <p>{{ tTizen('parentalControls.loadingSchedules') }}</p>
      </div>

      <div
        v-else-if="errorSchedules"
        class="section__error"
        role="alert"
      >
        <p>{{ errorSchedules }}</p>
        <button
          type="button"
          class="retry-btn"
          @click="loadSchedules"
        >
          {{ tTizen('common.retry') }}
        </button>
      </div>

      <div
        v-else-if="schedules.length === 0"
        class="section__empty"
      >
        <p>{{ tTizen('parentalControls.noSchedules') }}</p>
      </div>

      <ul
        v-else
        class="schedule-list"
        role="list"
      >
        <li
          v-for="schedule in schedules"
          :key="schedule.id"
          class="schedule-item"
          :class="{ 'schedule-item--inactive': !schedule.is_active }"
        >
          <div class="schedule-item__info">
            <span class="schedule-item__name">{{ schedule.name }}</span>
            <span class="schedule-item__time">{{ formatTime(schedule.start_time) }} – {{ formatTime(schedule.end_time) }}</span>
            <span class="schedule-item__days">{{ formatDays(schedule.days_of_week) }}</span>
            <span
              v-if="!schedule.is_active"
              class="schedule-item__badge"
            >{{ tTizen('common.inactive') }}</span>
          </div>
          <div class="schedule-item__actions">
            <button
              type="button"
              class="action-btn"
              @click="startEditSchedule(schedule)"
            >
              {{ tTizen('common.edit') }}
            </button>
            <button
              type="button"
              class="action-btn action-btn--danger"
              :disabled="scheduleDeleting(schedule.id)"
              @click="deleteSchedule(schedule.id)"
            >
              {{ tTizen('common.delete') }}
            </button>
          </div>
        </li>
      </ul>

      <!-- w13: RT-099 — the rejected DELETE says so, next to the rows it
           failed against (the section-level error panel above is the LOAD
           failure surface; a mutation failure must not blank healthy rows). -->
      <p
        v-if="scheduleMutationError"
        class="mutation-notice"
        role="alert"
      >
        {{ scheduleMutationError }}
      </p>

      <!-- Schedule Form -->
      <div
        v-if="scheduleFormOpen"
        class="schedule-form"
      >
        <h3 class="form__title">
          {{ editingSchedule ? tTizen('parentalControls.editScheduleTitle') : tTizen('parentalControls.newScheduleTitle') }}
        </h3>

        <div class="form__field">
          <label
            class="form__label"
            for="schedule-name"
          >{{ tTizen('common.name') }}</label>
          <input
            id="schedule-name"
            v-model="scheduleForm.name"
            type="text"
            class="form__input"
            :placeholder="tTizen('parentalControls.namePlaceholder')"
          >
        </div>

        <div class="form__row">
          <!-- m3: D-pad steppers replace the native time inputs (see the
               stepScheduleTime docblock). The group's aria-label carries the
               field name now that no label-for input exists. -->
          <div class="form__field">
            <label class="form__label">{{ tTizen('parentalControls.startTime') }}</label>
            <div
              class="time-stepper"
              role="group"
              :aria-label="tTizen('parentalControls.startTime')"
            >
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('startTime', -STEP_HOUR_MINUTES)"
              >
                {{ tTizen('parentalControls.stepMinusHour') }}
              </button>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('startTime', -STEP_QUARTER_MINUTES)"
              >
                {{ tTizen('parentalControls.stepMinusQuarter') }}
              </button>
              <span class="time-stepper__value">{{ formatTime(scheduleForm.startTime) }}</span>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('startTime', STEP_QUARTER_MINUTES)"
              >
                {{ tTizen('parentalControls.stepPlusQuarter') }}
              </button>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('startTime', STEP_HOUR_MINUTES)"
              >
                {{ tTizen('parentalControls.stepPlusHour') }}
              </button>
            </div>
          </div>
          <div class="form__field">
            <label class="form__label">{{ tTizen('parentalControls.endTime') }}</label>
            <div
              class="time-stepper"
              role="group"
              :aria-label="tTizen('parentalControls.endTime')"
            >
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('endTime', -STEP_HOUR_MINUTES)"
              >
                {{ tTizen('parentalControls.stepMinusHour') }}
              </button>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('endTime', -STEP_QUARTER_MINUTES)"
              >
                {{ tTizen('parentalControls.stepMinusQuarter') }}
              </button>
              <span class="time-stepper__value">{{ formatTime(scheduleForm.endTime) }}</span>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('endTime', STEP_QUARTER_MINUTES)"
              >
                {{ tTizen('parentalControls.stepPlusQuarter') }}
              </button>
              <button
                type="button"
                class="stepper-btn"
                :disabled="savingSchedule"
                @click="stepScheduleTime('endTime', STEP_HOUR_MINUTES)"
              >
                {{ tTizen('parentalControls.stepPlusHour') }}
              </button>
            </div>
          </div>
        </div>

        <div class="form__field">
          <label class="form__label">{{ tTizen('parentalControls.daysOfWeek') }}</label>
          <div class="day-picker">
            <button
              v-for="day in DAYS"
              :key="day.value"
              type="button"
              :class="['day-btn', { 'day-btn--selected': scheduleForm.daysOfWeek.includes(day.value) }]"
              @click="toggleDay(day.value)"
            >
              {{ day.label }}
            </button>
          </div>
        </div>

        <div class="form__field form__field--row">
          <span class="form__label">{{ tTizen('common.active') }}</span>
          <!--
            w13: RT-103 (review tizen__gameux #4): this was a 1.25rem native
            checkbox with no focus-ring rule — a 30px tick unreadable at TV
            distance whose focus law (docs/runtime-floor.md governance item 6)
            the stylesheet never joined. It is now a D-pad toggle pill on the
            day-btn pattern: role=switch carries state for AT, the word IS the
            state for the eye, and the 5px ring is never in question.
          -->
          <button
            type="button"
            role="switch"
            class="toggle-pill"
            :class="{ 'toggle-pill--on': scheduleForm.isActive }"
            :aria-checked="scheduleForm.isActive ? 'true' : 'false'"
            @click="scheduleForm.isActive = !scheduleForm.isActive"
          >
            {{ scheduleForm.isActive ? tTizen('common.active') : tTizen('common.inactive') }}
          </button>
        </div>

        <div class="form__actions">
          <button
            type="button"
            class="cancel-btn"
            @click="cancelEditSchedule"
          >
            {{ tTizen('common.cancel') }}
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="savingSchedule || !scheduleForm.name"
            @click="saveSchedule"
          >
            {{ savingSchedule ? tTizen('common.saving') : tTizen('common.save') }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Tags ─────────────────────────────────────────────────────────── -->
    <section
      v-show="activeTab === 'tags'"
      role="tabpanel"
      aria-labelledby="tab-tags"
      class="parental-controls__section"
    >
      <div class="section__header">
        <h2
          id="tab-tags"
          class="section__title"
        >
          {{ tTizen('parentalControls.tabBlockedTags') }}
        </h2>
      </div>

      <p class="section__desc">
        {{ tTizen('parentalControls.blockedTagsHint') }}
      </p>

      <div
        v-if="loadingTags"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <div class="tv-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
        <p>{{ tTizen('parentalControls.loadingTags') }}</p>
      </div>

      <div
        v-else-if="errorTags"
        class="section__error"
        role="alert"
      >
        <p>{{ errorTags }}</p>
        <button
          type="button"
          class="retry-btn"
          @click="loadTags"
        >
          {{ tTizen('common.retry') }}
        </button>
      </div>

      <div v-else>
        <p
          v-if="tagMutationError"
          class="mutation-notice"
          role="alert"
        >
          {{ tagMutationError }}
        </p>
        <div class="tag-add">
          <input
            v-model="newTagInput"
            type="text"
            class="tag-input"
            :placeholder="tTizen('parentalControls.tagPlaceholder')"
            @keyup.enter="addTag"
          >
          <button
            type="button"
            class="add-tag-btn"
            :disabled="addingTag || !newTagInput.trim()"
            @click="addTag"
          >
            {{ addingTag ? tTizen('common.adding') : tTizen('common.add') }}
          </button>
        </div>

        <ul
          v-if="blockedTags.length"
          class="tag-list"
          role="list"
        >
          <li
            v-for="tag in blockedTags"
            :key="tag.id"
            class="tag-item"
          >
            <span class="tag-item__label">{{ tag.tag }}</span>
            <button
              type="button"
              class="tag-item__remove"
              :aria-label="tTizen('parentalControls.removeTagAria')"
              :disabled="tagRemoving(tag.id)"
              @click="removeTag(tag.id)"
            >
              ×
            </button>
          </li>
        </ul>
        <p
          v-else
          class="section__empty"
        >
          {{ tTizen('parentalControls.noBlockedTags') }}
        </p>
      </div>
    </section>

    <!-- ── Stream Limits ────────────────────────────────────────────────── -->
    <section
      v-show="activeTab === 'limits'"
      role="tabpanel"
      aria-labelledby="tab-limits"
      class="parental-controls__section"
    >
      <div class="section__header">
        <h2
          id="tab-limits"
          class="section__title"
        >
          {{ tTizen('parentalControls.tabStreamLimits') }}
        </h2>
      </div>

      <div
        v-if="loadingLimits"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <div class="tv-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
        <p>{{ tTizen('parentalControls.loadingLimits') }}</p>
      </div>

      <div
        v-else-if="errorLimits"
        class="section__error"
        role="alert"
      >
        <p>{{ errorLimits }}</p>
        <button
          type="button"
          class="retry-btn"
          @click="loadStreamLimit"
        >
          {{ tTizen('common.retry') }}
        </button>
      </div>

      <div
        v-else-if="editingLimit"
        class="limit-form"
      >
        <div class="form__field">
          <label
            class="form__label"
            for="limit-streams"
          >{{ tTizen('parentalControls.maxConcurrentStreams') }}</label>
          <!-- w13: RT-103 — symbol steppers on the m3 time-stepper pattern;
               the input stays the precise typing path, native spinners are
               killed in the stylesheet (pointer-only theater on a remote). -->
          <div
            class="number-stepper"
            role="group"
            :aria-label="tTizen('parentalControls.maxConcurrentStreams')"
          >
            <button
              type="button"
              class="stepper-btn"
              :disabled="savingLimit"
              :aria-label="tTizen('parentalControls.stepDownAria')"
              @click="stepStreams(-1)"
            >−</button>
            <input
              id="limit-streams"
              v-model.number="limitForm.maxConcurrentStreams"
              type="number"
              min="1"
              max="10"
              class="form__input form__input--number"
            >
            <button
              type="button"
              class="stepper-btn"
              :disabled="savingLimit"
              :aria-label="tTizen('parentalControls.stepUpAria')"
              @click="stepStreams(1)"
            >+</button>
          </div>
        </div>

        <div class="form__field">
          <label
            class="form__label"
            for="limit-bandwidth"
          >{{ tTizen('parentalControls.maxBandwidthLabel') }}</label>
          <div
            class="number-stepper"
            role="group"
            :aria-label="tTizen('parentalControls.maxBandwidthLabel')"
          >
            <button
              type="button"
              class="stepper-btn"
              :disabled="savingLimit"
              :aria-label="tTizen('parentalControls.stepDownAria')"
              @click="stepBandwidth(-STEP_BANDWIDTH_KBPS)"
            >−</button>
            <input
              id="limit-bandwidth"
              v-model.number="limitForm.maxTotalBandwidthKbps"
              type="number"
              min="0"
              class="form__input form__input--number"
            >
            <button
              type="button"
              class="stepper-btn"
              :disabled="savingLimit"
              :aria-label="tTizen('parentalControls.stepUpAria')"
              @click="stepBandwidth(STEP_BANDWIDTH_KBPS)"
            >+</button>
          </div>
        </div>

        <div class="form__actions">
          <button
            type="button"
            class="cancel-btn"
            @click="cancelEditLimit"
          >
            {{ tTizen('common.cancel') }}
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="savingLimit"
            @click="saveLimit"
          >
            {{ savingLimit ? tTizen('common.saving') : tTizen('common.save') }}
          </button>
        </div>
      </div>

      <div
        v-else
        class="limit-display"
      >
        <dl class="limit-list">
          <div class="limit-item">
            <dt class="limit-item__label">
              {{ tTizen('parentalControls.maxConcurrentStreams') }}
            </dt>
            <dd class="limit-item__value">
              {{ streamLimit?.maxConcurrentStreams ?? '—' }}
            </dd>
          </div>
          <div class="limit-item">
            <dt class="limit-item__label">
              {{ tTizen('parentalControls.maxTotalBandwidth') }}
            </dt>
            <dd class="limit-item__value">
              {{ streamLimit?.maxTotalBandwidthKbps ? tTizen('parentalControls.bandwidthKbps', { kbps: streamLimit.maxTotalBandwidthKbps }) : tTizen('common.unlimited') }}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          class="section__action"
          @click="startEditLimit"
        >
          {{ tTizen('parentalControls.editLimits') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.parental-controls {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.parental-controls__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
}

.parental-controls__back {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: var(--surface-2, #1f1f23);
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out),
              color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.parental-controls__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.parental-controls__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.parental-controls__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.parental-controls__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

/* Tabs */
.parental-controls__tabs {
  display: flex;
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.parental-controls__tab {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: none;
  background: none;
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-base, 1rem);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--dur-fast, 150ms) var(--ease-out, ease-out),
              border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.parental-controls__tab:hover {
  color: var(--text, #e4e4e7);
}

.parental-controls__tab--active {
  color: var(--accent, #f59e0b);
  border-bottom-color: var(--accent, #f59e0b);
}

.parental-controls__tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* Section */
.parental-controls__section {
  min-height: 50vh;
}

.section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4, 1rem);
}

.section__title {
  font-size: var(--text-xl, 1.25rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.section__desc {
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-sm, 0.875rem);
  margin: 0 0 var(--space-4, 1rem);
}

.section__action {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  border: 1px solid var(--accent, #f59e0b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.section__action:hover {
  background: rgba(245, 158, 11, 0.1);
}

.section__action:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.section__loading,
.section__error,
.section__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
}

/* Schedules */
.schedule-list {
  list-style: none;
  margin: 0 0 var(--space-6, 1.5rem);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.schedule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 1rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-md, 0.375rem);
}

.schedule-item--inactive {
  opacity: 0.6;
}

.schedule-item__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.schedule-item__name {
  font-weight: 600;
  color: var(--text, #e4e4e7);
}

.schedule-item__time {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.schedule-item__days {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-muted, #a1a1aa);
}

.schedule-item__badge {
  display: inline-block;
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  background: var(--surface-3, #27272a);
  border-radius: var(--radius-sm, 0.25rem);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-muted, #a1a1aa);
}

.schedule-item__actions {
  display: flex;
  gap: var(--space-2, 0.5rem);
}

.action-btn {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--text, #e4e4e7);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.action-btn:hover {
  background: var(--surface-3, #27272a);
}

.action-btn--danger {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.5);
}

.action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* w13: RT-099 — the mirrored :disabled needs the host dead-look (opacity law
 * shared by .save-btn/.add-tag-btn/.stepper-btn). */
.action-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.action-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* Form */
.schedule-form {
  margin-top: var(--space-6, 1.5rem);
  padding: var(--space-6, 1.5rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-md, 0.375rem);
}

.form__title {
  font-size: var(--text-lg, 1.125rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0 0 var(--space-4, 1rem);
}

.form__field {
  margin-bottom: var(--space-4, 1rem);
}

.form__field--row {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

.form__label {
  display: block;
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  color: var(--text-muted, #a1a1aa);
  margin-bottom: var(--space-2, 0.5rem);
}

.form__field--row .form__label {
  margin-bottom: 0;
}

.form__input {
  width: 100%;
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-1, #18181b);
  color: var(--text, #e4e4e7);
  font-size: var(--text-base, 1rem);
}

.form__input:focus {
  outline: none;
  border-color: var(--accent, #f59e0b);
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.25));
}

.form__input--number {
  width: 120px;
}

/* w13: RT-103 — the schedule-active checkbox (pointer-era tick, no ring law)
 * is gone; its successor is a D-pad toggle pill on the day-btn pattern, and
 * the ring follows the host 5px focus law (docs/runtime-floor.md governance
 * item 6). */
.toggle-pill {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-full, 9999px);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-sm, 0.875rem);
  min-width: 9ch;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out),
              color var(--dur-fast, 150ms) var(--ease-out, ease-out),
              border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.toggle-pill--on {
  background: var(--accent, #f59e0b);
  border-color: var(--accent, #f59e0b);
  color: var(--surface-1, #18181b);
}

.toggle-pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* w13: RT-103 — number steppers reuse the .stepper-btn ring family; the
 * native wheel/spinner arrows are pointer-only, so they are killed here and
 * the buttons above become the remote path. */
.number-stepper {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.number-stepper .form__input--number {
  -moz-appearance: textfield;
  appearance: textfield;
}

.number-stepper .form__input--number::-webkit-outer-spin-button,
.number-stepper .form__input--number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* w13: RT-099 — mutation-failure disclosure (distinct from the section-level
 * load-error panel; this note sits INSIDE a healthy list). */
.mutation-notice {
  margin: 0 0 var(--space-3, 0.75rem);
  color: #ef4444;
  font-size: var(--text-sm, 0.875rem);
}

.form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4, 1rem);
}

.day-picker {
  display: flex;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.day-btn {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out),
              color var(--dur-fast, 150ms) var(--ease-out, ease-out),
              border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.day-btn--selected {
  background: var(--accent, #f59e0b);
  border-color: var(--accent, #f59e0b);
  color: var(--surface-1, #18181b);
}

.day-btn:hover:not(.day-btn--selected) {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

/* m3 schedule-window stepper (deferred review, 2026-11-03): symbol buttons
 * around an AM/PM readout, modeled on the day-picker pills. The value slot
 * is fixed-width so stepping never reflows the row; the ring follows the
 * host 5px focus law (docs/runtime-floor.md governance item 6). */
.time-stepper {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.stepper-btn {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-sm, 0.875rem);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out),
              color var(--dur-fast, 150ms) var(--ease-out, ease-out),
              border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.stepper-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.stepper-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.stepper-btn:hover:not(:disabled) {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.time-stepper__value {
  min-width: 10ch;
  text-align: center;
  font-size: var(--text-sm, 0.875rem);
  font-variant-numeric: tabular-nums;
  color: var(--text, #e4e4e7);
}

.day-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  margin-top: var(--space-6, 1.5rem);
}

.save-btn,
.cancel-btn,
.retry-btn {
  padding: var(--space-3, 0.75rem) var(--space-6, 1.5rem);
  border-radius: var(--radius-md, 0.375rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.save-btn {
  border: none;
  background: var(--accent, #f59e0b);
  color: var(--surface-1, #18181b);
}

.save-btn:hover:not(:disabled) {
  background: #d97706;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  border: 1px solid var(--border-strong, #52525b);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
}

.cancel-btn:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.retry-btn {
  border: 1px solid var(--border-strong, #52525b);
  background: transparent;
  color: var(--text, #e4e4e7);
}

.retry-btn:hover {
  background: var(--surface-3, #27272a);
}

.save-btn:focus-visible,
.cancel-btn:focus-visible,
.retry-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* Tags */
.tag-add {
  display: flex;
  gap: var(--space-3, 0.75rem);
  margin-bottom: var(--space-4, 1rem);
}

.tag-input {
  flex: 1;
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-1, #18181b);
  color: var(--text, #e4e4e7);
  font-size: var(--text-base, 1rem);
}

.tag-input:focus {
  outline: none;
  border-color: var(--accent, #f59e0b);
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.25));
}

.add-tag-btn {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: none;
  border-radius: var(--radius-md, 0.375rem);
  background: var(--accent, #f59e0b);
  color: var(--surface-1, #18181b);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.add-tag-btn:hover:not(:disabled) {
  background: #d97706;
}

.add-tag-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-tag-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.tag-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 0.5rem);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-full, 9999px);
  border: 1px solid var(--border-subtle, #3f3f46);
}

.tag-item__label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text, #e4e4e7);
}

.tag-item__remove {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  font-size: var(--text-2xs, 1rem); /* M-TIZEN-11: was raw rem */
  line-height: 1;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.tag-item__remove:hover {
  background: rgba(239, 68, 68, 0.4);
}

/* w13: RT-099 — in-flight mirror for the per-row removal guard. */
.tag-item__remove:disabled {
  opacity: 0.5;
  cursor: default;
}

.tag-item__remove:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* Limits */
.limit-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.limit-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
  margin: 0;
  padding: var(--space-6, 1.5rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-md, 0.375rem);
}

.limit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.limit-item__label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.limit-item__value {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
}

.limit-form {
  padding: var(--space-6, 1.5rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-md, 0.375rem);
}

@media (prefers-reduced-motion: reduce) {
  .parental-controls__back,
  .parental-controls__tab,
  .section__action,
  .action-btn,
  .save-btn,
  .cancel-btn,
  .retry-btn,
  .add-tag-btn,
  .day-btn,
  .stepper-btn,
  .toggle-pill,
  .tag-item__remove {
    transition: none;
  }
}
</style>
