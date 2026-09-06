// Popup: manual word search from the toolbar.

import type { LookupRequest, LookupResponse, LookupResult } from '../lib/types.js';

const form = document.getElementById('search-form') as HTMLFormElement;
const input = document.getElementById('search-input') as HTMLInputElement;
const resultEl = document.getElementById('result') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const word = input.value.trim();
  if (!word) return;
  await search(word);
});

async function search(word: string): Promise<void> {
  resultEl.innerHTML = '<div class="state">Buscando…</div>';
  const request: LookupRequest = { type: 'LOOKUP_WORD', word };
  try {
    const response: LookupResponse = await chrome.runtime.sendMessage(request);
    render(response);
  } catch (err: unknown) {
    resultEl.innerHTML = `<div class="state error">${escape(err instanceof Error ? err.message : 'Error')}</div>`;
  }
}

function render(response: LookupResponse): void {
  if (!response.ok) {
    resultEl.innerHTML = `<div class="state error">${escape(response.message)}</div>`;
    return;
  }
  const r: LookupResult = response.result;
  const defs = r.definitions.map((d, i) => `
    <div class="def">
      <div class="def-header"><span class="pos">${escape(d.partOfSpeech)}</span> <span class="def-num">${i + 1}</span></div>
      <div class="def-text">${escape(d.text)}</div>
      ${d.examples && d.examples.length > 0 ? `<div class="examples">${d.examples.map((e) => `<div class="example">— ${escape(e)}</div>`).join('')}</div>` : ''}
    </div>
  `).join('');
  resultEl.innerHTML = `
    <div class="header">
      <div class="word">${escape(r.word)}</div>
      <div class="lang-badge">${r.language.toUpperCase()}</div>
    </div>
    <div class="body">${defs}${r.etymology ? `<details class="etymology"><summary>Etimología</summary><div class="etymology-text">${escape(r.etymology)}</div></details>` : ''}${r.pronunciation ? `<div class="pron">[${escape(r.pronunciation)}]</div>` : ''}</div>
    <div class="footer"><span class="source">${r.source === 'wikcionario' ? 'Wikcionario' : 'Merriam-Webster'}</span></div>
  `;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
