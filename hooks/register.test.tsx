import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const TOOL = 'mcp__image-picker__pick_image'
const call = (tool_use_id: string, tool: string) =>
  ({ tool_use_id, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })
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
      plugin: 'image-picker', surface, component: 'ToolResult', requestId: 'tu1',
      props: { tool_use_id: 'tu1', tool: TOOL, output: 'ok', isErrored: false },
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
