// Content script: detects text selection, shows popover with definition.

import type { LookupRequest, LookupResponse, LookupResult, Language } from '../lib/types.js';

let popoverEl: HTMLElement | null = null;
let currentWord = '';
let currentLanguage: Language = 'es';
let closeTimer: number | null = null;

const POPOVER_ID = '__inline_dictionary_popover__';
const POPOVER_OFFSET = 8;
const POPOVER_WIDTH = 360;
const POPOVER_MAX_HEIGHT = 480;

// --- Triggers ---------------------------------------------------------------

document.addEventListener('mouseup', () => {
  setTimeout(handleSelectionChange, 10);
});

document.addEventListener('keyup', (e) => {
  if (e.shiftKey || e.key === 'Shift') handleSelectionChange();
});

document.addEventListener('dblclick', (e) => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    e.preventDefault();
    showPopoverFor(sel.toString().trim());
  }
});

// Cmd+Shift+D (Mac) / Ctrl+Shift+D (others)
chrome.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type === 'TRIGGER_LOOKUP') {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      showPopoverFor(sel.toString().trim());
    }
  }
  return false;
});

// --- Selection handling -----------------------------------------------------

function handleSelectionChange(): void {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    scheduleClose();
    return;
  }
  const word = sel.toString().trim();
  if (!word || word === currentWord) return;
  // Word must be 1-50 chars and contain at least one letter
  if (word.length > 50 || !/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(word)) {
    scheduleClose();
    return;
  }
  showPopoverFor(word);
}

function scheduleClose(): void {
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => {
    closePopover();
    closeTimer = null;
  }, 200);
}

function cancelClose(): void {
  if (closeTimer !== null) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

// --- Popover ----------------------------------------------------------------

function showPopoverFor(word: string): void {
  currentWord = word;
  cancelClose();
  renderPopover();
  positionPopover();
  // Initial state: loading
  void lookup(word);
}

function renderPopover(): void {
  closePopover();
  popoverEl = document.createElement('div');
  popoverEl.id = POPOVER_ID;
  // Use shadow DOM for encapsulation
  const shadow = popoverEl.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${popoverCSS}</style><div class="root"><div class="state">Buscando…</div></div>`;
  document.documentElement.appendChild(popoverEl);

  // Close on outside click
  popoverEl.addEventListener('mouseenter', cancelClose);
  popoverEl.addEventListener('mouseleave', scheduleClose);
  document.addEventListener('mousedown', onOutsideClick, true);
  document.addEventListener('keydown', onEscapeKey, true);
}

function onOutsideClick(e: MouseEvent): void {
  if (!popoverEl) return;
  if (e.target instanceof Node && popoverEl.contains(e.target)) return;
  closePopover();
}

function onEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closePopover();
  } else if (e.key === 'Tab' && popoverEl) {
    e.preventDefault();
    toggleLanguage();
  }
}

function closePopover(): void {
  if (popoverEl && popoverEl.parentNode) {
    popoverEl.parentNode.removeChild(popoverEl);
  }
  popoverEl = null;
  currentWord = '';
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onEscapeKey, true);
}

function positionPopover(): void {
  if (!popoverEl) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const top = window.scrollY + rect.bottom + POPOVER_OFFSET;
  const left = window.scrollX + rect.left;

  popoverEl.style.position = 'absolute';
  popoverEl.style.top = `${top}px`;
  popoverEl.style.left = `${left}px`;
  popoverEl.style.width = `${POPOVER_WIDTH}px`;
  popoverEl.style.maxHeight = `${POPOVER_MAX_HEIGHT}px`;
  popoverEl.style.zIndex = '2147483647';

  // Flip if would go off-screen
  requestAnimationFrame(() => {
    if (!popoverEl) return;
    const popRect = popoverEl.getBoundingClientRect();
    if (popRect.bottom > window.innerHeight) {
      // Move above the selection
      popoverEl.style.top = `${window.scrollY + rect.top - popRect.height - POPOVER_OFFSET}px`;
    }
    if (popRect.right > window.innerWidth) {
      popoverEl.style.left = `${window.scrollX + rect.right - POPOVER_WIDTH}px`;
    }
  });
}

async function lookup(word: string, overrideLang?: Language): Promise<void> {
  const request: LookupRequest = {
    type: 'LOOKUP_WORD',
    word,
    ...(overrideLang ? { language: overrideLang } : {}),
  };
  try {
    const response: LookupResponse = await chrome.runtime.sendMessage(request);
    renderResult(response, word, overrideLang);
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('Extension context invalidated') || raw.includes('Receiving end does not exist')) {
      renderError('La extensión se reinició. Recarga esta página (F5 o Cmd+R) y vuelve a seleccionar la palabra.');
    } else {
      renderError(`Error: ${raw}`);
    }
  }
}

function renderResult(response: LookupResponse, word: string, langUsed?: Language): void {
  if (!popoverEl) return;
  const shadow = popoverEl.shadowRoot;
  if (!shadow) return;

  if (!response.ok) {
    renderError(response.message);
    return;
  }

  const result: LookupResult = response.result;
  currentLanguage = result.language;
  if (langUsed === undefined) currentLanguage = result.language;

  const root = shadow.querySelector('.root');
  if (!root) return;

  root.innerHTML = renderResultHTML(result);

  // Bind language toggle buttons
  shadow.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang as Language;
      if (lang !== currentLanguage) {
        currentLanguage = lang;
        showLoading();
        void lookup(word, lang);
      }
    });
  });
}

function renderResultHTML(result: LookupResult): string {
  const defsHTML = result.definitions.map((d, i) => `
    <div class="def">
      <div class="def-header">
        <span class="pos">${escapeHTML(d.partOfSpeech)}</span>
        <span class="def-num">${i + 1}</span>
      </div>
      <div class="def-text">${escapeHTML(d.text)}</div>
      ${d.examples && d.examples.length > 0 ? `<div class="examples">${d.examples.map((e) => `<div class="example">— ${escapeHTML(e)}</div>`).join('')}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="header">
      <div class="word">${escapeHTML(result.word)}</div>
      <div class="lang-toggle">
        <button data-lang="es" class="${result.language === 'es' ? 'active' : ''}">ES</button>
        <button data-lang="en" class="${result.language === 'en' ? 'active' : ''}">EN</button>
      </div>
    </div>
    <div class="body">
      ${defsHTML}
      ${result.etymology ? `<details class="etymology"><summary>Etimología</summary><div class="etymology-text">${escapeHTML(result.etymology)}</div></details>` : ''}
      ${result.pronunciation ? `<div class="pron">[${escapeHTML(result.pronunciation)}]</div>` : ''}
    </div>
    <div class="footer">
      <span class="source">${result.source === 'wikcionario' ? 'Wikcionario' : 'Merriam-Webster'}</span>
      <a href="${result.source === 'wikcionario' ? `https://es.wiktionary.org/wiki/${encodeURIComponent(result.word)}` : `https://www.merriam-webster.com/dictionary/${encodeURIComponent(result.word)}`}" target="_blank" rel="noopener" class="more">ver más →</a>
    </div>
  `;
}

function showLoading(): void {
  if (!popoverEl) return;
  const shadow = popoverEl.shadowRoot;
  if (!shadow) return;
  const root = shadow.querySelector('.root');
  if (root) root.innerHTML = '<div class="state">Buscando…</div>';
}

function renderError(message: string): void {
  if (!popoverEl) return;
  const shadow = popoverEl.shadowRoot;
  if (!shadow) return;
  const root = shadow.querySelector('.root');
  if (root) root.innerHTML = `<div class="state error">${escapeHTML(message)}</div>`;
}

function toggleLanguage(): void {
  const newLang: Language = currentLanguage === 'es' ? 'en' : 'es';
  currentLanguage = newLang;
  showLoading();
  void lookup(currentWord, newLang);
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// CSS is inlined in renderPopover for shadow DOM encapsulation
const popoverCSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
.root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  overflow: hidden;
  max-height: 480px;
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
  border-bottom: 1px solid #e5e7eb;
}
.word { font-weight: 600; font-size: 16px; color: #111827; }
.lang-toggle { display: flex; gap: 2px; background: #e5e7eb; border-radius: 6px; padding: 2px; }
.lang-toggle button {
  background: transparent; border: 0; padding: 3px 8px;
  font-size: 12px; font-weight: 600; color: #6b7280;
  border-radius: 4px; cursor: pointer; transition: all 0.15s;
}
.lang-toggle button.active { background: white; color: #1d4ed8; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.lang-toggle button:hover:not(.active) { color: #374151; }
.body { padding: 12px 16px; overflow-y: auto; flex: 1; }
.def { padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
.def:last-child { border-bottom: 0; }
.def-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.pos { font-size: 11px; font-style: italic; color: #6b7280; text-transform: lowercase; }
.def-num { font-size: 11px; color: #9ca3af; }
.def-text { color: #1f2937; }
.examples { margin-top: 4px; padding-left: 12px; }
.example { font-size: 13px; color: #6b7280; font-style: italic; }
.etymology { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
.etymology summary { font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; }
.etymology-text { margin-top: 6px; font-size: 13px; color: #4b5563; }
.pron { margin-top: 6px; font-size: 12px; color: #6b7280; font-family: 'Times New Roman', serif; }
.footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; background: #f9fafb; border-top: 1px solid #e5e7eb;
  font-size: 11px; color: #6b7280;
}
.more { color: #1d4ed8; text-decoration: none; font-weight: 500; }
.more:hover { text-decoration: underline; }
.state { padding: 24px 16px; text-align: center; color: #6b7280; font-size: 13px; }
.state.error { color: #b91c1c; }
`;
