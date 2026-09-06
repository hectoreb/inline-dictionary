// Dev watch mode: rebuilds on file changes
import { context } from 'esbuild';
import { watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUILD = join(ROOT, 'build', 'chrome');

const ENTRIES = {
  'background/service-worker': 'src/background/service-worker.ts',
  'content/content': 'src/content/content.ts',
  'popup/popup': 'src/popup/popup.ts',
  'options/options': 'src/options/options.ts',
};

const ctx = await context({
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  entryPoints: Object.fromEntries(
    Object.entries(ENTRIES).map(([out, src]) => [out, join(ROOT, src)])
  ),
  outdir: BUILD,
  logLevel: 'info',
});

await ctx.watch();
console.log('✓ Watching for changes... (Ctrl+C to stop)');
console.log('  Output: build/chrome/');

// Watch manifest + static for changes too
watch(join(ROOT, 'src'), { recursive: true }, async (event, filename) => {
  if (!filename) return;
  if (filename.endsWith('.ts')) return; // esbuild handles
  console.log(`  [static] ${filename} changed — re-run "npm run build" to copy`);
});
