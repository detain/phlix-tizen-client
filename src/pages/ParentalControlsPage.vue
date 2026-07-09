<script setup lang="ts">
/**
 * ParentalControlsPage — Manage access schedules, tag blocking, and stream limits.
 *
 * Provides TV-friendly D-pad navigation for parental control settings.
 * Integrates with the server's profile-scoped endpoints:
 *   GET/POST/DELETE /api/v1/profiles/{id}/schedules
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
import type {
  AccessSchedule,
  DayOfWeek,
  ProfileTag,
  ProfileStreamLimit
} from '@phlix/contracts';

const router = useRouter();
const apiBase = useApiBase();
const authStore = useAuthStore();

const profileId = computed(() => (authStore.user as AuthUser)?.profileId ?? 0);

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

// ── Schedule editing ───────────────────────────────────────────────────────

const editingSchedule = ref<AccessSchedule | null>(null);
const scheduleForm = ref({
  name: '',
  startTime: '08:00:00',
  endTime: '22:00:00',
  daysOfWeek: [] as DayOfWeek[],
  isActive: true
});
const savingSchedule = ref(false);

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
  { label: 'Sun', value: 'sun' }
];

function startCreateSchedule(): void {
  editingSchedule.value = null;
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
  scheduleForm.value = {
    name: schedule.name,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    daysOfWeek: [...schedule.daysOfWeek],
    isActive: schedule.isActive
  };
}

function cancelEditSchedule(): void {
  editingSchedule.value = null;
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
      // Update via DELETE + POST or PUT - using POST to update
      await client.post(
        `/api/v1/profiles/${pid}/schedules`,
        {
          id: editingSchedule.value.id,
          name: scheduleForm.value.name,
          startTime: scheduleForm.value.startTime,
          endTime: scheduleForm.value.endTime,
          daysOfWeek: scheduleForm.value.daysOfWeek,
          isActive: scheduleForm.value.isActive
        }
      );
    } else {
      await client.post(`/api/v1/profiles/${pid}/schedules`, {
        name: scheduleForm.value.name,
        startTime: scheduleForm.value.startTime,
        endTime: scheduleForm.value.endTime,
        daysOfWeek: scheduleForm.value.daysOfWeek,
        isActive: scheduleForm.value.isActive
      });
    }
    editingSchedule.value = null;
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

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.delete(`/api/v1/profiles/${pid}/schedules/${scheduleId}`);
    await loadSchedules();
  } catch {
    // Silently fail delete
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

  addingTag.value = true;
  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.post(`/api/v1/profiles/${pid}/tags`, {
      tag,
      tagType: 'blocked'
    });
    newTagInput.value = '';
    await loadTags();
  } catch {
    // Silently fail
  } finally {
    addingTag.value = false;
  }
}

async function removeTag(tagId: number): Promise<void> {
  const pid = profileId.value;
  if (!pid) return;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    await client.delete(`/api/v1/profiles/${pid}/tags/${tagId}`);
    await loadTags();
  } catch {
    // Silently fail
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
    await client.put(`/api/v1/profiles/${pid}/stream-limits`, {
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
    errorSchedules.value = 'No profile selected';
    return;
  }

  loadingSchedules.value = true;
  errorSchedules.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<{ schedules: AccessSchedule[] }>(
      `/api/v1/profiles/${pid}/schedules`
    );
    schedules.value = data.schedules ?? [];
  } catch (e) {
    errorSchedules.value = e instanceof Error ? e.message : 'Failed to load schedules';
    schedules.value = [];
  } finally {
    loadingSchedules.value = false;
  }
}

async function loadTags(): Promise<void> {
  const pid = profileId.value;
  if (!pid) {
    errorTags.value = 'No profile selected';
    return;
  }

  loadingTags.value = true;
  errorTags.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<{ tags: ProfileTag[] }>(
      `/api/v1/profiles/${pid}/tags`
    );
    blockedTags.value = (data.tags ?? []).filter(t => t.tagType === 'blocked');
  } catch (e) {
    errorTags.value = e instanceof Error ? e.message : 'Failed to load tags';
    blockedTags.value = [];
  } finally {
    loadingTags.value = false;
  }
}

async function loadStreamLimit(): Promise<void> {
  const pid = profileId.value;
  if (!pid) {
    errorLimits.value = 'No profile selected';
    return;
  }

  loadingLimits.value = true;
  errorLimits.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<ProfileStreamLimit>(
      `/api/v1/profiles/${pid}/stream-limits`
    );
    streamLimit.value = data;
  } catch (e) {
    errorLimits.value = e instanceof Error ? e.message : 'Failed to load stream limit';
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
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function formatDays(days: DayOfWeek[]): string {
  if (days.length === 0) return 'No days set';
  if (days.length === 7) return 'Every day';
  const dayLabels: Record<DayOfWeek, string> = {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'
  };
  return days.map(d => dayLabels[d]).join(', ');
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
        aria-label="Go back"
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
        Parental Controls
      </h1>
    </header>

    <nav
      class="parental-controls__tabs"
      role="tablist"
      aria-label="Settings sections"
    >
      <button
        role="tab"
        :aria-selected="activeTab === 'schedules'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'schedules' }]"
        @click="activeTab = 'schedules'"
      >
        Schedules
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'tags'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'tags' }]"
        @click="activeTab = 'tags'"
      >
        Blocked Tags
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'limits'"
        :class="['parental-controls__tab', { 'parental-controls__tab--active': activeTab === 'limits' }]"
        @click="activeTab = 'limits'"
      >
        Stream Limits
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
          Access Schedules
        </h2>
        <button
          v-if="!editingSchedule"
          type="button"
          class="section__action"
          @click="startCreateSchedule"
        >
          + Add Schedule
        </button>
      </div>

      <div
        v-if="loadingSchedules"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <p>Loading schedules…</p>
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
          Retry
        </button>
      </div>

      <div
        v-else-if="schedules.length === 0"
        class="section__empty"
      >
        <p>No access schedules configured.</p>
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
          :class="{ 'schedule-item--inactive': !schedule.isActive }"
        >
          <div class="schedule-item__info">
            <span class="schedule-item__name">{{ schedule.name }}</span>
            <span class="schedule-item__time">{{ formatTime(schedule.startTime) }} – {{ formatTime(schedule.endTime) }}</span>
            <span class="schedule-item__days">{{ formatDays(schedule.daysOfWeek) }}</span>
            <span
              v-if="!schedule.isActive"
              class="schedule-item__badge"
            >Inactive</span>
          </div>
          <div class="schedule-item__actions">
            <button
              type="button"
              class="action-btn"
              @click="startEditSchedule(schedule)"
            >
              Edit
            </button>
            <button
              type="button"
              class="action-btn action-btn--danger"
              @click="deleteSchedule(schedule.id)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>

      <!-- Schedule Form -->
      <div
        v-if="editingSchedule !== null || scheduleForm.name !== '' || true"
        class="schedule-form"
      >
        <h3 class="form__title">
          {{ editingSchedule ? 'Edit Schedule' : 'New Schedule' }}
        </h3>

        <div class="form__field">
          <label
            class="form__label"
            for="schedule-name"
          >Name</label>
          <input
            id="schedule-name"
            v-model="scheduleForm.name"
            type="text"
            class="form__input"
            placeholder="e.g., Homework Time"
          >
        </div>

        <div class="form__row">
          <div class="form__field">
            <label
              class="form__label"
              for="schedule-start"
            >Start Time</label>
            <input
              id="schedule-start"
              v-model="scheduleForm.startTime"
              type="time"
              class="form__input"
            >
          </div>
          <div class="form__field">
            <label
              class="form__label"
              for="schedule-end"
            >End Time</label>
            <input
              id="schedule-end"
              v-model="scheduleForm.endTime"
              type="time"
              class="form__input"
            >
          </div>
        </div>

        <div class="form__field">
          <label class="form__label">Days of Week</label>
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
          <label
            class="form__label"
            for="schedule-active"
          >Active</label>
          <input
            id="schedule-active"
            v-model="scheduleForm.isActive"
            type="checkbox"
            class="form__checkbox"
          >
        </div>

        <div class="form__actions">
          <button
            type="button"
            class="cancel-btn"
            @click="cancelEditSchedule"
          >
            Cancel
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="savingSchedule || !scheduleForm.name"
            @click="saveSchedule"
          >
            {{ savingSchedule ? 'Saving…' : 'Save' }}
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
          Blocked Tags
        </h2>
      </div>

      <p class="section__desc">
        Tags block content from appearing in search or recommendations.
      </p>

      <div
        v-if="loadingTags"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <p>Loading tags…</p>
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
          Retry
        </button>
      </div>

      <div v-else>
        <div class="tag-add">
          <input
            v-model="newTagInput"
            type="text"
            class="tag-input"
            placeholder="Enter tag to block…"
            @keyup.enter="addTag"
          >
          <button
            type="button"
            class="add-tag-btn"
            :disabled="addingTag || !newTagInput.trim()"
            @click="addTag"
          >
            {{ addingTag ? 'Adding…' : 'Add' }}
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
              aria-label="Remove tag"
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
          No blocked tags configured.
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
          Stream Limits
        </h2>
      </div>

      <div
        v-if="loadingLimits"
        class="section__loading"
        role="status"
        aria-busy="true"
      >
        <p>Loading limits…</p>
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
          Retry
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
          >Max Concurrent Streams</label>
          <input
            id="limit-streams"
            v-model.number="limitForm.maxConcurrentStreams"
            type="number"
            min="1"
            max="10"
            class="form__input form__input--number"
          >
        </div>

        <div class="form__field">
          <label
            class="form__label"
            for="limit-bandwidth"
          >Max Bandwidth (kbps, 0 = unlimited)</label>
          <input
            id="limit-bandwidth"
            v-model.number="limitForm.maxTotalBandwidthKbps"
            type="number"
            min="0"
            class="form__input form__input--number"
          >
        </div>

        <div class="form__actions">
          <button
            type="button"
            class="cancel-btn"
            @click="cancelEditLimit"
          >
            Cancel
          </button>
          <button
            type="button"
            class="save-btn"
            :disabled="savingLimit"
            @click="saveLimit"
          >
            {{ savingLimit ? 'Saving…' : 'Save' }}
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
              Max Concurrent Streams
            </dt>
            <dd class="limit-item__value">
              {{ streamLimit?.maxConcurrentStreams ?? '—' }}
            </dd>
          </div>
          <div class="limit-item">
            <dt class="limit-item__label">
              Max Total Bandwidth
            </dt>
            <dd class="limit-item__value">
              {{ streamLimit?.maxTotalBandwidthKbps ? `${streamLimit.maxTotalBandwidthKbps} kbps` : 'Unlimited' }}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          class="section__action"
          @click="startEditLimit"
        >
          Edit Limits
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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

.action-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.25));
}

.form__input--number {
  width: 120px;
}

.form__checkbox {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--accent, #f59e0b);
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

.day-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.25));
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
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.tag-item__remove:hover {
  background: rgba(239, 68, 68, 0.4);
}

.tag-item__remove:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
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
  .tag-item__remove {
    transition: none;
  }
}
</style>
