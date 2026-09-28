// Regression test for the sidebar-footer rescue in the built client bundle.
//
// The bug: the sidebar lays its foot out as a column of two full-width seats —
// the `sidebar.footer.action` slot, then the seat holding the account launcher
// ("Signed in to DeepSeek") and the Settings trigger. The rescue inherited from
// the older two-slot foot gave the action seat `flex: 1`, leaving the
// account/Settings seat at its min-content width. Its label then painted
// straight over the balance chip instead of truncating.
//
// The policy that replaces it is deliberately one-way: the chip takes exactly
// its own content width and **always keeps its amount**, while the account seat
// takes the rest and is the only seat allowed to shrink. The balance is the
// plugin's reason for existing; the account label is the core app's and already
// truncates with an ellipsis, so a cramped footer clips the label, never the
// number.
//
// `lib/client.js` is the artifact the browser loads, so this reads the built
// bundle rather than the TypeScript source — a fix applied only to `src/` would
// still ship the bug. Run `pnpm run build` first (CI builds before it verifies).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUNDLE = join(ROOT, 'lib/client.js')

/** Style declaration stub: plain storage, no CSS parsing. */
class StyleStub {
  constructor() { this.store = {} }

  removeProperty(name) {
    const previous = this.store[name] ?? ''
    delete this.store[name]
    return previous
  }

  get flex() { return this.store.flex ?? '' }
  set flex(value) { this.store.flex = value }
  get flexShrink() { return this.store['flex-shrink'] ?? '' }
  set flexShrink(value) { this.store['flex-shrink'] = value }
  get flexDirection() { return this.store['flex-direction'] ?? '' }
  set flexDirection(value) { this.store['flex-direction'] = value }
  get minWidth() { return this.store['min-width'] ?? '' }
  set minWidth(value) { this.store['min-width'] = value }
  get width() { return this.store.width ?? '' }
  set width(value) { this.store.width = value }
  get display() { return this.store.display ?? '' }
  set display(value) { this.store.display = value }
  get alignItems() { return this.store['align-items'] ?? '' }
  set alignItems(value) { this.store['align-items'] = value }
  get justifyContent() { return this.store['justify-content'] ?? '' }
  set justifyContent(value) { this.store['justify-content'] = value }
  get order() { return this.store.order ?? '' }
  set order(value) { this.store.order = value }
}

/** The minimum an element needs for the flex policy. */
function element() {
  return { style: new StyleStub() }
}

/**
 * Extract one `function name(...) { ... }` declaration by brace matching.
 * @param source - the bundle text.
 * @param name - the function name to find.
 * @returns the function's source text.
 */
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`bundle omits ${name}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`unbalanced braces while extracting ${name}`)
}

/**
 * Extract a `const NAME = <literal>;` declaration.
 * @param source - the bundle text.
 * @param name - the constant name.
 * @returns the `NAME = value;` text without its `const` keyword.
 */
function extractConst(source, name) {
  const match = new RegExp(`const ${name} = ([^;\\n]+);`).exec(source)
  if (match === null) throw new Error(`bundle omits ${name}`)
  return `${name} = ${match[1]};`
}

/** Load the rescue's parts from the built bundle. */
function loadRescue() {
  const bundle = readFileSync(BUNDLE, 'utf8')
  const source = [
    extractConst(bundle, 'CHIP_ORDER'),
    extractFunction(bundle, 'applyFooterFlex'),
    extractFunction(bundle, 'applySidebarFooterLayout'),
  ].join('\n')
  return new Function(`${source}
    return { applyFooterFlex, applySidebarFooterLayout, CHIP_ORDER }`)()
}

const { applyFooterFlex, applySidebarFooterLayout, CHIP_ORDER } = loadRescue()

/** The two seats as the sidebar renders them, plus the plugin's own row. */
function seats() {
  return {
    foot: element(),
    outlet: element(),
    actions: element(),
    settings: element(),
  }
}

test('the foot becomes one row instead of a column of full-width seats', () => {
  const { foot, outlet, actions, settings } = seats()
  applyFooterFlex({ foot, outlet, actions, settings })
  assert.equal(foot.style.display, 'flex')
  assert.equal(foot.style.flexDirection, 'row')
  assert.equal(foot.style.alignItems, 'center')
})

test('the chip seat takes exactly its own width; the label gets the rest', () => {
  const { foot, outlet, actions, settings } = seats()
  applyFooterFlex({ foot, outlet, actions, settings })
  // The regression: `flex: 1` here made the action seat claim the row's free
  // width and squeezed the identity seat to its min-content.
  assert.equal(actions.style.flex, '0 0 auto')
  assert.equal(actions.style.flexShrink, '0')
  assert.equal(actions.style.justifyContent, 'flex-end')
  assert.equal(actions.style.display, 'flex')
  // The seat that holds the label grows into everything the chip leaves, and is
  // the only one of the two allowed to shrink.
  assert.equal(settings.style.flex, '1 1 auto')
  assert.equal(settings.style.minWidth, '0')
  assert.equal(settings.style.width, 'auto')
})

test('the slot element never takes a box of its own', () => {
  const { foot, outlet, actions, settings } = seats()
  applyFooterFlex({ foot, outlet, actions, settings })
  assert.equal(outlet.style.display, 'contents')
})

test('the chip is ordered after the Settings seat', () => {
  const { foot, outlet, actions, settings } = seats()
  applyFooterFlex({ foot, outlet, actions, settings })
  assert.equal(actions.style.order, String(CHIP_ORDER))
})

test('an order another writer set is left alone', () => {
  const { foot, outlet, actions, settings } = seats()
  actions.style.order = '-1'
  applyFooterFlex({ foot, outlet, actions, settings })
  assert.equal(actions.style.order, '-1')
})

test('a missing Settings seat still leaves a usable row', () => {
  const foot = element()
  const outlet = element()
  const actions = element()
  const layout = applyFooterFlex({ foot, outlet, actions, settings: undefined })
  assert.equal(foot.style.flexDirection, 'row')
  assert.equal(actions.style.flex, '0 0 auto')
  assert.equal(layout.settings, undefined)
})

test('the chip takes its own content width, not a share of the row', () => {
  // The chip is the row's fixed item: `max-content` is what stops the browser
  // from splitting the free space between the chip and the label.
  const bundle = readFileSync(BUNDLE, 'utf8')
  assert.match(bundle, /width: "max-content"/)
})

test('the chip contributes no vertical margin, so the foot can centre it', () => {
  // The foot centres its items. A top/bottom margin on the chip therefore moves
  // it off the account row's line: the old `margin: '4px auto 6px 0'` — carried
  // over from when the chip sat alone above the Settings seat — held it 6px
  // high. Reintroducing either vertical margin would silently unalign it.
  const bundle = readFileSync(BUNDLE, 'utf8')
  const chip = /const chipStyle = \{([\s\S]*?)\n\t\t\};/.exec(bundle)?.[1]
  assert.ok(chip !== undefined, 'chip style not found in the bundle')
  assert.match(chip, /margin: "0 auto"/)
  assert.doesNotMatch(chip, /marginTop|marginBottom|margin: "(?!0 auto)/)
  // And the two seats present boxes of equal height, so they centre on the same
  // line rather than merely sharing a baseline.
  assert.match(chip, /height: 32/)
})

test('the amount is rendered unconditionally, in every chip state', () => {
  // The rule this test exists for: the amount is never conditional on the
  // footer's width. A previous revision dropped it for a compact mark-and-dot
  // form, which hid the balance in the app's default window.
  const bundle = readFileSync(BUNDLE, 'utf8')
  assert.doesNotMatch(bundle, /compact|COMPACT|cramped|CRAMPED/)
  // Both amount spans are plain children: no `&&` guard in front of either.
  assert.match(bundle, /jsxs\)\("span", \{\s*style: amountStyle,\s*children: \[state\.symbol, state\.total\]/)
  assert.match(bundle, /jsx\)\("span", \{\s*style: amountStyle,\s*children: "Balance —"/)
})

test('the traversal finds the seats the sidebar renders', () => {
  // The DOM shape the traversal walks: the anchor inside the slot outlet, the
  // outlet inside the action column, the column and the Settings seat as the
  // foot's two children.
  const foot = element()
  const actions = element()
  const outlet = element()
  const anchor = element()
  const settings = element()
  outlet.parentElement = actions
  actions.parentElement = foot
  actions.nextElementSibling = settings
  anchor.closest = (selector) => (selector === '[data-slot="sidebar.footer.action"]' ? outlet : null)

  const layout = applySidebarFooterLayout(anchor)
  assert.equal(layout.outlet, outlet)
  assert.equal(layout.actions, actions)
  assert.equal(layout.foot, foot)
  assert.equal(layout.settings, settings)
  assert.equal(actions.style.flex, '0 0 auto')
  assert.equal(settings.style.flex, '1 1 auto')
})

test('a sidebar that does not wrap the slot still gets the row layout', () => {
  // Older releases render the plugin directly in the action column, so
  // `closest` finds nothing and the anchor stands in for the outlet.
  const foot = element()
  const actions = element()
  const anchor = element()
  anchor.parentElement = actions
  actions.parentElement = foot
  anchor.closest = () => null

  const layout = applySidebarFooterLayout(anchor)
  assert.equal(layout.outlet, anchor)
  assert.equal(layout.actions, actions)
  assert.equal(layout.foot, foot)
  assert.equal(anchor.style.display, 'contents')
  assert.equal(foot.style.flexDirection, 'row')
})
