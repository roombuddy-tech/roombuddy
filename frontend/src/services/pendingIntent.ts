import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What a guest was trying to do when they hit the login wall.
 *
 * Logging in swaps the whole root navigator (BrowseStack → RoleTabs), which
 * unmounts the stack and throws away the navigation state — so the listing the
 * guest was on is gone by the time they're authenticated. We stash the intent
 * outside the navigation tree and replay it once they land back in the app.
 *
 * AsyncStorage rather than in-memory state: reading the OTP can send the user
 * to Messages and back, and on a cold start the app would lose anything held
 * only in memory.
 */
export type PendingAction = 'unlock' | 'message' | 'book';

export interface PendingIntent {
  listingId: string;
  action: PendingAction;
  savedAt: number;
}

const KEY = 'PENDING_INTENT';

/** Long enough to cover OTP + profile setup, short enough that a forgotten
 *  intent never ambushes the guest on some unrelated launch days later. */
const TTL_MS = 30 * 60 * 1000;

export async function savePendingIntent(listingId: string, action: PendingAction): Promise<void> {
  try {
    const intent: PendingIntent = { listingId, action, savedAt: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Non-fatal — the guest just lands on the dashboard as before.
  }
}

export async function clearPendingIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Read and clear in one shot, so a replay can never fire twice. */
export async function takePendingIntent(): Promise<PendingIntent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);

    const intent = JSON.parse(raw) as PendingIntent;
    if (!intent?.listingId || !intent?.action) return null;
    if (Date.now() - (intent.savedAt ?? 0) > TTL_MS) return null;

    return intent;
  } catch {
    return null;
  }
}
