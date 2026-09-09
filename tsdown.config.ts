/**
 * Out-of-tree tsdown config for dsh-balance, replicating the repository's
 * client-bundle preset (packages/client/tsdown.client.ts) for a standalone
 * package: a node-half ESM library plus the browser bundle in the exact
 * `window.__ModuleLoader__.load({ id, factory })` closure format the DSH web
 * shell consumes, with the platform modules left external (they resolve from
 * the browser's frozen module table, never from node_modules).
 */
import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

/**
 * Client-module entry id. The DSH client-modules node half derives each web
 * plugin's boot-row id from the package name, so the bundle's
 * `__ModuleLoader__.load({ id })` must carry the exact npm package name. It is
 * read from package.json so renaming the package keeps the bundle in sync.
 */
const PACKAGE_ID = (JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { name: string }).name

/** The DSH browser platform modules (mirror of packages/client/web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  // Documented runtime exemption: the client runtime store engine.
  '@deepseek-ai/dsh-client-runtime/client',
]

export default defineConfig([
  {
    // Host half: ordinary ESM library the cordis Loader imports.
    name: PACKAGE_ID,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: true,
  },
  {
    // Browser half: closure-factory bundle served as /plugins/<package>/client.js.
    name: `${PACKAGE_ID}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...PLATFORM_MODULES],
    noExternal: (id: string) => (PLATFORM_MODULES.includes(id) ? undefined : true),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
