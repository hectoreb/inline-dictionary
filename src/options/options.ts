// Options page: configure API key, default language, and clear cache.

import { getApiKey, setApiKey, clearApiKey, getDefaultLanguage, setDefaultLanguage } from '../lib/storage.js';
import { clearCache } from '../lib/cache.js';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const saveKeyBtn = document.getElementById('save-key') as HTMLButtonElement;
const clearKeyBtn = document.getElementById('clear-key') as HTMLButtonElement;
const keyStatus = document.getElementById('key-status') as HTMLSpanElement;
const defaultLangSelect = document.getElementById('default-lang') as HTMLSelectElement;
const clearCacheBtn = document.getElementById('clear-cache') as HTMLButtonElement;
const cacheStatus = document.getElementById('cache-status') as HTMLSpanElement;

async function init(): Promise<void> {
  const existingKey = await getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
    keyStatus.textContent = '✓ API key configurada';
    keyStatus.className = 'status ok';
  }
  const defaultLang = await getDefaultLanguage();
  defaultLangSelect.value = defaultLang;
}

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = '✗ La key no puede estar vacía';
    keyStatus.className = 'status err';
    return;
  }
  await setApiKey(key);
  keyStatus.textContent = '✓ API key guardada';
  keyStatus.className = 'status ok';
});

clearKeyBtn.addEventListener('click', async () => {
  await clearApiKey();
  apiKeyInput.value = '';
  keyStatus.textContent = 'API key eliminada';
  keyStatus.className = 'status';
});

defaultLangSelect.addEventListener('change', async () => {
  const lang = defaultLangSelect.value as 'auto' | 'es' | 'en';
  await setDefaultLanguage(lang);
});

clearCacheBtn.addEventListener('click', async () => {
  await clearCache();
  cacheStatus.textContent = '✓ Cache limpiada';
  cacheStatus.className = 'status ok';
  setTimeout(() => { cacheStatus.textContent = ''; }, 2000);
});

void init();
