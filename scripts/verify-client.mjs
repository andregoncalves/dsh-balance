// Simulate the DSH browser module table to verify lib/client.js evaluates,
// registers with __ModuleLoader__, exports the plugin contract, applies into
// the sidebar.footer.action slot, and the registered entry is the balance chip.
import { readFileSync } from 'node:fs'

/** The client-module entry id: the DSH node half derives it from the package name. */
const PACKAGE_ID = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name

let handoff = null
globalThis.window = {
  __ModuleLoader__: {
    load: (h) => { handoff = h },
  },
}

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
// The bundle executes in this realm; `window` resolves via globalThis.
;(0, eval)(code)

if (handoff === null) throw new Error('bundle did not call __ModuleLoader__.load')
if (handoff.id !== PACKAGE_ID) throw new Error(`wrong id: ${handoff.id}`)

// Stub the two external platform modules the bundle requires. react provides
// hook no-ops so the module-level destructure (and any hook the entry calls)
// resolves; jsx-runtime returns inert descriptors.
const reactStub = {
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: () => ({ current: null }),
  useState: (initial) => [initial, () => {}],
}
const jsxRuntimeStub = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
}
const requireStub = (id) => {
  if (id === 'react') return reactStub
  if (id === 'react/jsx-runtime') return jsxRuntimeStub
  throw new Error(`unexpected external require: ${id}`)
}

const mod = handoff.factory(requireStub)
console.log('exports:', Object.keys(mod).sort().join(', '))
if (mod.name !== 'dsh-balance') throw new Error('name mismatch')
if (JSON.stringify(mod.inject) !== JSON.stringify(['slots', 'connection'])) throw new Error('inject mismatch')
if (typeof mod.apply !== 'function') throw new Error('apply missing')
if (typeof mod.BalanceChip !== 'function') throw new Error('BalanceChip missing')

// DeepSeek peak/off-peak window (official: api-docs.deepseek.com/quick_start/pricing):
// peak is Mon–Fri 09:00–12:00 and 14:00–18:00 Beijing (UTC+8) = 01:00–04:00 and
// 06:00–10:00 UTC; weekends are off-peak all day.
if (typeof mod.isPeakHour !== 'function') throw new Error('isPeakHour missing')
const peakAt = (iso) => mod.isPeakHour(new Date(iso))
const peakCases = [
  ['2026-09-07T01:00:00Z', true, 'Monday 01:00 UTC (09:00 Beijing) is peak'],
  ['2026-09-07T02:00:00Z', true, 'Monday 02:00 UTC is peak'],
  ['2026-09-07T06:00:00Z', true, 'Monday 06:00 UTC (14:00 Beijing) is peak'],
  ['2026-09-07T04:00:00Z', false, 'Monday 04:00 UTC (12:00 Beijing) is off-peak'],
  ['2026-09-07T05:00:00Z', false, 'Monday 05:00 UTC (13:00 Beijing) is off-peak'],
  ['2026-09-11T09:00:00Z', true, 'Friday 09:00 UTC (17:00 Beijing) is peak'],
  ['2026-09-11T10:00:00Z', false, 'Friday 10:00 UTC (18:00 Beijing) is off-peak'],
  ['2026-09-12T02:00:00Z', false, 'Saturday 02:00 UTC is off-peak all day'],
  ['2026-09-13T07:00:00Z', false, 'Sunday 07:00 UTC is off-peak all day'],
]
for (const [iso, expected, label] of peakCases) {
  const actual = peakAt(iso)
  if (actual !== expected) throw new Error(`peak-hour mismatch for ${label}: got ${actual}`)
}
console.log(`peak-hour assertions: PASS (${peakCases.length} cases, incl. weekend off-peak)`)

// Apply with a fake slot registry plus a fake connection face.
const injected = []
let injectedCb = null
let registered = null
const slots = {
  inject: (key, cb) => { injected.push(key); injectedCb = cb },
  register: (opts, component) => { registered = { opts, component }; return () => {} },
}
const fakeConnection = { api: { sessions: { models: async () => ({ result: { ok: true, value: { current: { provider: 'deepseek-official', model: 'x' } } } }) } } }
const ctx = {
  inject: (services, cb) => {
    if (JSON.stringify(services) !== JSON.stringify(['slots', 'connection'])) throw new Error(`unexpected inject order: ${services}`)
    return cb({
      slots,
      get: (name) => {
        if (name === 'connection') return fakeConnection
        // modelDirectories is an optional service; the plugin tolerates absence.
        if (name === 'modelDirectories') return undefined
        throw new Error(`unexpected get: ${name}`)
      },
    })
  },
}
mod.apply(ctx)
console.log('slots.inject called with:', injected)
if (injected.length !== 1 || injected[0] !== 'sidebar.footer.action') throw new Error('slot injection mismatch')

const disposer = injectedCb()
console.log('register opts:', JSON.stringify(registered.opts))
if (registered.opts.name !== 'sidebar.footer.action' || registered.opts.id !== 'balance') throw new Error('register opts mismatch')
if (typeof disposer !== 'function') throw new Error('register must return a disposer')

// The registered entry is the chip wrapper: invoking it with the owner share
// and the standard `useSessions` seat returns an element (a jsx descriptor
// whose `type` is the BalanceChip component).
const el = registered.component({ wide: true, useSessions: () => undefined })
console.log('registered entry render type:', typeof el.type)
if (typeof el.type !== 'function') throw new Error('the registered entry should render a component')
console.log('PASS: client bundle contract, slot registration, and entry render are sound')
