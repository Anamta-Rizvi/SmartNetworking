import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { API_BASE } from '../api/client';

const PROXIMITY_TASK = 'campus-os-proximity-check';
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastCheckTime = 0;

// ── Notification setup ────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function fireNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
}

// ── Nearby events check ───────────────────────────────────────────────────────

async function checkNearby(userId: number, lat: number, lng: number) {
  const now = Date.now();
  if (now - lastCheckTime < MIN_INTERVAL_MS) return;
  lastCheckTime = now;

  try {
    const res = await fetch(
      `${API_BASE}/notifications/nearby?lat=${lat}&lng=${lng}&user_id=${userId}`
    );
    if (!res.ok) return;

    const data = await res.json();
    const nearby: { title: string; starts_at: string; distance_meters: number }[] = data.nearby ?? [];

    for (const event of nearby.slice(0, 2)) {
      const startTime = new Date(event.starts_at);
      const minutesUntil = Math.round((startTime.getTime() - Date.now()) / 60_000);
      if (minutesUntil > 0 && minutesUntil <= 30) {
        await fireNotification(
          `Nearby: ${event.title}`,
          `Starts in ${minutesUntil} min · ${event.distance_meters}m away`,
        );
      }
    }
  } catch {
    // silently ignore network errors in background
  }
}

// ── Background task definition ────────────────────────────────────────────────

TaskManager.defineTask(PROXIMITY_TASK, async ({ data, error }: any) => {
  if (error) return;

  const userId: number | null = data?.userId ?? null;
  if (!userId) return;

  const loc = data?.locations?.[0];
  if (!loc) return;

  await checkNearby(userId, loc.coords.latitude, loc.coords.longitude);
});

// ── Public API ────────────────────────────────────────────────────────────────

export async function startProximityService(userId: number): Promise<boolean> {
  const notifGranted = await requestNotificationPermission();
  if (!notifGranted) return false;

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') {
    // Fallback: foreground-only, still useful when app is open
    console.log('[Proximity] Background location not granted — foreground-only mode');
  }

  const isRunning = await Location.hasStartedLocationUpdatesAsync(PROXIMITY_TASK).catch(() => false);
  if (!isRunning) {
    await Location.startLocationUpdatesAsync(PROXIMITY_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,           // trigger every 100m of movement
      timeInterval: 5 * 60 * 1000,     // or every 5 minutes
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Campus OS',
        notificationBody: 'Checking for nearby events…',
        notificationColor: '#7C3AED',
      },
      // Pass userId into task data
      deferredUpdatesInterval: 5 * 60 * 1000,
    });
  }

  return true;
}

export async function stopProximityService(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(PROXIMITY_TASK).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(PROXIMITY_TASK);
  }
}

/**
 * One-shot foreground check — useful when app becomes active.
 * Call this from AppNavigator or HomeScreen on focus.
 */
export async function checkProximityNow(userId: number): Promise<void> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await checkNearby(userId, loc.coords.latitude, loc.coords.longitude);
  } catch {
    // silently ignore
  }
}
