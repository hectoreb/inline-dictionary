# Inline Dictionary — Especificación de diseño

**Fecha:** 2026-09-06
**Autor:** Mavis (con Héctor Bezares)
**Status:** Borrador, pendiente de revisión

---

## 1. Resumen

Extensión de navegador que muestra definiciones de palabras (español e inglés) en un popover flotante anclado a la palabra seleccionada, sin abrir pestañas ni ventanas. Compatible con Chrome, Edge, Brave, Arc, Firefox y Safari. Fuentes: Wikcionario (español) y Merriam-Webster Collegiate API (inglés).

Nombre tentativo: **Inline Dictionary**. Cambiable.

---

## 2. Objetivos y no-objetivos

### Objetivos

- Consulta instantánea: doble-click o selección + atajo → popover con definición
- Cero fricción: no se abre pestaña, ventana, ni panel lateral permanente
- Multi-navegador: un solo código fuente, builds para 6 navegadores
- Multi-idioma: detección automática ES/EN + override manual siempre disponible
- Funciona offline para palabras ya consultadas (cache IndexedDB)
- Privacidad: solo se envía la palabra a la API externa; nunca la URL ni el contenido de la página

### No-objetivos (v1)

- Traducción entre idiomas (solo definiciones monolingües)
- Soporte de idiomas distintos a ES y EN
- Listas de vocabulario personal / flashcards (v2)
- Historial persistente de palabras consultadas (v2)
- Pronunciación con audio (v2 — MW lo provee, fácil de añadir)
- Sincronización entre dispositivos (v2)
- Mobile (la extensión es solo desktop)

---

## 3. Decisiones arquitectónicas

| # | Decisión | Justificación (eficiencia/efectividad) |
|---|----------|---------------------------------------|
| 1 | TypeScript estricto + esbuild | Costo de setup ~5 min; paga en refactors seguros y debug rápido |
| 2 | MV3 service worker separado | Fetch a APIs externas + cache centralizado; content script solo UI |
| 3 | Manifest único, builds por navegador | Chrome/Edge/Brave/Arc/Firefox comparten 95%; Safari = wrapper Swift de ~50 líneas |
| 4 | IndexedDB vía `idb-keyval` (3 KB) | 5,000 definiciones caben; TTL diferenciado (hits = infinito, not-found = 1 día) |
| 5 | Popover anclado a la palabra | Mínima fricción visual; click-fuera/Escape cierran; hover pausa el auto-close |
| 6 | Doble-click + Cmd+Shift+D | Dos rutas de invocación; ninguna requiere abrir toolbar |
| 7 | Heurística de idioma + toggle ES/EN en popover | Detección automática por tildes/ñ + palabras comunes; override siempre disponible |
| 8 | Wikcionario API (ES) + Merriam-Webster Collegiate API (EN) | Sin scraping, sin keys para ES, una sola key gratuita para EN |
| 9 | Popup toolbar = búsqueda manual; options page = API key | Config persistente separada del lookup ad-hoc |
| 10 | vitest para `lib/`, tests manuales para UI | Sin E2E (overhead no justificado para UI tan simple) |
| 11 | Git init desde día 1 | 30 seg; evita pesadillas de versionado |

**Dependencias totales: 4.** `esbuild`, `typescript`, `@types/chrome`, `idb-keyval`. YAGNI.

---

## 4. Estructura del repo

```
diccionario-extension/
├── src/
│   ├── manifest.json
│   ├── background/service-worker.ts
│   ├── content/{content.ts, popover.css}
│   ├── popup/{popup.html, popup.ts, popup.css}
│   ├── options/{options.html, options.ts, options.css}
│   ├── lib/
│   │   ├── clients/{wikcionario.ts, merriam.ts}
│   │   ├── detector.ts, cache.ts, storage.ts
│   │   └── __tests__/{detector.test.ts, cache.test.ts, clients.test.ts}
│   └── icons/{16.png, 32.png, 48.png, 128.png}
├── safari/
│   ├── SafariExtension/
│   │   ├── SafariWebExtensionHandler.swift
│   │   ├── Info.plist
│   │   └── Resources/        (build output copiado por script)
│   └── InlineDictionary.xcodeproj/
├── build/                    (output JS, gitignored)
├── scripts/{build.mjs, build-safari.sh, dev.mjs}
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── README.md
└── docs/superpowers/specs/2026-09-06--diccionario-extension-design.md
```

---

## 5. Componentes e interfaces

### 5.1 Service worker (`background/service-worker.ts`)

- Listener de `chrome.runtime.onMessage` para mensaje `LOOKUP_WORD`
- Llama al cliente API correspondiente según idioma detectado
- Cache hit → respuesta inmediata; cache miss → fetch + cache write
- Devuelve `{ ok: true, result: LookupResult }` o `{ ok: false, error: ErrorCode }`

### 5.2 Content script (`content/content.ts`)

- `mouseup` listener → captura selección
- `keydown` listener → atajo Cmd+Shift+D
- `dblclick` listener → captura la palabra
- Llama al service worker vía `chrome.runtime.sendMessage`
- Renderiza popover con el resultado
- Maneja click-fuera, Escape, hover-pause
- Toggle ES/EN en el popover (re-lookup en el otro idioma)

### 5.3 Popover (HTML inyectado por content script)

- Encabezado: palabra + idioma activo (botones ES/EN)
- Cuerpo: definición(es) numeradas con parte de oración
- Sección colapsable: etimología
- Sección colapsable: ejemplos
- Footer: fuente (Wikcionario / Merriam-Webster) + link "ver más"

### 5.4 Popup toolbar (`popup/`)

- Input de búsqueda + botón "Buscar"
- Mismo handler que selección; resultado se renderiza en el popup, no en popover

### 5.5 Options page (`options/`)

- Campo: Merriam-Webster API key (almacenada en `chrome.storage.local`)
- Selector: idioma por defecto (`auto` / `es` / `en`)
- Botón: "Limpiar cache"

### 5.6 Lib clients (interfaces)

```ts
// lib/clients/wikcionario.ts
export interface LookupResult {
  word: string;
  language: 'es' | 'en';
  source: 'wikcionario' | 'merriam-webster';
  definitions: Array<{
    partOfSpeech: string;
    text: string;
    examples?: string[];
  }>;
  etymology?: string;
  pronunciation?: string;   // IPA, solo EN
}

export async function lookupWikcionario(word: string): Promise<LookupResult | null>;

// lib/clients/merriam.ts
export async function lookupMerriam(word: string, apiKey: string): Promise<LookupResult | null>;
```

### 5.7 Detector de idioma (`lib/detector.ts`)

```ts
export type Language = 'es' | 'en';

export function detectLanguage(word: string): Language {
  // Heurística:
  // 1. Si tiene ñ, ü, o tildes → ES
  // 2. Si match con lista top-100 palabras ES (artículos, pronombres, comunes) → ES
  // 3. Default → EN
}
```

### 5.8 Cache (`lib/cache.ts`)

```ts
// idb-keyval wrapper
export async function getCached(word: string, source: string): Promise<LookupResult | null>;
export async function setCached(word: string, source: string, result: LookupResult): Promise<void>;
export async function isRecentNotFound(word: string, source: string): Promise<boolean>; // TTL 1 día
export async function markNotFound(word: string, source: string): Promise<void>;
export async function clearCache(): Promise<void>;
```

### 5.9 Storage (`lib/storage.ts`)

```ts
// Wrapper unificado de chrome.storage / browser.storage
export async function getApiKey(): Promise<string | null>;
export async function setApiKey(key: string): Promise<void>;
export async function getDefaultLanguage(): Promise<'auto' | 'es' | 'en'>;
export async function setDefaultLanguage(lang: 'auto' | 'es' | 'en'): Promise<void>;
```

---

## 6. Flujo de datos

### Selección → Popover

1. Usuario hace doble-click en palabra, o selecciona y presiona Cmd+Shift+D
2. Content script captura `word` (trim + lowercase)
3. Content script llama `detectLanguage(word)` (override si default ≠ `auto`)
4. Content script envía mensaje `{ type: 'LOOKUP_WORD', word, language }` al service worker
5. Service worker consulta cache: hit → paso 8; miss → paso 6
6. Service worker llama al cliente API correspondiente:
   - ES → `lookupWikcionario(word)` (no necesita key)
   - EN → `lookupMerriam(word, apiKey)` (sin key → error `MW_KEY_MISSING`)
7. Service worker escribe al cache (resultado o not-found marker)
8. Service worker devuelve `LookupResult` o error tipado
9. Content script recibe respuesta y renderiza popover
10. Usuario cierra (click-fuera, Escape) o cambia idioma (toggle ES/EN → re-lookup)

### Búsqueda manual (popup toolbar)

1. Click en icono del toolbar
2. Popup se abre con input vacío
3. Usuario escribe palabra y presiona Enter
4. Mismo flujo que pasos 4-10, pero el resultado se renderiza en el popup

---

## 7. APIs externas

### 7.1 Wikcionario (MediaWiki API)

- **Endpoint**: `https://es.wiktionary.org/w/api.php`
- **Parámetros**: `action=query&prop=extracts&explaintext=1&titles={word}&format=json&redirects=1`
- **Auth**: ninguna
- **Rate limit**: 200 req/s por IP (más que suficiente)
- **CORS**: permitido para orígenes públicos
- **Parsing**: la respuesta JSON incluye `extract` (texto plano) que contiene la definición estructurada. Parser simple separa por secciones (`== {{lengua|es}} ==`).

### 7.2 Merriam-Webster Collegiate API

- **Endpoint**: `https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}?key={API_KEY}`
- **Auth**: API key por query string (https://dictionaryapi.com/)
- **Rate limit**: 1,000 req/día por key (gratis, suficiente para uso personal)
- **CORS**: permitido
- **Response**: array de entries con `fl` (functional label = part of speech), `shortdef` (array de definiciones), `et` (array de etimologías), `prs` (pronunciación IPA)

---

## 8. Cache

- **Backend**: IndexedDB store `lookups` con keys `{word}::{source}`
- **TTL hits**: indefinido (las definiciones no cambian)
- **TTL not-found**: 1 día (permite reintento si el servicio estaba caído)
- **Límite**: 5,000 entries (LRU eviction manual basada en `lastAccessed`)
- **Limpieza**: botón "Limpiar cache" en options page

---

## 9. UX y comportamiento

### Mecanismos de invocación

- **Doble-click** sobre una palabra → popover aparece
- **Selección + Cmd+Shift+D** → popover
- **Click en icono toolbar** → popup con campo de búsqueda manual

### Cierre del popover

- Click fuera del popover (con hover-pause si el cursor está dentro)
- Tecla Escape
- Cambio de selección a otra palabra (auto-refresh con debounce de 300ms)

### Atajos de teclado

- **Tab** (con popover abierto): toggle ES/EN
- **Escape**: cerrar
- **Cmd+Shift+D**: invocar lookup sobre selección actual
- **Click en "ver más"**: abrir Wikcionario / MW en pestaña nueva

### Privacidad

- Solo se envía la palabra al servicio externo
- No se envía la URL, el contenido de la página, ni cookies
- API key almacenada en `chrome.storage.local` (no sync)

---

## 10. Manejo de errores

| Error | Comportamiento |
|-------|----------------|
| Sin conexión a internet | "Sin conexión. Verifica tu red." Si hay cache, usa cache. |
| MW sin API key configurada | "Falta configurar API key de Merriam-Webster en opciones." |
| MW API key inválida (401) | "API key inválida. Revisa opciones." |
| MW rate limit (429) | "Límite diario de Merriam-Webster alcanzado. Intenta mañana." |
| Wikcionario 5xx / timeout | "Wikcionario no disponible. Intenta en un momento." |
| Palabra no encontrada en ambas fuentes | "No se encontró definición para '{word}'." |
| Popover fuera de viewport | Reposicionamiento automático (algoritmo flip) |

---

## 11. Testing

### Unit tests (vitest)

- `lib/detector.test.ts`: ñ/tildes → ES; palabras comunes ES → ES; default → EN
- `lib/cache.test.ts`: get/set/clear, TTL diferenciado, eviction
- `lib/clients/wikcionario.test.ts`: parseo de respuesta real (fetch mocked)
- `lib/clients/merriam.test.ts`: parseo de respuesta real (fetch mocked)
- `lib/storage.test.ts`: get/set wrappers

### Checklist de tests manuales (antes de release)

- [ ] Doble-click en palabra ES → popover con definición de Wikcionario
- [ ] Doble-click en palabra EN → popover con definición de MW
- [ ] Selección + Cmd+Shift+D → popover
- [ ] Toggle ES/EN en popover → re-lookup en el otro idioma
- [ ] Click fuera → popover cierra
- [ ] Escape → popover cierra
- [ ] API key MW se guarda en options → lookup EN funciona
- [ ] Sin API key MW → mensaje de error específico
- [ ] Palabra en cache → respuesta < 50 ms
- [ ] Carga en Chrome/Edge/Brave/Arc sin errores en consola
- [ ] Carga en Firefox sin errores en consola
- [ ] Carga en Safari sin errores en consola

---

## 12. Plan de implementación (4 fases)

### Fase 1 — Estructura (~30 min)

- `package.json` con scripts `build`, `dev`, `test`
- `tsconfig.json` estricto
- `scripts/build.mjs` con esbuild (3 outputs: chrome, firefox, safari-ready)
- `manifest.json` MV3 mínimo (background, content, action, options, permissions)
- `src/icons/` con 4 tamaños
- `.gitignore`
- Commit inicial

### Fase 2 — Clientes API + lib (~2-3 h)

- `lib/clients/wikcionario.ts` + tests
- `lib/clients/merriam.ts` + tests
- `lib/detector.ts` + tests
- `lib/cache.ts` + tests
- `lib/storage.ts` + tests
- `vitest.config.ts`

### Fase 3 — UI (~2-3 h)

- `content/content.ts` (selección + atajo + popover)
- `content/popover.css`
- `popup/popup.html` + `popup.ts` + `popup.css`
- `options/options.html` + `options.ts` + `options.css`
- Mensajes de error específicos en UI

### Fase 4 — Build + Safari wrapper + README (~1-2 h)

- `scripts/build.mjs` refinado
- `scripts/build-safari.sh` (copia build a `safari/Resources/`)
- `safari/SafariExtension/SafariWebExtensionHandler.swift` (~50 líneas)
- `safari/SafariExtension/Info.plist`
- `safari/InlineDictionary.xcodeproj/` (estructura)
- `README.md` con instrucciones de carga para cada navegador

**Total estimado: 6-9 horas de trabajo.**

---

## 13. Entrega

### Carga local (desarrollo)

- **Chrome/Edge/Brave/Arc**: `chrome://extensions` → "Modo desarrollador" → "Cargar extensión sin empaquetar" → seleccionar `build/chrome/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → "Cargar complemento temporal" → seleccionar `build/firefox/manifest.json`
- **Safari**: abrir `safari/InlineDictionary.xcodeproj` en Xcode → Run → en Safari "Desarrollar > Permitir extensiones no firmadas"

### Distribución (fuera de scope v1)

- Chrome Web Store (registro único 5 USD)
- Firefox Add-ons (gratis)
- Mac App Store para Safari (99 USD/año, requiere cert de developer)

---

## 14. Riesgos conocidos

1. **Wikcionario parsing**: la respuesta puede venir como texto con secciones en formato MediaWiki. Parser tolerante necesario.
2. **MW rate limit**: 1,000 req/día es suficiente para uso personal pero no para distribución masiva.
3. **MV3 service worker lifecycle**: el SW puede dormirse. Cache miss + SW dormido = latencia adicional. Mitigación: warmup en `chrome.runtime.onInstalled`.
4. **Popover positioning**: palabras cerca del borde inferior pueden sacar el popover del viewport. Algoritmo de flip necesario.
5. **Safari extension signing**: sin certificado de developer, solo se puede cargar en modo "desarrollador". Aceptable para uso personal.
6. **MV3 service worker termination**: el SW puede ser terminado entre eventos. Toda la lógica de estado debe ser idempotente.

---

## 15. Fuera de scope (recordatorio)

- Mobile
- Idiomas distintos a ES/EN
- Traducción entre idiomas
- Listas de vocabulario personal
- Historial persistente
- Audio de pronunciación
- Sincronización entre dispositivos
- Distribución pública (tiendas)
