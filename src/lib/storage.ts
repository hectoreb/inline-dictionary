// Wrapper for chrome.storage / browser.storage.
// Unified API that works in both Chrome MV3 and Firefox MV3.

import type { DefaultLanguage } from './types.js';

type StorageAPI = {
  local: {
    get<T = Record<string, unknown>>(keys?: string | string[] | Record<string, unknown>): Promise<T>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
};

function getStorage(): StorageAPI {
  const api = (globalThis as { chrome?: { storage?: StorageAPI }; browser?: { storage?: StorageAPI } });
  if (api.chrome?.storage) return api.chrome.storage;
  if (api.browser?.storage) return api.browser.storage;
  throw new Error('No storage API available (chrome.storage or browser.storage)');
}

const KEY_API_KEY = 'merriamApiKey';
const KEY_DEFAULT_LANG = 'defaultLanguage';

export async function getApiKey(): Promise<string | null> {
  const result = await getStorage().local.get<{ [KEY_API_KEY]?: string }>(KEY_API_KEY);
  return result[KEY_API_KEY] ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  await getStorage().local.set({ [KEY_API_KEY]: key });
}

export async function clearApiKey(): Promise<void> {
  await getStorage().local.remove(KEY_API_KEY);
}

export async function getDefaultLanguage(): Promise<DefaultLanguage> {
  const result = await getStorage().local.get<{ [KEY_DEFAULT_LANG]?: DefaultLanguage }>(KEY_DEFAULT_LANG);
  return result[KEY_DEFAULT_LANG] ?? 'auto';
}

export async function setDefaultLanguage(lang: DefaultLanguage): Promise<void> {
  await getStorage().local.set({ [KEY_DEFAULT_LANG]: lang });
}
