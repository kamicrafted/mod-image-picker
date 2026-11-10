import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const TOOL = 'mcp__image-picker__pick_image'
const call = (tool_use_id: string, tool: string) =>
  ({ tool_use_id, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })
// The terminal draws the picker as the call's result; the desktop app hides a
// standalone row's result until it is expanded, so there it rides the row itself.
const row = (surface: 'terminal' | 'desktop') =>
  surface === 'terminal'
    ? { component: 'ToolResult' as const, props: { tool_use_id: 'tu1', tool: TOOL, output: 'ok', isErrored: false } }
    : { component: 'ToolUse' as const, props: call('tu1', TOOL) }
// A 1x1 PNG: the drawing only inlines the bytes it reads.
const THUMB = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
const PICK = {
  id: 'tu1',
  prompt: 'Pick a mug',
  options: [1, 2, 3, 4].map(n => ({
    path: `/x/mug-${n}.jpeg`,
    png: `/t/${n}.png`,
    jpg: `/t/${n}.jpg`,
    width: 256,
    height: 256,
  })),
}

// What the session holds once pick_image has run, under the atom's shape tag.
function seed(on: Parameters<TestBody>[1]) {
  on('state.get', () => ({ value: { value: { shape: 'picks-1', value: { tu1: PICK } }, version: 1 } }))
  on('fs.read', () => ({ value: { base64: THUMB } }))
  // The engine's own drawing, beneath the plugin.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine {e.component}</Text>
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a standalone call draws the picker as its result on ${surface}`, async ($, on) => {
    seed(on)
    const ui = await $.ui.mount({
      plugin: 'image-picker', surface, requestId: 'tu1', ...row(surface),
    })
    expect((await ui.find({ type: 'Text', text: /Pick a mug/ }))?.text).toBe('Pick a mug')
    await ui.unmount()
  })

  test(`a collapsed group draws the picker above its own line on ${surface}`, async ($, on) => {
    seed(on)
    const ui = await $.ui.mount({
      plugin: 'image-picker', surface, component: 'ToolGroup', requestId: 'group:tu1',
      props: {
        calls: [call('tu1', TOOL), call('tu2', 'Bash')],
        isActive: false,
        isExpanded: false,
      },
    })
    expect((await ui.find({ type: 'Text', text: /Pick a mug/ }))?.text).toBe('Pick a mug')
    expect((await ui.find({ type: 'Text', text: /engine ToolGroup/ }))?.text).toBe('engine ToolGroup')
    await ui.unmount()
  })
}

test('a group without a pick is left to the engine', async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({
    plugin: 'image-picker', surface: 'desktop', component: 'ToolGroup', requestId: 'group:tu9',
    props: { calls: [call('tu9', 'Bash')], isActive: false, isExpanded: false },
  })
  expect(await ui.find({ type: 'Text', text: /Pick a mug/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /engine ToolGroup/ }))?.text).toBe('engine ToolGroup')
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`None of these sits on the prompt's line on ${surface}`, async ($, on) => {
    seed(on)
    const ui = await $.ui.mount({
      plugin: 'image-picker', surface, requestId: 'tu1', ...row(surface),
    })
    expect(await ui.find({ type: 'Button', key: 'tu1-pick-none' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'tu1-zoom-3' })).toBeDefined()
    await ui.unmount()
  })

  test(`an enlarged option draws alone with Pick and Back on ${surface}`, async ($, on) => {
    on('state.get', () => ({
      value: { value: { shape: 'picks-1', value: { tu1: { ...PICK, zoom: 3 } } }, version: 1 },
    }))
    on('fs.read', () => ({ value: { base64: THUMB } }))
    const ui = await $.ui.mount({
      plugin: 'image-picker', surface, requestId: 'tu1', ...row(surface),
    })
    expect(await ui.find({ type: 'Button', key: 'tu1-zoom-pick-3' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'tu1-zoom-back' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'tu1-pick-1' })).toBeUndefined()
    await ui.unmount()
  })
}

// Desktop drops a whole tree past an unlogged size, so the grid draws only the
// small `thumb` files and leaves the large `jpg` to the enlarged view.
test('the desktop grid reads thumbnails, never the enlarge JPEGs', async ($, on) => {
  const read: string[] = []
  const pick = { ...PICK, options: PICK.options.map((o, i) => ({ ...o, thumb: `/t/${i + 1}-thumb.jpg` })) }
  on('state.get', () => ({ value: { value: { shape: 'picks-1', value: { tu1: pick } }, version: 1 } }))
  on('fs.read', ($, e) => {
    read.push(String((e as { path: string }).path))
    return { value: { base64: THUMB } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine {e.component}</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'image-picker', surface: 'desktop', requestId: 'tu1', ...row('desktop'),
  })
  expect(read.length).toBe(4)
  expect(read.every(p => p.includes('-thumb'))).toBe(true)
  await ui.unmount()
})

// An older row's thumbnails can exceed the budget: the overflow draws as names,
// and the grid itself still draws.
test('desktop thumbnails past the budget draw as names, not an empty grid', async ($, on) => {
  const BIG = 'A'.repeat(15_000)
  const pick = { ...PICK, options: PICK.options.map((o, i) => ({ ...o, thumb: `/t/${i + 1}-thumb.jpg` })) }
  on('state.get', () => ({ value: { value: { shape: 'picks-1', value: { tu1: pick } }, version: 1 } }))
  on('fs.read', () => ({ value: { base64: BIG } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine {e.component}</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'image-picker', surface: 'desktop', requestId: 'tu1', ...row('desktop'),
  })
  expect((await ui.find({ type: 'Text', text: /Pick a mug/ }))?.text).toBe('Pick a mug')
  expect((await ui.find({ type: 'Text', text: /mug-4\.jpeg/ }))?.text).toBe('4. mug-4.jpeg')
  await ui.unmount()
})

test('on desktop the expanded result is left to the engine', async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({
    plugin: 'image-picker', surface: 'desktop', component: 'ToolResult', requestId: 'tu1',
    props: { tool_use_id: 'tu1', tool: TOOL, output: 'ok', isErrored: false },
  })
  expect((await ui.find({ type: 'Text', text: /engine ToolResult/ }))?.text).toBe('engine ToolResult')
  await ui.unmount()
})
