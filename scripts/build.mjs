// Build script for Inline Dictionary extension
// Produces 3 outputs in build/:
//   - chrome/   (Chrome, Edge, Brave, Arc)
//   - firefox/  (Firefox; background uses scripts[] instead of service_worker)
//   - safari/   (Safari Web Extension; manifest as-is, copied to safari/Resources/)

import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const BUILD = join(ROOT, 'build');

const SHARED_OPTIONS = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
};

// Entry points per target
const ENTRIES = {
  background: 'src/background/service-worker.ts',
  content: 'src/content/content.ts',
  popup: 'src/popup/popup.ts',
  options: 'src/options/options.ts',
};

// Static assets to copy verbatim
const STATIC = [
  'src/popup/popup.html',
  'src/popup/popup.css',
  'src/options/options.html',
  'src/options/options.css',
  'src/content/popover.css',
  'src/icons',
];

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function buildEntry(target, entry, outfile) {
  await build({
    ...SHARED_OPTIONS,
    entryPoints: [join(ROOT, entry)],
    outfile: join(BUILD, target, outfile),
  });
}

async function copyStatic(target) {
  for (const asset of STATIC) {
    const src = join(ROOT, asset);
    const statResult = await stat(src);
    if (statResult.isDirectory()) {
      await cp(src, join(BUILD, target, asset.replace('src/', '')), { recursive: true });
    } else {
      const dest = join(BUILD, target, asset.replace('src/', ''));
      await ensureDir(dirname(dest));
      await cp(src, dest);
    }
  }
}

async function writeManifest(target) {
  const manifestPath = join(SRC, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (target === 'firefox' || target === 'safari') {
    // Firefox MV3 + Safari Web Extension need background.scripts[] (persistent: false)
    // Chrome/Edge use background.service_worker
    manifest.background = {
      scripts: ['background/service-worker.js'],
      persistent: false,
      type: 'module',
    };
    // Firefox-specific: add browser_specific_settings
    if (target === 'firefox') {
      manifest.browser_specific_settings = {
        gecko: { id: 'inline-dictionary@hectoreb.dev' },
      };
    }
  }

  const dest = join(BUILD, target, 'manifest.json');
  await writeFile(dest, JSON.stringify(manifest, null, 2) + '\n');
}

async function buildTarget(target) {
  console.log(`\n→ Building ${target}`);
  await ensureDir(join(BUILD, target));

  // Compile TS entries
  for (const [name, entry] of Object.entries(ENTRIES)) {
    const ext = name === 'background' || name === 'content' || name === 'popup' || name === 'options'
      ? name === 'content' ? 'content.js' : `${name}.js`
      : `${name}.js`;
    const outfile = name === 'content' ? 'content/content.js' :
                    name === 'background' ? 'background/service-worker.js' :
                    name === 'popup' ? 'popup/popup.js' :
                    'options/options.js';
    await buildEntry(target, entry, outfile);
  }

  // Copy static assets
  await copyStatic(target);

  // Write manifest (per-target adjusted)
  await writeManifest(target);

  console.log(`✓ ${target} built`);
}

async function main() {
  console.log('Building Inline Dictionary extension...\n');
  await ensureDir(BUILD);

  for (const target of ['chrome', 'firefox', 'safari']) {
    await buildTarget(target);
  }

  console.log('\n✓ All targets built');
  console.log('  - build/chrome/   (Chrome, Edge, Brave, Arc)');
  console.log('  - build/firefox/  (Firefox)');
  console.log('  - build/safari/   (copy to safari/Resources/ to build Safari)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
