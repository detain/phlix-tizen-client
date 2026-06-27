// Pure, unit-testable stable device-id resolution for the Tizen client.
// Persists a generated id in localStorage so the server sees a stable device
// across app launches (drives session/device tracking via X-Phlix-Device-ID).

const DEVICE_ID_KEY = 'phlix.deviceId';

type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;

let fallbackCounter = 0;

/** Generate a fresh device id, preferring crypto.randomUUID when available. */
function generateDeviceId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return `tizen-${c.randomUUID()}`;
  }
  // Deterministic-enough fallback for ancient webviews without randomUUID.
  // Timestamp + monotonic counter avoids Math.random (keeps tests stable).
  fallbackCounter += 1;
  return `tizen-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}

/**
 * Return the persisted device id, generating + persisting one on first call.
 * Subsequent calls return the same id from storage.
 */
export function resolveDeviceId(storage: DeviceStorage): string {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = generateDeviceId();
  storage.setItem(DEVICE_ID_KEY, id);
  return id;
}
