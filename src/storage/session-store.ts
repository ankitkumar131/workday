import { STORAGE_KEYS } from "../shared/constants";
import { AutofillSession } from "../shared/types";
import { storageGet, storageRemove, storageSet } from "./chrome-storage";

const MAX_HISTORY_ITEMS = 20;

export async function getActiveSession(): Promise<AutofillSession | null> {
  return await storageGet<AutofillSession | null>(
    STORAGE_KEYS.ACTIVE_SESSION,
    null
  );
}

export async function saveActiveSession(
  session: AutofillSession | null
): Promise<void> {
  if (!session) {
    await storageRemove(STORAGE_KEYS.ACTIVE_SESSION);
    return;
  }
  session.updatedAt = Date.now();
  await storageSet(STORAGE_KEYS.ACTIVE_SESSION, session);
  await upsertSessionInHistory(session);
}

export async function getSessionHistory(): Promise<AutofillSession[]> {
  return await storageGet<AutofillSession[]>(
    STORAGE_KEYS.SESSION_HISTORY,
    []
  );
}

export async function upsertSessionInHistory(
  session: AutofillSession
): Promise<void> {
  const history = await getSessionHistory();
  const idx = history.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    history[idx] = structuredClone(session);
  } else {
    history.unshift(structuredClone(session));
  }
  const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
  await storageSet(STORAGE_KEYS.SESSION_HISTORY, trimmed);
}

export async function clearSessionHistory(): Promise<void> {
  await storageRemove(STORAGE_KEYS.ACTIVE_SESSION);
  await storageSet(STORAGE_KEYS.SESSION_HISTORY, []);
}
