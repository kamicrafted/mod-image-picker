import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Option, Pick } from '../types'

const TOOL = 'mcp__image-picker__pick_image'
// Bump the tag when Pick's fields change: it declines what an earlier version stored.
const picks = atom({ plugin: 'image-picker', key: 'picks' } as const, {}, {
  shape: 'picks-1',
})

// Terminal thumbnails travel as bytes (tmux passes only bytes); one tree holds
// at most 2 MiB of Image source in all, so the options share that budget.
const TREE_LIMIT = 2_000_000
const PNG_STEPS = [768, 640, 512, 420, 340, 280, 220]
// Desktop thumbnails ride inside an Svg, whose source is capped at 131072 chars.
const SVG_LIMIT = 131072 - 1024
const JPG_STEPS = [
  { px: 480, quality: 78 },
  { px: 360, quality: 65 },
  { px: 256, quality: 55 },
]
// A Bash call that opens this many images at once is a pick, not a look.
const VIEWER = /(^|[;&|]\s*)(open(\s+-a\s+"?Preview"?)?|xdg-open|imv|feh|eog|qlmanage\s+-p)\s/
const IMAGE_ARG = /\.(png|jpe?g|webp|gif)\b/gi

type Run = (argv: readonly string[]) => Promise<boolean>

// Tries each resizer in turn: ImageMagick and libvips on Linux, sips on every Mac.
async function resize(run: Run, src: string, dst: string, px: number, quality: number) {
  const box = `${px}x${px}`
  const jpg = dst.endsWith('.jpg')
  const attempts: string[][] = [
    ['magick', src, '-auto-orient', '-thumbnail', `${box}>`, '-quality', String(quality), dst],
    ['vipsthumbnail', src, '-s', box, '-o', jpg ? `${dst}[Q=${quality}]` : dst],
    ['sips', '-Z', String(px), '-s', 'format', jpg ? 'jpeg' : 'png',
      '-s', 'formatOptions', String(quality), src, '--out', dst],
    ['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-vf',
      `scale=${px}:${px}:force_original_aspect_ratio=decrease`, '-q:v', '4', dst],
  ]
  for (const argv of attempts) {
    if (await run(argv)) return true
  }

  return false
}

// Width and height from a PNG's IHDR chunk.
function pngSize(base64: string) {
  const b = atob(base64.slice(0, 64))
  const at = (i: number) =>
    ((b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) |
      (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3)) >>> 0

  return { width: at(16), height: at(20) }
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'pick_image',
      description:
        'Show 2-9 candidate images to the user inline (terminal or Claude Desktop) so they ' +
        'pick one. Use it whenever an image generation produced several options to choose ' +
        'from, instead of opening them in Preview or another viewer. It returns at once; then ' +
        'end your turn. The pick arrives as the user\'s next message ("Picked option N: <path>" ' +
        'or "None of these").',
      inputSchema: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 9,
            description: 'Absolute paths of the candidate images, in option order',
          },
          prompt: { type: 'string', description: 'A short line saying what is being chosen' },
        },
        required: ['paths'],
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = e as unknown as { tool_use_id: string; paths?: unknown; prompt?: unknown }
    const paths = Array.isArray(input.paths) ? input.paths.filter(p => typeof p === 'string') : []
    if (paths.length < 2 || paths.length > 9) {
      return { deny: 'pick_image takes 2 to 9 image paths.' }
    }
    for (const path of paths) {
      const stat = await $.fs.stat(path).catch(() => undefined)
      if (stat?.kind !== 'file') return { deny: `pick_image: no image at ${path}` }
    }

    const run: Run = argv =>
      $.process.run(argv, { timeoutMs: 30_000 }).then(r => r.exitCode === 0, () => false)
    const made = await $.process.run(['mktemp', '-d', '-t', 'image-picker.XXXXXX'])
    const dir = made.stdout.trim()

    const options: Option[] = []
    for (const [i, path] of paths.entries()) {
      const option: Option = { path, width: 1, height: 1 }

      const budget = TREE_LIMIT / paths.length
      for (const px of PNG_STEPS) {
        const png = `${dir}/${i + 1}-${px}.png`
        if (!(await resize(run, path, png, px, 90))) break
        const { base64 } = await $.fs.read(png, { as: 'bytes' })
        Object.assign(option, pngSize(base64))
        // Counted as base64, the larger of the two ways the limit could be read.
        if (base64.length <= budget) {
          option.png = png
          break
        }
      }

      for (const step of JPG_STEPS) {
        const jpg = `${dir}/${i + 1}-${step.px}.jpg`
        if (!(await resize(run, path, jpg, step.px, step.quality))) break
        const { base64 } = await $.fs.read(jpg, { as: 'bytes' })
        if (base64.length < SVG_LIMIT - 512) {
          option.jpg = jpg
          break
        }
      }
      options.push(option)
    }

    const prompt = typeof input.prompt === 'string' ? input.prompt : 'Pick an image'
    await update($, picks, all => ({ ...all, [input.tool_use_id]: { id: input.tool_use_id, prompt, options } }))

    const noThumbs = options.every(o => !o.png && !o.jpg)
    return {
      result:
        `Showing ${options.length} options to the user in an inline picker` +
        (noThumbs ? ' (no resizer found, so as a list of file names)' : '') +
        '. End your turn now and wait: their pick arrives as the next message. ' +
        'Do not open the images in a viewer.',
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'image-picker: could not prepare the options; open them another way.' },
  )

  // Opening several images in a viewer at once is the old way of picking.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const images = e.command.match(IMAGE_ARG) ?? []
    if (VIEWER.test(e.command) && images.length >= 2) {
      return {
        deny:
          'image-picker: to choose between generated options, call pick_image with their ' +
          'paths instead of opening a viewer. To open one image for a closer look, open it alone.',
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const pick = (await read($, picks))[e.requestId]
    if (!pick) return next(e)

    const choose = async (n: number) => {
      if (pick.picked !== undefined) return
      await update($, picks, all => ({ ...all, [pick.id]: { ...(all[pick.id] ?? pick), picked: n } }))
      const option = pick.options[n - 1]
      await $.prompt.submit({
        text: option ? `Picked option ${n}: ${option.path}` : 'None of these. Regenerate.',
        asUser: true,
      })
    }

    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const perRow = pick.options.length <= 4 ? 2 : 3
    const columns = e.viewport?.columns ?? 100
    const cellColumns = Math.max(16, Math.min(60, Math.floor((columns - 4) / perRow) - 2))

    // Rows stored by an older version may hold thumbnails past the tree's budget.
    let spent = 0
    const picture = async (option: Option, n: number) => {
      const alt = `${n}. ${basename(option.path)}`
      const aspect = option.height / option.width

      if (e.surface === 'terminal' && 'Image' in table && option.png) {
        const { base64 } = await $.fs.read(option.png, { as: 'bytes' })
        spent += base64.length
        if (spent > TREE_LIMIT) return <Text dimColor>{alt}</Text>
        // A terminal cell is about twice as tall as it is wide.
        const rows = Math.max(4, Math.min(30, Math.round((cellColumns * aspect) / 2.1)))
        return <table.Image source={{ png: base64 }} columns={cellColumns} rows={rows} alt={alt} />
      }
      if ('Svg' in table && option.jpg) {
        const { base64 } = await $.fs.read(option.jpg, { as: 'bytes' })
        const width = 280
        const height = Math.round(width * aspect)
        const source =
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
          `width="${width}" height="${height}"><image href="data:image/jpeg;base64,${base64}" ` +
          `width="${width}" height="${height}"/></svg>`
        return <table.Svg source={source} alt={alt} width={width} height={height} />
      }

      return <Text dimColor>{alt}</Text>
    }

    const cells = await Promise.all(
      pick.options.map(async (option, i) => {
        const n = i + 1
        const isPicked = pick.picked === n
        return (
          <Box flexDirection="column" marginRight={2} marginBottom={1}>
            {await picture(option, n)}
            {pick.picked === undefined ? (
              <Button key={`pick-${n}`} hotkey={String(n)} onPress={() => void choose(n)}>
                {`Pick ${n}`}
              </Button>
            ) : (
              <Text bold={isPicked} dimColor={!isPicked}>
                {isPicked ? `✓ ${n} picked` : `${n}`}
              </Text>
            )}
          </Box>
        )
      }),
    )
    const rows = []
    for (let i = 0; i < cells.length; i += perRow) {
      rows.push(<Box flexDirection="row">{cells.slice(i, i + perRow)}</Box>)
    }

    return (
      <Box flexDirection="column">
        <Text bold>{pick.prompt}</Text>
        {rows}
        {pick.picked === undefined ? (
          <Box flexDirection="row">
            <Button key="pick-none" hotkey="0" dimColor onPress={() => void choose(0)}>
              None of these
            </Button>
            <Text dimColor>  or type the number in the prompt</Text>
          </Box>
        ) : (
          pick.picked === 0 && <Text dimColor>None picked</Text>
        )}
      </Box>
    )
  })
}
