/**
 * Unified storage adapter that uses `chrome.storage.local` in the extension
 * context and seamlessly falls back to `window.localStorage` or an in-memory map
 * in standalone web preview or automated tests.
 */

const memoryFallback = new Map<string, unknown>();

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    if (hasChromeStorage()) {
      return await new Promise<T>((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime?.lastError) {
            resolve(defaultValue);
            return;
          }
          if (result && Object.prototype.hasOwnProperty.call(result, key)) {
            resolve(result[key] as T);
          } else {
            resolve(defaultValue);
          }
        });
      });
    }

    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
      return defaultValue;
    }

    if (memoryFallback.has(key)) {
      return structuredClone(memoryFallback.get(key)) as T;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function storageSet<T>(key: string, value: T): Promise<boolean> {
  try {
    if (hasChromeStorage()) {
      return await new Promise<boolean>((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime?.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      });
    }

    if (hasLocalStorage()) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    }

    memoryFallback.set(key, structuredClone(value));
    return true;
  } catch {
    return false;
  }
}

export async function storageRemove(key: string): Promise<boolean> {
  try {
    if (hasChromeStorage()) {
      return await new Promise<boolean>((resolve) => {
        chrome.storage.local.remove([key], () => {
          resolve(!chrome.runtime?.lastError);
        });
      });
    }

    if (hasLocalStorage()) {
      window.localStorage.removeItem(key);
      return true;
    }

    memoryFallback.delete(key);
    return true;
  } catch {
    return false;
  }
}

export async function storageClearAll(): Promise<boolean> {
  try {
    if (hasChromeStorage()) {
      return await new Promise<boolean>((resolve) => {
        chrome.storage.local.clear(() => {
          resolve(!chrome.runtime?.lastError);
        });
      });
    }

    if (hasLocalStorage()) {
      window.localStorage.clear();
    }
    memoryFallback.clear();
    return true;
  } catch {
    return false;
  }
}
